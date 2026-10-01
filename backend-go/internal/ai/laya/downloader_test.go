// Assume Role: The Automation Engineer (@test)

package laya

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func TestModelManager_StatusAndDownload(t *testing.T) {
	// 1. Setup mock HTTP server serving mock files
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/" + TokenizerFileName:
			_, _ = w.Write([]byte(`{"mock": "tokenizer"}`))
		case "/" + HeadFileName:
			_, _ = w.Write([]byte("mock_head_bytes_1234567890"))
		case "/" + HeadDataFileName:
			_, _ = w.Write([]byte("mock_head_data_bytes_1234567890"))
		case "/" + EncoderFileName:
			_, _ = w.Write([]byte("mock_encoder_bytes_1234567890_very_long"))
		case "/" + EncoderDataFileName:
			_, _ = w.Write([]byte("mock_encoder_data_bytes_1234567890_very_long"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	modelDir := filepath.Join(tmpDir, "models", "laya")

	mm := NewModelManager(modelDir)
	mm.SetBaseURL(server.URL)

	// 2. Initial state: not ready, state idle
	if mm.IsReady() {
		t.Fatalf("expected IsReady() = false initially")
	}
	status := mm.GetStatus()
	if status.State != ModelStateIdle {
		t.Errorf("expected state %s, got %s", ModelStateIdle, status.State)
	}

	// 3. Start download and wait for onComplete
	completed := make(chan bool, 1)
	err := mm.StartDownload(func() {
		completed <- true
	})
	if err != nil {
		t.Fatalf("StartDownload failed: %v", err)
	}

	select {
	case <-completed:
	case <-time.After(5 * time.Second):
		t.Fatalf("download timed out")
	}

	// 4. Verify status after completion
	if !mm.IsReady() {
		t.Fatalf("expected IsReady() = true after download")
	}
	finalStatus := mm.GetStatus()
	if finalStatus.State != ModelStateReady {
		t.Errorf("expected state %s, got %s", ModelStateReady, finalStatus.State)
	}
	if finalStatus.Progress != 100.0 {
		t.Errorf("expected progress 100.0, got %f", finalStatus.Progress)
	}

	// 5. Verify files exist on disk
	encPath, headPath, tokPath := mm.GetPaths()
	encDataPath := filepath.Join(modelDir, EncoderDataFileName)
	headDataPath := filepath.Join(modelDir, HeadDataFileName)
	if !fileExists(encPath) || !fileExists(encDataPath) || !fileExists(headPath) || !fileExists(headDataPath) || !fileExists(tokPath) {
		t.Errorf("expected all 5 model files to exist: enc=%v, encData=%v, head=%v, headData=%v, tok=%v",
			fileExists(encPath), fileExists(encDataPath), fileExists(headPath), fileExists(headDataPath), fileExists(tokPath))
	}

	// 6. Test idempotent StartDownload when already ready
	calledAgain := false
	err = mm.StartDownload(func() {
		calledAgain = true
	})
	if err != nil {
		t.Errorf("unexpected error on ready StartDownload: %v", err)
	}
	time.Sleep(50 * time.Millisecond)
	if !calledAgain {
		t.Errorf("expected onComplete called immediately when already ready")
	}
}

func TestModelManager_ErrorHandling(t *testing.T) {
	// Server returns 404 for all
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "file not found", http.StatusNotFound)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	mm := NewModelManager(tmpDir)
	mm.SetBaseURL(server.URL)

	err := mm.StartDownload(nil)
	if err != nil {
		t.Fatalf("StartDownload failed: %v", err)
	}

	// Wait briefly for error state
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		st := mm.GetStatus()
		if st.State == ModelStateError {
			if st.ErrorMessage == "" {
				t.Errorf("expected non-empty error message")
			}
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("expected state %s, timed out", ModelStateError)
}

func TestModelManager_CancelDownload(t *testing.T) {
	// Slow server
	blockCh := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-blockCh
		_, _ = w.Write([]byte("ok"))
	}))
	defer func() {
		close(blockCh)
		server.Close()
	}()

	tmpDir := t.TempDir()
	mm := NewModelManager(tmpDir)
	mm.SetBaseURL(server.URL)

	err := mm.StartDownload(nil)
	if err != nil {
		t.Fatalf("StartDownload failed: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	mm.CancelDownload()

	st := mm.GetStatus()
	if st.State != ModelStateIdle {
		t.Errorf("expected state %s after cancel, got %s", ModelStateIdle, st.State)
	}
}
