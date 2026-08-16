package rag

// modelfiles.go resolves the three on-disk dependencies Embed needs: the
// onnxruntime shared library, model_int8.onnx, and tokenizer.json. All three
// are resolved the same way Python's stack ends up placing them, so a Go
// backend running on the same machine as (or after) the Python sidecar needs
// zero extra downloads -- see NewEmbedderFromEnv's doc comment for the exact
// resolution order.

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
)

const (
	hfRepoID   = "nomic-ai/nomic-embed-text-v1.5"
	hfRevision = "main"

	envSharedLibPath = "LOGLENS_ONNXRUNTIME_PATH"
	envModelPath     = "LOGLENS_RAG_MODEL_PATH"
	envTokenizerPath = "LOGLENS_RAG_TOKENIZER_PATH"
	envHFHome        = "HF_HOME"
)

// NewEmbedderFromEnv builds an Embedder using the following resolution order
// for each dependency, mirroring (and interoperating with) how the Python
// sidecar already populates these files:
//
//  1. Explicit override via environment variable (LOGLENS_ONNXRUNTIME_PATH,
//     LOGLENS_RAG_MODEL_PATH, LOGLENS_RAG_TOKENIZER_PATH).
//  2. For the model/tokenizer: the standard Hugging Face hub cache layout
//     (`$HF_HOME/hub` or `~/.cache/huggingface/hub`), i.e. exactly where
//     `huggingface_hub.snapshot_download` (called by rag_service.py) already
//     puts them. During this migration, the Python sidecar and Go backend
//     run on the same machine, so this cache is very likely already
//     populated -- confirmed present on the dev machine this was written on.
//  3. For the model/tokenizer, if the cache is empty: download the two files
//     (tokenizer.json, onnx/model_int8.onnx) directly from
//     https://huggingface.co/<repo>/resolve/main/... via plain net/http, and
//     cache them under dataDir so subsequent runs skip the download -- this
//     is a deliberately minimal reimplementation of what
//     huggingface_hub.snapshot_download does, scoped to exactly the two
//     files this package needs (no auth, no LFS pointer resolution beyond
//     following HTTP redirects, which net/http's default client already
//     does).
//  4. For the shared library: common install locations, including the
//     Python venv path this repo happens to use
//     (<repoRoot>/.venv/Lib/site-packages/onnxruntime/capi/onnxruntime.dll
//     on Windows / the .so equivalent elsewhere). If none of these exist, the
//     path is left empty and onnxruntime_go falls back to its own default
//     ("onnxruntime.dll"/"onnxruntime.so" resolved via the OS's normal
//     shared-library search path), which still works if the operator placed
//     it next to the executable or on PATH/LD_LIBRARY_PATH.
//
// dataDir is the same per-workspace/app data directory the rest of the app
// uses (mirrors rag_service.py's `data_dir` constructor argument); the
// downloaded-model cache, if needed, is written under
// filepath.Join(dataDir, "rag_model").
func NewEmbedderFromEnv(dataDir string) (*Embedder, error) {
	sharedLib := resolveSharedLibraryPath()

	modelPath, tokenizerPath, err := resolveModelFiles(dataDir)
	if err != nil {
		return nil, fmt.Errorf("rag: resolving model files: %w", err)
	}

	return NewEmbedder(sharedLib, modelPath, tokenizerPath)
}

// resolveSharedLibraryPath looks for an onnxruntime shared library via an
// explicit override, then a handful of well-known locations. Returns "" if
// none are found (letting onnxruntime_go use its own default lookup).
func resolveSharedLibraryPath() string {
	if p := os.Getenv(envSharedLibPath); p != "" {
		if fileExists(p) {
			return p
		}
	}

	libName := "onnxruntime.so"
	if runtime.GOOS == "windows" {
		libName = "onnxruntime.dll"
	} else if runtime.GOOS == "darwin" {
		libName = "onnxruntime.dylib"
	}

	candidates := []string{
		// Next to the running executable.
		filepath.Join(exeDir(), libName),
	}
	// The Python sidecar's venv, if this Go binary happens to run from
	// within (or alongside) the same repo checkout during the migration.
	if repoRoot := findRepoRoot(); repoRoot != "" {
		if runtime.GOOS == "windows" {
			candidates = append(candidates,
				filepath.Join(repoRoot, ".venv", "Lib", "site-packages", "onnxruntime", "capi", libName))
		} else {
			candidates = append(candidates,
				filepath.Join(repoRoot, ".venv", "lib", "python3", "site-packages", "onnxruntime", "capi", libName))
		}
	}

	for _, c := range candidates {
		if fileExists(c) {
			return c
		}
	}
	return ""
}

// resolveModelFiles returns (onnxModelPath, tokenizerJSONPath, error).
func resolveModelFiles(dataDir string) (string, string, error) {
	if m, t := os.Getenv(envModelPath), os.Getenv(envTokenizerPath); m != "" && t != "" {
		return m, t, nil
	}

	if m, t, ok := findInHFCache(); ok {
		return m, t, nil
	}

	return downloadModelFiles(filepath.Join(dataDir, "rag_model"))
}

// findInHFCache looks for the model in the standard Hugging Face hub cache
// layout: <cacheRoot>/hub/models--nomic-ai--nomic-embed-text-v1.5/snapshots/*/
// with onnx/model_int8.onnx and tokenizer.json inside, exactly as
// huggingface_hub.snapshot_download (used by rag_service.py) lays it out.
func findInHFCache() (modelPath, tokenizerPath string, ok bool) {
	cacheRoot := os.Getenv(envHFHome)
	if cacheRoot == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", "", false
		}
		cacheRoot = filepath.Join(home, ".cache", "huggingface")
	}

	repoDir := "models--" + filepath.FromSlash(hfRepoIDToDirName())
	snapshotsDir := filepath.Join(cacheRoot, "hub", repoDir, "snapshots")

	entries, err := os.ReadDir(snapshotsDir)
	if err != nil {
		return "", "", false
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		snap := filepath.Join(snapshotsDir, e.Name())
		m := filepath.Join(snap, "onnx", "model_int8.onnx")
		t := filepath.Join(snap, "tokenizer.json")
		if fileExists(m) && fileExists(t) {
			return m, t, true
		}
	}
	return "", "", false
}

func hfRepoIDToDirName() string {
	// "nomic-ai/nomic-embed-text-v1.5" -> "nomic-ai--nomic-embed-text-v1.5"
	out := make([]byte, 0, len(hfRepoID))
	for i := 0; i < len(hfRepoID); i++ {
		if hfRepoID[i] == '/' {
			out = append(out, '-', '-')
			continue
		}
		out = append(out, hfRepoID[i])
	}
	return string(out)
}

// downloadModelFiles fetches tokenizer.json and onnx/model_int8.onnx
// directly from the Hugging Face resolve endpoint into cacheDir, skipping
// files that already exist there (idempotent, so repeated calls / restarts
// don't re-download). This is a deliberately small stand-in for
// huggingface_hub.snapshot_download -- just enough to make a from-scratch Go
// deployment (no Python ever run) self-sufficient.
func downloadModelFiles(cacheDir string) (modelPath, tokenizerPath string, err error) {
	if err := os.MkdirAll(filepath.Join(cacheDir, "onnx"), 0o755); err != nil {
		return "", "", err
	}

	tokenizerPath = filepath.Join(cacheDir, "tokenizer.json")
	modelPath = filepath.Join(cacheDir, "onnx", "model_int8.onnx")

	if err := downloadIfMissing(hfResolveURL("tokenizer.json"), tokenizerPath); err != nil {
		return "", "", fmt.Errorf("downloading tokenizer.json: %w", err)
	}
	if err := downloadIfMissing(hfResolveURL("onnx/model_int8.onnx"), modelPath); err != nil {
		return "", "", fmt.Errorf("downloading onnx/model_int8.onnx: %w", err)
	}
	return modelPath, tokenizerPath, nil
}

func hfResolveURL(file string) string {
	return fmt.Sprintf("https://huggingface.co/%s/resolve/%s/%s", hfRepoID, hfRevision, file)
}

func downloadIfMissing(url, dest string) error {
	if fileExists(dest) {
		return nil
	}
	tmp := dest + ".part"

	resp, err := http.Get(url) //nolint:gosec // fixed, hardcoded HF URL, not user input
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %s fetching %s", resp.Status, url)
	}

	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, resp.Body); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, dest)
}

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exe)
}

// findRepoRoot walks up from the current working directory looking for a
// ".venv" sibling directory, purely as a development-time convenience so a
// `go test`/`go run` invocation inside this repo checkout can find the
// Python sidecar's already-downloaded onnxruntime.dll without any
// environment variable setup. Returns "" if none is found within a few
// levels (never walks past the filesystem root).
func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for range 8 {
		if fileExists(filepath.Join(dir, ".venv", "pyvenv.cfg")) {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}
