package rpc

import (
	"bufio"
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"loglensai/backend-go/internal/models"
)

func TestRunStdioHappyPath(t *testing.T) {
	r := newTestRegistry()
	in := strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"get_health"}` + "\n")
	var out bytes.Buffer

	RunStdio(in, &out, r)

	lines := splitNonEmptyLines(t, &out)
	if len(lines) != 1 {
		t.Fatalf("got %d output lines, want 1: %q", len(lines), out.String())
	}
	var resp models.JSONRPCResponse
	if err := json.Unmarshal([]byte(lines[0]), &resp); err != nil {
		t.Fatalf("failed to decode response line: %v", err)
	}
	if resp.Error != nil {
		t.Fatalf("unexpected error: %+v", resp.Error)
	}
}

func TestRunStdioMalformedJSONThenValidLine(t *testing.T) {
	r := newTestRegistry()
	in := strings.NewReader(
		"not json at all\n" +
			`{"jsonrpc":"2.0","id":2,"method":"get_health"}` + "\n",
	)
	var out bytes.Buffer

	RunStdio(in, &out, r)

	lines := splitNonEmptyLines(t, &out)
	if len(lines) != 2 {
		t.Fatalf("got %d output lines, want 2 (one per input line): %q", len(lines), out.String())
	}

	var first models.JSONRPCResponse
	if err := json.Unmarshal([]byte(lines[0]), &first); err != nil {
		t.Fatalf("failed to decode first response line: %v", err)
	}
	if first.Error == nil || first.Error.Code != CodeParseError {
		t.Fatalf("first response error = %+v, want code %d", first.Error, CodeParseError)
	}
	if first.ID != nil {
		t.Errorf("id on parse error = %v, want nil", first.ID)
	}

	var second models.JSONRPCResponse
	if err := json.Unmarshal([]byte(lines[1]), &second); err != nil {
		t.Fatalf("failed to decode second response line: %v", err)
	}
	if second.Error != nil {
		t.Fatalf("unexpected error on valid line: %+v", second.Error)
	}
}

func TestRunStdioMissingMethodField(t *testing.T) {
	r := newTestRegistry()
	in := strings.NewReader(`{"jsonrpc":"2.0","id":9}` + "\n")
	var out bytes.Buffer

	RunStdio(in, &out, r)

	lines := splitNonEmptyLines(t, &out)
	if len(lines) != 1 {
		t.Fatalf("got %d output lines, want 1: %q", len(lines), out.String())
	}
	var resp models.JSONRPCResponse
	if err := json.Unmarshal([]byte(lines[0]), &resp); err != nil {
		t.Fatalf("failed to decode response line: %v", err)
	}
	if resp.Error == nil || resp.Error.Code != CodeInvalidRequest {
		t.Fatalf("error = %+v, want code %d", resp.Error, CodeInvalidRequest)
	}
	// id should be recovered from the parsed dict, per Python's ValidationError handler.
	if idFloat, ok := resp.ID.(float64); !ok || idFloat != 9 {
		t.Errorf("id = %v (%T), want 9", resp.ID, resp.ID)
	}
}

func TestRunStdioEOFExitsCleanly(t *testing.T) {
	r := newTestRegistry()
	in := strings.NewReader("")
	var out bytes.Buffer

	// Must return promptly with no output and no panic on immediate EOF.
	RunStdio(in, &out, r)

	if out.Len() != 0 {
		t.Errorf("expected no output on empty input, got %q", out.String())
	}
}

func TestRunStdioBlankLinesSkipped(t *testing.T) {
	r := newTestRegistry()
	in := strings.NewReader("\n\n" + `{"jsonrpc":"2.0","id":1,"method":"get_health"}` + "\n\n")
	var out bytes.Buffer

	RunStdio(in, &out, r)

	lines := splitNonEmptyLines(t, &out)
	if len(lines) != 1 {
		t.Fatalf("got %d output lines, want 1 (blank lines must be skipped): %q", len(lines), out.String())
	}
}

func splitNonEmptyLines(t *testing.T, buf *bytes.Buffer) []string {
	t.Helper()
	var lines []string
	sc := bufio.NewScanner(strings.NewReader(buf.String()))
	for sc.Scan() {
		l := strings.TrimSpace(sc.Text())
		if l != "" {
			lines = append(lines, l)
		}
	}
	return lines
}
