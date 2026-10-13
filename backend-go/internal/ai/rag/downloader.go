// Assume Role: The Backend Engineer (@backend)

package rag

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
	// Default RAG embedding model file names and approximate sizes
	RAGTokenizerFileName = "tokenizer.json"
	RAGModelFileName     = "model_int8.onnx"

	// Approximate sizes for progress reporting
	RAGTokenizerApproxSize int64 = 1500 * 1024       // ~1.5 MB
	RAGModelApproxSize     int64 = 310 * 1024 * 1024 // ~310 MB
	RAGTotalApproxSize     int64 = RAGTokenizerApproxSize + RAGModelApproxSize
)

// ModelDownloadState describes the current state of local RAG model files.
type ModelDownloadState string

const (
	ModelStateIdle        ModelDownloadState = "idle"
	ModelStateDownloading ModelDownloadState = "downloading"
	ModelStateReady       ModelDownloadState = "ready"
	ModelStateError       ModelDownloadState = "error"
)

// ModelStatus represents the JSON-RPC reportable status of RAG model weights.
type ModelStatus struct {
	State           ModelDownloadState `json:"state"`
	Progress        float64            `json:"progress"` // 0.0 - 100.0
	DownloadedBytes int64              `json:"downloaded_bytes"`
	TotalBytes      int64              `json:"total_bytes"`
	ErrorMessage    string             `json:"error_message,omitempty"`
	ModelDir        string             `json:"model_dir"`
	ModelPath       string             `json:"model_path"`
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

// ModelManager oversees discovery, status, and background downloading of RAG ONNX weights.
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
		totalBytes: RAGTotalApproxSize,
		baseURL:    fmt.Sprintf("https://huggingface.co/%s/resolve/%s", hfRepoID, hfRevision),
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

// GetPaths returns the resolved absolute paths for onnx model and tokenizer.
func (m *ModelManager) GetPaths() (modelPath, tokenizerPath string) {
	return filepath.Join(m.modelDir, "onnx", RAGModelFileName),
		filepath.Join(m.modelDir, RAGTokenizerFileName)
}

// RefreshStatus inspects the filesystem and updates the internal state.
func (m *ModelManager) RefreshStatus() ModelStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	model := filepath.Join(m.modelDir, "onnx", RAGModelFileName)
	tok := filepath.Join(m.modelDir, RAGTokenizerFileName)

	modelExists := fileExists(model)
	tokExists := fileExists(tok)

	if modelExists && tokExists {
		m.state = ModelStateReady
		m.progress = 100.0
		var totalSize int64
		for _, p := range []string{model, tok} {
			if fi, err := os.Stat(p); err == nil {
				totalSize += fi.Size()
			}
		}
		m.downloadedBytes = totalSize
		m.totalBytes = totalSize
	} else if m.state != ModelStateDownloading {
		m.state = ModelStateIdle
		m.progress = 0.0
		m.downloadedBytes = 0
		m.totalBytes = RAGTotalApproxSize
	}

	return ModelStatus{
		State:           m.state,
		Progress:        m.progress,
		DownloadedBytes: m.downloadedBytes,
		TotalBytes:      m.totalBytes,
		ErrorMessage:    m.errorMessage,
		ModelDir:        m.modelDir,
		ModelPath:       model,
		TokenizerPath:   tok,
	}
}

// GetStatus returns the current status without re-scanning disk if actively downloading.
func (m *ModelManager) GetStatus() ModelStatus {
	m.mu.RLock()
	if m.state == ModelStateDownloading {
		defer m.mu.RUnlock()
		model, tok := m.GetPaths()
		return ModelStatus{
			State:           m.state,
			Progress:        m.progress,
			DownloadedBytes: m.downloadedBytes,
			TotalBytes:      m.totalBytes,
			ErrorMessage:    m.errorMessage,
			ModelDir:        m.modelDir,
			ModelPath:       model,
			TokenizerPath:   tok,
		}
	}
	m.mu.RUnlock()
	return m.RefreshStatus()
}

// StartDownload initiates an asynchronous download of the model files.
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

	if err := os.MkdirAll(filepath.Join(m.modelDir, "onnx"), 0o755); err != nil {
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

// DeleteModel terminates any active download and deletes the local model files from disk.
func (m *ModelManager) DeleteModel() error {
	m.mu.Lock()
	if m.cancelFunc != nil {
		m.cancelFunc()
		m.cancelFunc = nil
	}
	m.state = ModelStateIdle
	m.progress = 0.0
	m.downloadedBytes = 0
	m.errorMessage = ""
	modelDir := m.modelDir
	m.mu.Unlock()

	if err := os.RemoveAll(modelDir); err != nil && !os.IsNotExist(err) {
		m.mu.Lock()
		m.state = ModelStateError
		m.errorMessage = fmt.Sprintf("failed deleting model dir: %v", err)
		m.mu.Unlock()
		return fmt.Errorf("deleting model dir: %w", err)
	}

	m.RefreshStatus()
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

// downloadLoop executes sequential downloads of the RAG model components.
func (m *ModelManager) downloadLoop(ctx context.Context, baseURL string, onComplete func()) {
	files := []struct {
		relPath string
		size    int64
	}{
		{RAGTokenizerFileName, RAGTokenizerApproxSize},
		{filepath.Join("onnx", RAGModelFileName), RAGModelApproxSize},
	}

	var totalReportedBytes int64
	for _, f := range files {
		totalReportedBytes += f.size
	}
	m.mu.Lock()
	m.totalBytes = totalReportedBytes
	m.mu.Unlock()

	var cumulativeBytes int64

	client := &http.Client{
		Timeout: 30 * time.Minute,
	}

	for _, item := range files {
		select {
		case <-ctx.Done():
			m.mu.Lock()
			m.state = ModelStateIdle
			m.errorMessage = "download aborted"
			m.mu.Unlock()
			return
		default:
		}

		targetPath := filepath.Join(m.modelDir, item.relPath)
		url := fmt.Sprintf("%s/%s", baseURL, filepath.ToSlash(item.relPath))

		err := m.downloadSingleFile(ctx, client, url, targetPath, &cumulativeBytes, totalReportedBytes)
		if err != nil {
			m.mu.Lock()
			m.state = ModelStateError
			m.errorMessage = fmt.Sprintf("failed downloading %s: %v", item.relPath, err)
			m.mu.Unlock()
			return
		}
	}

	m.mu.Lock()
	m.state = ModelStateReady
	m.progress = 100.0
	m.downloadedBytes = totalReportedBytes
	m.mu.Unlock()

	if onComplete != nil {
		go onComplete()
	}
}

func (m *ModelManager) downloadSingleFile(
	ctx context.Context,
	client *http.Client,
	url, targetPath string,
	cumulativeBytes *int64,
	totalBytes int64,
) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d from %s", resp.StatusCode, url)
	}

	partPath := targetPath + ".part"
	outFile, err := os.Create(partPath)
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}
	defer func() {
		_ = outFile.Close()
		_ = os.Remove(partPath)
	}()

	pw := &progressWriter{
		writer: outFile,
		onProgress: func(n int) {
			m.mu.Lock()
			*cumulativeBytes += int64(n)
			m.downloadedBytes = *cumulativeBytes
			if totalBytes > 0 {
				m.progress = float64(m.downloadedBytes) / float64(totalBytes) * 100.0
				if m.progress > 99.9 {
					m.progress = 99.9
				}
			}
			m.mu.Unlock()
		},
	}

	if _, err := io.Copy(pw, resp.Body); err != nil {
		return fmt.Errorf("writing body: %w", err)
	}

	if err := outFile.Close(); err != nil {
		return fmt.Errorf("closing temp file: %w", err)
	}

	if err := os.Rename(partPath, targetPath); err != nil {
		return fmt.Errorf("renaming file to destination: %w", err)
	}

	return nil
}
