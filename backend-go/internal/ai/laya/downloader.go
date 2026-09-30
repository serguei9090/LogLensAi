// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	// Hugging Face repo and revision for Laya 8-bit quantized model
	DefaultHFRepoID = "nvkudva/laya-web-q8"
	DefaultRevision = "main"

	// File names in repo
	EncoderFileName   = "encoder_q8.onnx"
	HeadFileName      = "head_q8.onnx"
	TokenizerFileName = "tokenizer.json"

	// Approximate file sizes for progress estimation before header arrival
	EncoderApproxSize   int64 = 490 * 1024 * 1024
	HeadApproxSize      int64 = 34 * 1024 * 1024
	TokenizerApproxSize int64 = 1500 * 1024
	TotalApproxSize     int64 = EncoderApproxSize + HeadApproxSize + TokenizerApproxSize
)

// ModelDownloadState describes the current state of local model files.
type ModelDownloadState string

const (
	ModelStateIdle        ModelDownloadState = "idle"
	ModelStateDownloading ModelDownloadState = "downloading"
	ModelStateReady       ModelDownloadState = "ready"
	ModelStateError       ModelDownloadState = "error"
)

// ModelStatus represents the JSON-RPC reportable status of the Laya model weights.
type ModelStatus struct {
	State           ModelDownloadState `json:"state"`
	Progress        float64            `json:"progress"` // 0.0 - 100.0
	DownloadedBytes int64              `json:"downloaded_bytes"`
	TotalBytes      int64              `json:"total_bytes"`
	ErrorMessage    string             `json:"error_message,omitempty"`
	ModelDir        string             `json:"model_dir"`
	EncoderPath     string             `json:"encoder_path"`
	HeadPath        string             `json:"head_path"`
	TokenizerPath   string             `json:"tokenizer_path"`
}

// progressWriter wraps an io.Writer and tracks byte counts to calculate overall progress.
type progressWriter struct {
	writer     io.Writer
	onProgress func(n int)
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.writer.Write(p)
	if n > 0 && pw.onProgress != nil {
		pw.onProgress(n)
	}
	return n, err
}

// ModelManager oversees discovery, status, and background downloading of Laya ONNX weights.
type ModelManager struct {
	mu              sync.RWMutex
	modelDir        string
	state           ModelDownloadState
	progress        float64
	downloadedBytes int64
	totalBytes      int64
	errorMessage    string

	cancelFunc context.CancelFunc

	// Custom download base URL (overridable for testing)
	baseURL string
}

// NewModelManager constructs a ModelManager storing weights under modelDir.
func NewModelManager(modelDir string) *ModelManager {
	mm := &ModelManager{
		modelDir:   modelDir,
		state:      ModelStateIdle,
		totalBytes: TotalApproxSize,
		baseURL:    fmt.Sprintf("https://huggingface.co/%s/resolve/%s", DefaultHFRepoID, DefaultRevision),
	}
	mm.RefreshStatus()
	return mm
}

// SetBaseURL overrides the download endpoint (primarily for mock HTTP tests).
func (m *ModelManager) SetBaseURL(url string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.baseURL = url
}

// GetPaths returns the resolved absolute paths for encoder, head, and tokenizer.
func (m *ModelManager) GetPaths() (encoder, head, tokenizer string) {
	return filepath.Join(m.modelDir, EncoderFileName),
		filepath.Join(m.modelDir, HeadFileName),
		filepath.Join(m.modelDir, TokenizerFileName)
}

// RefreshStatus inspects the filesystem and updates the internal state.
func (m *ModelManager) RefreshStatus() ModelStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	enc, head, tok := filepath.Join(m.modelDir, EncoderFileName),
		filepath.Join(m.modelDir, HeadFileName),
		filepath.Join(m.modelDir, TokenizerFileName)

	encExists := fileExists(enc)
	headExists := fileExists(head)
	tokExists := fileExists(tok)

	if encExists && headExists && tokExists {
		m.state = ModelStateReady
		m.progress = 100.0
		var encSize, headSize, tokSize int64
		if fi, err := os.Stat(enc); err == nil {
			encSize = fi.Size()
		}
		if fi, err := os.Stat(head); err == nil {
			headSize = fi.Size()
		}
		if fi, err := os.Stat(tok); err == nil {
			tokSize = fi.Size()
		}
		m.downloadedBytes = encSize + headSize + tokSize
		m.totalBytes = m.downloadedBytes
		m.errorMessage = ""
	} else if m.state != ModelStateDownloading {
		m.state = ModelStateIdle
		m.progress = 0.0
		m.downloadedBytes = 0
		m.totalBytes = TotalApproxSize
	}

	return ModelStatus{
		State:           m.state,
		Progress:        m.progress,
		DownloadedBytes: m.downloadedBytes,
		TotalBytes:      m.totalBytes,
		ErrorMessage:    m.errorMessage,
		ModelDir:        m.modelDir,
		EncoderPath:     enc,
		HeadPath:        head,
		TokenizerPath:   tok,
	}
}

// GetStatus returns a snapshot of current download/readiness status.
func (m *ModelManager) GetStatus() ModelStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	enc, head, tok := filepath.Join(m.modelDir, EncoderFileName),
		filepath.Join(m.modelDir, HeadFileName),
		filepath.Join(m.modelDir, TokenizerFileName)

	return ModelStatus{
		State:           m.state,
		Progress:        m.progress,
		DownloadedBytes: m.downloadedBytes,
		TotalBytes:      m.totalBytes,
		ErrorMessage:    m.errorMessage,
		ModelDir:        m.modelDir,
		EncoderPath:     enc,
		HeadPath:        head,
		TokenizerPath:   tok,
	}
}

// IsReady returns true if all 3 required files are present on disk.
func (m *ModelManager) IsReady() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state == ModelStateReady
}

// StartDownload initiates an asynchronous download of all required model files.
// If already downloading or ready, it returns without error.
// The onComplete callback is invoked on successful completion (e.g. to reinitialize engine).
func (m *ModelManager) StartDownload(onComplete func()) error {
	m.mu.Lock()
	if m.state == ModelStateDownloading {
		m.mu.Unlock()
		return nil
	}
	if m.state == ModelStateReady {
		m.mu.Unlock()
		if onComplete != nil {
			go onComplete()
		}
		return nil
	}

	if err := os.MkdirAll(m.modelDir, 0o755); err != nil {
		m.state = ModelStateError
		m.errorMessage = fmt.Sprintf("cannot create model dir: %v", err)
		m.mu.Unlock()
		return fmt.Errorf("creating model dir: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancelFunc = cancel
	m.state = ModelStateDownloading
	m.progress = 0.0
	m.downloadedBytes = 0
	m.errorMessage = ""
	baseURL := m.baseURL
	m.mu.Unlock()

	go m.downloadLoop(ctx, baseURL, onComplete)
	return nil
}

// CancelDownload terminates any ongoing download.
func (m *ModelManager) CancelDownload() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cancelFunc != nil {
		m.cancelFunc()
		m.cancelFunc = nil
	}
	if m.state == ModelStateDownloading {
		m.state = ModelStateIdle
		m.progress = 0.0
		m.errorMessage = "download cancelled"
	}
}

// downloadLoop executes sequential downloads of the 3 model components.
func (m *ModelManager) downloadLoop(ctx context.Context, baseURL string, onComplete func()) {
	files := []struct {
		name string
		size int64
	}{
		{TokenizerFileName, TokenizerApproxSize},
		{HeadFileName, HeadApproxSize},
		{EncoderFileName, EncoderApproxSize},
	}

	var totalBytes int64
	for _, f := range files {
		totalBytes += f.size
	}

	m.mu.Lock()
	m.totalBytes = totalBytes
	m.downloadedBytes = 0
	m.mu.Unlock()

	client := &http.Client{
		Timeout: 30 * time.Minute,
	}

	for _, f := range files {
		select {
		case <-ctx.Done():
			m.mu.Lock()
			m.state = ModelStateIdle
			m.errorMessage = "download cancelled"
			m.mu.Unlock()
			return
		default:
		}

		destPath := filepath.Join(m.modelDir, f.name)
		fileURL := fmt.Sprintf("%s/%s", baseURL, f.name)

		if err := m.downloadSingleFile(ctx, client, fileURL, destPath); err != nil {
			m.mu.Lock()
			m.state = ModelStateError
			m.errorMessage = fmt.Sprintf("failed downloading %s: %v", f.name, err)
			m.mu.Unlock()
			return
		}
	}

	m.mu.Lock()
	m.state = ModelStateReady
	m.progress = 100.0
	m.errorMessage = ""
	m.mu.Unlock()

	if onComplete != nil {
		onComplete()
	}
}

func (m *ModelManager) downloadSingleFile(ctx context.Context, client *http.Client, url, dest string) error {
	tmpPath := dest + ".part"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %s fetching %s", resp.Status, url)
	}

	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
		_ = os.Remove(tmpPath) // cleans up if not renamed
	}()

	pw := &progressWriter{
		writer: out,
		onProgress: func(n int) {
			m.mu.Lock()
			m.downloadedBytes += int64(n)
			if m.totalBytes > 0 {
				m.progress = float64(m.downloadedBytes) / float64(m.totalBytes) * 100.0
				if m.progress > 99.5 {
					m.progress = 99.5 // reserve 100% for complete validation
				}
			}
			m.mu.Unlock()
		},
	}

	if _, err := io.Copy(pw, resp.Body); err != nil {
		return err
	}

	if err := out.Close(); err != nil {
		return err
	}

	return os.Rename(tmpPath, dest)
}
