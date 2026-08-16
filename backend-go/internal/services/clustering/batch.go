package clustering

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"

	"loglensai/backend-go/internal/db"
)

// hydratedRow is one batch row after raw_text is guaranteed present.
type hydratedRow struct {
	LogID       int64
	WorkspaceID string
	SourceID    string
	FacetsJSON  sql.NullString
	RawText     string
}

type clusterKey struct{ workspace, cluster, template string }
type sourceKey struct{ workspace, source string }

// processBatch runs one train-then-tag cycle over up to batchSize
// unprocessed rows and returns how many rows were consumed (0 means the
// backlog is empty). Mirrors ClusteringWorker._process_batch
// (clustering.py:664-739).
func (w *Worker) processBatch(batchSize int) (int, error) {
	rows, err := w.db.SelectUnprocessedLogs(batchSize)
	if err != nil {
		return 0, fmt.Errorf("clustering: select unprocessed logs: %w", err)
	}
	if len(rows) == 0 {
		return 0, nil
	}

	hydrated, updates := w.hydrateBatch(rows)

	// Phase 0 outcome: nothing hydrated (every row was MISSING). Still
	// apply the MISSING updates so those rows are marked processed and
	// don't jam the backlog forever, matching clustering.py:694-699.
	if len(hydrated) == 0 {
		if len(updates) > 0 {
			if err := w.applyResults(updates, nil, nil); err != nil {
				return 0, err
			}
		}
		return len(rows), nil
	}

	trainRows, tagRows := hydrated, []hydratedRow(nil)
	if len(hydrated) > TrainSampleSize {
		trainRows = hydrated[:TrainSampleSize]
		tagRows = hydrated[TrainSampleSize:]
	}

	clusterIncrements := map[clusterKey]int{}
	batchCounts := map[sourceKey]int{}

	// Phase 1: Train (sequential, tree-mutating).
	w.trainRows(trainRows, &updates, clusterIncrements, batchCounts)

	// Phase 2: Tag (parallel, read-only against the tree Phase 1 just
	// updated — see Worker's doc comment on why no cache-coherency
	// protocol is needed here, unlike clustering.py).
	if len(tagRows) > 0 {
		w.tagRowsParallel(tagRows, &updates, clusterIncrements, batchCounts)
	}

	// Phase 3: Aggregation.
	if err := w.applyResults(updates, clusterIncrements, batchCounts); err != nil {
		return 0, err
	}

	return len(rows), nil
}

// hydrateBatch splits rows into ones with raw_text already present and
// ones needing hydration via w.hydrator, grouped by source (mirrors the
// `sources_to_hydrate` grouping in
// ClusteringWorker._hydrate_batch_rows, clustering.py:278-301). Rows whose
// text can't be hydrated are turned into MISSING updates directly rather
// than retried — see LineHydrator's doc comment for why this doesn't
// replicate Python's cross-cycle quarantine/backoff.
func (w *Worker) hydrateBatch(rows []db.UnprocessedLog) ([]hydratedRow, []db.LogUpdate) {
	var hydrated []hydratedRow
	var updates []db.LogUpdate

	type pending struct {
		row    db.UnprocessedLog
		lineID int64
	}
	bySource := map[string][]pending{}

	for _, r := range rows {
		if r.RawText.Valid && r.RawText.String != "" {
			hydrated = append(hydrated, hydratedRow{
				LogID: r.ID, WorkspaceID: r.WorkspaceID, SourceID: r.SourceID,
				FacetsJSON: r.FacetsJSON, RawText: r.RawText.String,
			})
			continue
		}
		if !r.LineID.Valid || w.hydrator == nil {
			updates = append(updates, missingUpdate(r.ID))
			continue
		}
		bySource[r.SourceID] = append(bySource[r.SourceID], pending{row: r, lineID: r.LineID.Int64})
	}

	for sourceID, group := range bySource {
		lineIDs := make([]int64, len(group))
		for i, p := range group {
			lineIDs[i] = p.lineID
		}

		texts, err := w.hydrator.GetLines(sourceID, lineIDs)
		if err != nil {
			log.Printf("[ClusteringWorker] hydration failed for source %s: %v", sourceID, err)
			for _, p := range group {
				updates = append(updates, missingUpdate(p.row.ID))
			}
			continue
		}

		for _, p := range group {
			text, ok := texts[p.lineID]
			if !ok || text == "" {
				updates = append(updates, missingUpdate(p.row.ID))
				continue
			}
			hydrated = append(hydrated, hydratedRow{
				LogID: p.row.ID, WorkspaceID: p.row.WorkspaceID, SourceID: p.row.SourceID,
				FacetsJSON: p.row.FacetsJSON, RawText: text,
			})
		}
	}

	return hydrated, updates
}

func missingUpdate(logID int64) db.LogUpdate {
	return db.LogUpdate{
		Level:      sql.NullString{String: "MISSING", Valid: true},
		FacetsJSON: "{}",
		LogID:      logID,
	}
}

func errorUpdate(logID int64, existingFacetsJSON sql.NullString) db.LogUpdate {
	fj := "{}"
	if existingFacetsJSON.Valid && existingFacetsJSON.String != "" {
		fj = existingFacetsJSON.String
	}
	return db.LogUpdate{
		Level:      sql.NullString{String: "ERROR", Valid: true},
		FacetsJSON: fj,
		LogID:      logID,
	}
}

func decodeFacets(raw sql.NullString) map[string]string {
	out := map[string]string{}
	if raw.Valid && raw.String != "" {
		_ = json.Unmarshal([]byte(raw.String), &out)
	}
	return out
}

func nullableStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

// trainRows runs the sequential, tree-mutating Train() pass over rows,
// mirroring ClusteringWorker._train_batch / _train_single_row
// (clustering.py:590-620, :303-350).
func (w *Worker) trainRows(rows []hydratedRow, updates *[]db.LogUpdate, clusterIncrements map[clusterKey]int, batchCounts map[sourceKey]int) {
	for _, r := range rows {
		miner, err := w.miners(r.WorkspaceID)
		if err != nil || miner == nil {
			*updates = append(*updates, errorUpdate(r.LogID, r.FacetsJSON))
			continue
		}

		meta, err := w.metadata.Extract(r.WorkspaceID, r.SourceID, r.RawText, decodeFacets(r.FacetsJSON))
		if err != nil {
			*updates = append(*updates, errorUpdate(r.LogID, r.FacetsJSON))
			continue
		}

		clusterID, template, facets := miner.Train(meta.Message)
		for k, v := range facets {
			meta.Facets[k] = v
		}
		facetsJSON, _ := json.Marshal(meta.Facets)
		clusterIDStr := strconv.Itoa(clusterID)

		clusterIncrements[clusterKey{r.WorkspaceID, clusterIDStr, template}]++
		*updates = append(*updates, db.LogUpdate{
			Timestamp:  nullableStr(meta.Timestamp),
			Level:      nullableStr(meta.Level),
			FacetsJSON: string(facetsJSON),
			ClusterID:  sql.NullString{String: clusterIDStr, Valid: true},
			LogID:      r.LogID,
		})
		batchCounts[sourceKey{r.WorkspaceID, r.SourceID}]++
	}
}

// tagResult is one goroutine's outcome for a single row, consumed
// sequentially by tagRowsParallel to keep map writes (clusterIncrements,
// batchCounts) single-threaded.
type tagResult struct {
	row       hydratedRow
	err       bool
	clusterID string // "" means "extracted OK but no cluster matched"
	template  string
	meta      ExtractedMetadata
}

// tagRowsParallel runs the read-only Match() pass over rows using a
// goroutine worker pool, mirroring ClusteringWorker._tag_rows_parallel /
// _tag_log_batch (clustering.py:512-589, :128-170) minus the
// ProcessPoolExecutor snapshotting/versioning machinery (see Worker's doc
// comment).
//
// Matches Python's _tag_single_row behavior precisely on one subtlety: a
// row that extracts metadata successfully but doesn't match any cluster
// still gets an "ok" update (cluster_id left NULL) and still counts toward
// batchCounts/ingestion-job progress — only extraction/miner-lookup
// failures produce an "error" status. See
// _match_and_extract_parameters (clustering.py:51-73): a nil match
// yields (nil, nil), and _process_single_tag_result still appends an
// update row and bumps batch_counts for it (clustering.py:424-442),
// only skipping the cluster_increments bump.
func (w *Worker) tagRowsParallel(rows []hydratedRow, updates *[]db.LogUpdate, clusterIncrements map[clusterKey]int, batchCounts map[sourceKey]int) {
	jobs := make(chan hydratedRow)
	results := make(chan tagResult, len(rows))

	var wg sync.WaitGroup
	for i := 0; i < w.poolSize; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for r := range jobs {
				results <- w.tagOne(r)
			}
		}()
	}
	go func() {
		for _, r := range rows {
			jobs <- r
		}
		close(jobs)
	}()
	go func() {
		wg.Wait()
		close(results)
	}()

	for res := range results {
		if res.err {
			*updates = append(*updates, errorUpdate(res.row.LogID, res.row.FacetsJSON))
			continue
		}

		facetsJSON, _ := json.Marshal(res.meta.Facets)
		var clusterVal sql.NullString
		if res.clusterID != "" {
			clusterVal = sql.NullString{String: res.clusterID, Valid: true}
			clusterIncrements[clusterKey{res.row.WorkspaceID, res.clusterID, res.template}]++
		}

		*updates = append(*updates, db.LogUpdate{
			Timestamp:  nullableStr(res.meta.Timestamp),
			Level:      nullableStr(res.meta.Level),
			FacetsJSON: string(facetsJSON),
			ClusterID:  clusterVal,
			LogID:      res.row.LogID,
		})
		batchCounts[sourceKey{res.row.WorkspaceID, res.row.SourceID}]++
	}
}

// tagOne is the per-row work a tag-phase goroutine does: resolve the
// workspace's Miner, extract metadata, and Match() (read-only) against the
// live tree. Mirrors _tag_single_row + _match_and_extract_parameters
// (clustering.py:76-125, :51-73).
func (w *Worker) tagOne(r hydratedRow) tagResult {
	miner, err := w.miners(r.WorkspaceID)
	if err != nil || miner == nil {
		return tagResult{row: r, err: true}
	}

	meta, err := w.metadata.Extract(r.WorkspaceID, r.SourceID, r.RawText, decodeFacets(r.FacetsJSON))
	if err != nil {
		return tagResult{row: r, err: true}
	}

	clusterID, template, facets, ok := miner.Match(meta.Message)
	if ok {
		for k, v := range facets {
			meta.Facets[k] = v
		}
	}

	res := tagResult{row: r, meta: meta}
	if ok {
		res.clusterID = strconv.Itoa(clusterID)
		res.template = template
	}
	return res
}

// applyResults commits the accumulated LogUpdates + cluster count
// increments atomically via db.ApplyClusteringBatch, then updates
// ingestion job progress in its own transaction — mirroring
// ClusteringWorker._apply_batch_updates (single transaction,
// clustering.py:745-812) followed by _update_ingestion_jobs (its own
// commit, clustering.py:821-840). See ApplyClusteringBatch's doc comment
// for why the first step isn't a plain caller-managed transaction: it has
// to work around a real DuckDB engine limitation around indexed-column
// UPDATE...FROM statements.
func (w *Worker) applyResults(updates []db.LogUpdate, clusterIncrements map[clusterKey]int, batchCounts map[sourceKey]int) error {
	increments := make([]db.ClusterIncrement, 0, len(clusterIncrements))
	for k, count := range clusterIncrements {
		increments = append(increments, db.ClusterIncrement{
			WorkspaceID: k.workspace, ClusterID: k.cluster, Template: k.template, Count: count,
		})
	}

	if err := w.db.ApplyClusteringBatch(updates, increments); err != nil {
		return fmt.Errorf("clustering: applying batch: %w", err)
	}

	for k, count := range batchCounts {
		if err := w.db.UpdateIngestionJobProgress(k.workspace, k.source, count); err != nil {
			return fmt.Errorf("clustering: updating ingestion job progress: %w", err)
		}
	}
	return nil
}
