package rag

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// KnowledgeWatcher monitors a local knowledge folder for new or modified documents/images
// and triggers incremental ingestion into the rag.Service.
type KnowledgeWatcher struct {
	workspaceID string
	folderPath  string
	service     *Service
	watcher     *fsnotify.Watcher
	stopCh      chan struct{}
	mu          sync.Mutex
	isScanning  bool
}

// NewKnowledgeWatcher initializes an fsnotify watcher on the target folder.
func NewKnowledgeWatcher(workspaceID, folderPath string, service *Service) (*KnowledgeWatcher, error) {
	if folderPath == "" {
		folderPath = "knowledge"
	}

	// Ensure root folder and Memory/ subfolder exist
	if err := os.MkdirAll(folderPath, 0755); err != nil {
		return nil, fmt.Errorf("rag: creating knowledge dir %s: %w", folderPath, err)
	}
	memDir := filepath.Join(folderPath, "Memory")
	if err := os.MkdirAll(memDir, 0755); err != nil {
		return nil, fmt.Errorf("rag: creating memory subfolder %s: %w", memDir, err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("rag: initializing fsnotify watcher: %w", err)
	}

	kw := &KnowledgeWatcher{
		workspaceID: workspaceID,
		folderPath:  folderPath,
		service:     service,
		watcher:     watcher,
		stopCh:      make(chan struct{}),
	}

	// Add knowledge dir and subfolders to watch
	if err := kw.addWatchRecursive(folderPath); err != nil {
		watcher.Close()
		return nil, err
	}

	return kw, nil
}

// Start begins the background event loop watching for file system changes.
func (kw *KnowledgeWatcher) Start() {
	go kw.eventLoop()
}

// Stop cleanly terminates the watcher.
func (kw *KnowledgeWatcher) Stop() {
	close(kw.stopCh)
	_ = kw.watcher.Close()
}

// ScanAll scans and indexes every supported file in the folder.
func (kw *KnowledgeWatcher) ScanAll(ctx context.Context) (totalFiles int, totalChunks int, err error) {
	kw.mu.Lock()
	if kw.isScanning {
		kw.mu.Unlock()
		return 0, 0, fmt.Errorf("rag: scan already in progress")
	}
	kw.isScanning = true
	kw.mu.Unlock()

	defer func() {
		kw.mu.Lock()
		kw.isScanning = false
		kw.mu.Unlock()
	}()

	err = filepath.Walk(kw.folderPath, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil || info == nil || info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		switch ext {
		case ".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg":
			chunks, ingestErr := kw.service.IngestKnowledgeFile(ctx, kw.workspaceID, path)
			if ingestErr != nil {
				log.Printf("[RAG] failed to ingest %s: %v", path, ingestErr)
			} else {
				totalFiles++
				totalChunks += chunks
			}
		}
		return nil
	})

	return totalFiles, totalChunks, err
}

func (kw *KnowledgeWatcher) eventLoop() {
	for {
		select {
		case <-kw.stopCh:
			return
		case event, ok := <-kw.watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create) != 0 {
				ext := strings.ToLower(filepath.Ext(event.Name))
				switch ext {
				case ".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg":
					ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
					_, _ = kw.service.IngestKnowledgeFile(ctx, kw.workspaceID, event.Name)
					cancel()
				}
			}
		case err, ok := <-kw.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[RAG] watcher error: %v", err)
		}
	}
}

func (kw *KnowledgeWatcher) addWatchRecursive(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return kw.watcher.Add(path)
		}
		return nil
	})
}
