//go:build cgo

// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"fmt"

	ort "github.com/yalue/onnxruntime_go"
)

type realONNXRunner struct {
	encoderSession *ort.DynamicAdvancedSession
	headSession    *ort.DynamicAdvancedSession
}

func newONNXSessionRunner(cfg ONNXEngineConfig, encoderPath, headPath string) (onnxSessionRunner, error) {
	sharedLib := cfg.SharedLibPath
	if sharedLib == "" {
		sharedLib = resolveSharedLibPath()
	}
	if sharedLib != "" {
		ort.SetSharedLibraryPath(sharedLib)
	}

	if !ort.IsInitialized() {
		if err := ort.InitializeEnvironment(); err != nil {
			return nil, fmt.Errorf("laya: initializing onnxruntime: %w", err)
		}
	}

	sessOpts, err := ort.NewSessionOptions()
	if err != nil {
		return nil, fmt.Errorf("laya: creating session options: %w", err)
	}
	defer func() {
		if sessOpts != nil {
			_ = sessOpts.Destroy()
		}
	}()

	if cfg.Device == "gpu" {
		_ = sessOpts.AppendExecutionProviderDirectML(0)
	}

	encoderSess, err := ort.NewDynamicAdvancedSession(
		encoderPath,
		[]string{"input_ids", "attention_mask"},
		[]string{"last_hidden_state"},
		sessOpts,
	)
	if err != nil {
		return nil, fmt.Errorf("laya: loading encoder model %s: %w", encoderPath, err)
	}

	headSess, err := ort.NewDynamicAdvancedSession(
		headPath,
		[]string{"hidden_states"},
		[]string{"logits"},
		sessOpts,
	)
	if err != nil {
		_ = encoderSess.Destroy()
		return nil, fmt.Errorf("laya: loading head model %s: %w", headPath, err)
	}

	return &realONNXRunner{
		encoderSession: encoderSess,
		headSession:    headSess,
	}, nil
}

func (r *realONNXRunner) RunEncoder(inputIDs, attentionMask []int64, seqLen int, hiddenDim int64) ([]float32, error) {
	inputShape := ort.NewShape(1, int64(seqLen))
	inputIDsTensor, err := ort.NewTensor(inputShape, inputIDs)
	if err != nil {
		return nil, fmt.Errorf("creating input_ids tensor: %w", err)
	}
	defer inputIDsTensor.Destroy()

	attentionTensor, err := ort.NewTensor(inputShape, attentionMask)
	if err != nil {
		return nil, fmt.Errorf("creating attention_mask tensor: %w", err)
	}
	defer attentionTensor.Destroy()

	encoderOutShape := ort.NewShape(1, int64(seqLen), hiddenDim)
	encoderOutTensor, err := ort.NewEmptyTensor[float32](encoderOutShape)
	if err != nil {
		return nil, fmt.Errorf("creating encoder output tensor: %w", err)
	}
	defer encoderOutTensor.Destroy()

	err = r.encoderSession.Run(
		[]ort.Value{inputIDsTensor, attentionTensor},
		[]ort.Value{encoderOutTensor},
	)
	if err != nil {
		return nil, fmt.Errorf("running encoder: %w", err)
	}

	return encoderOutTensor.GetData(), nil
}

func (r *realONNXRunner) RunHead(maskEmbeddings []float32, numMasks int, hiddenDim int64) ([]float32, error) {
	headInShape := ort.NewShape(int64(numMasks), hiddenDim)
	headInTensor, err := ort.NewTensor(headInShape, maskEmbeddings)
	if err != nil {
		return nil, fmt.Errorf("creating head input tensor: %w", err)
	}
	defer headInTensor.Destroy()

	headOutShape := ort.NewShape(int64(numMasks), 1)
	headOutTensor, err := ort.NewEmptyTensor[float32](headOutShape)
	if err != nil {
		return nil, fmt.Errorf("creating head output tensor: %w", err)
	}
	defer headOutTensor.Destroy()

	err = r.headSession.Run(
		[]ort.Value{headInTensor},
		[]ort.Value{headOutTensor},
	)
	if err != nil {
		return nil, fmt.Errorf("running head session: %w", err)
	}

	return headOutTensor.GetData(), nil
}

func (r *realONNXRunner) Destroy() error {
	var err1, err2 error
	if r.encoderSession != nil {
		err1 = r.encoderSession.Destroy()
		r.encoderSession = nil
	}
	if r.headSession != nil {
		err2 = r.headSession.Destroy()
		r.headSession = nil
	}
	if err1 != nil {
		return err1
	}
	return err2
}
