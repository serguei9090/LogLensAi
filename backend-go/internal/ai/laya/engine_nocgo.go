//go:build !cgo

// Assume Role: The Backend Engineer (@backend)

package laya

import "fmt"

func newONNXSessionRunner(cfg ONNXEngineConfig, encoderPath, headPath string) (onnxSessionRunner, error) {
	return nil, fmt.Errorf("onnxruntime requires CGO support; build with CGO_ENABLED=1")
}
