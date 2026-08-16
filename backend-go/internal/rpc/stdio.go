package rpc

import (
	"bufio"
	"encoding/json"
	"io"
	"log"
	"strings"

	"loglensai/backend-go/internal/models"
)

// RunStdio implements the newline-delimited JSON-RPC loop, mirroring
// run_stdio_async in sidecar/src/api.py: read one line at a time from in,
// treat each non-blank line as a single JSON object, Dispatch it, and write
// exactly one JSON line per response to out, flushing after every write
// (matching Python's `print(..., flush=True)`).
//
// Malformed JSON on a line does not crash the loop -- it emits a -32700
// Parse error response (id: null, matching Python, which cannot recover an
// id from unparseable input) and continues reading the next line. EOF on
// stdin ends the loop cleanly (the caller decides the process exit code;
// Python exits 0 via clean return from run_stdio_async).
func RunStdio(in io.Reader, out io.Writer, reg *Registry) {
	scanner := bufio.NewScanner(in)
	// Python's sys.stdin.readline() has no inherent line-length cap; large
	// JSON-RPC payloads (e.g. ingest_logs batches) are plausible, so raise
	// the scanner's buffer ceiling well past bufio's 64KiB default.
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 64*1024*1024)

	writer := bufio.NewWriter(out)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		raw := []byte(line)

		// First pass: syntax check, matching Python's json.loads(line) /
		// json.JSONDecodeError -> -32700 (id always null; unparseable input
		// has no id to recover).
		var generic map[string]any
		if err := json.Unmarshal(raw, &generic); err != nil {
			writeLine(writer, models.JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      nil,
				Error: &models.RPCError{
					Code:    CodeParseError,
					Message: "Parse error",
				},
			})
			continue
		}

		// Second pass: shape check, matching Python's JSONRPCRequest(**req_dict)
		// / pydantic.ValidationError -> -32600, with id recovered from the
		// already-parsed dict when available.
		var req models.JSONRPCRequest
		if err := json.Unmarshal(raw, &req); err != nil || req.Method == "" {
			writeLine(writer, models.JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      generic["id"],
				Error: &models.RPCError{
					Code:    CodeInvalidRequest,
					Message: "Invalid Request",
				},
			})
			continue
		}

		resp := reg.Dispatch(req)
		writeLine(writer, resp)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("rpc: stdio scanner error: %v", err)
	}
}

func writeLine(w *bufio.Writer, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("rpc: failed to marshal stdio response: %v", err)
		return
	}
	if _, err := w.Write(data); err != nil {
		log.Printf("rpc: failed to write stdio response: %v", err)
		return
	}
	if err := w.WriteByte('\n'); err != nil {
		log.Printf("rpc: failed to write stdio newline: %v", err)
		return
	}
	if err := w.Flush(); err != nil {
		log.Printf("rpc: failed to flush stdio writer: %v", err)
	}
}
