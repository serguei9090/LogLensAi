package drain3

import (
	"fmt"
	"testing"
)

// BenchmarkDrain3Train measures throughput of log template mining under sequential load.
func BenchmarkDrain3Train(b *testing.B) {
	miner, err := NewMiner(DefaultConfig())
	if err != nil {
		b.Fatalf("NewMiner: %v", err)
	}

	sampleLogs := make([]string, 100)
	for i := 0; i < 100; i++ {
		sampleLogs[i] = fmt.Sprintf("2026-10-13 14:00:%02d [ERROR] worker-%d: connection dropped after %d ms", i%60, i%10, i*15)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		logLine := sampleLogs[i%len(sampleLogs)]
		_, _, _ = miner.Train(logLine)
	}
}

// BenchmarkDrain3Match measures lookup performance of matching incoming lines against existing clusters.
func BenchmarkDrain3Match(b *testing.B) {
	miner, err := NewMiner(DefaultConfig())
	if err != nil {
		b.Fatalf("NewMiner: %v", err)
	}

	// Seed with clusters
	for i := 0; i < 50; i++ {
		_, _, _ = miner.Train(fmt.Sprintf("2026-10-13 14:00:%02d [INFO] user-%d authenticated successfully", i%60, i))
	}

	testLine := "2026-10-13 14:00:25 [INFO] user-42 authenticated successfully"

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, _, _, _ = miner.Match(testLine)
	}
}
