package ingestion

import "sync"

// microBatchQueue is an unbounded, mutex-protected FIFO with a "full"
// signal, shared by FileTailer's flush loop (tailer.py's `queue.Queue` +
// `_flush_loop`, batching 500/100ms) and Server's ingestion flush worker
// (ingestion.py's `_log_queue` + `_run_flush_worker`, batching 1000/1s).
//
// Python's queue.Queue().get(timeout=...) blocks per-item with a rolling
// timeout that resets on every item pulled, so a fast-arriving burst never
// times out early. Reproducing that precisely in Go buys little: this
// instead signals "batch is full, flush now" as soon as push() reaches
// batchSize, and otherwise leaves periodic flushing to the caller's own
// ticker (see tailer.go/listeners.go) — functionally the same "N items or T
// time, whichever first" contract, just decomposed differently.
type microBatchQueue[T any] struct {
	batchSize int

	mu  sync.Mutex
	buf []T

	// wake is signaled (non-blocking, capacity 1 — extra pushes past the
	// threshold before the flush loop wakes up are coalesced into one
	// flush) once buf reaches batchSize.
	wake chan struct{}
}

func newMicroBatchQueue[T any](batchSize int) *microBatchQueue[T] {
	return &microBatchQueue[T]{
		batchSize: batchSize,
		wake:      make(chan struct{}, 1),
	}
}

// push appends item, signaling wake once the queue reaches batchSize.
func (q *microBatchQueue[T]) push(item T) {
	q.mu.Lock()
	q.buf = append(q.buf, item)
	full := len(q.buf) >= q.batchSize
	q.mu.Unlock()

	if full {
		select {
		case q.wake <- struct{}{}:
		default:
		}
	}
}

// drain atomically empties and returns the queue's current contents. A nil
// (not empty-but-non-nil) result means there was nothing to flush.
func (q *microBatchQueue[T]) drain() []T {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.buf) == 0 {
		return nil
	}
	out := q.buf
	q.buf = nil
	return out
}
