package drain3

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// clusterSnapshot is the on-disk representation of one LogCluster.
type clusterSnapshot struct {
	ID     int      `json:"id"`
	Tokens []string `json:"tokens"`
	Size   int      `json:"size"`
}

// snapshot is the full on-disk state of a Miner's tree: just the flat
// cluster list plus the ID counter.
//
// The prefix tree itself is deliberately NOT serialized — it is rebuilt
// from the cluster list on load by replaying addSeqToPrefixTree for each
// cluster. This is exactly the reconstruction trick drain3's own
// ProcessPoolExecutor-based tag workers use to rebuild a throwaway
// TemplateMiner from a plain cluster_map dict, because a child process
// can't share the parent's live tree
// (sidecar/src/workers/clustering.py:_tag_log_batch:
// `temp_miner.drain.id_to_cluster[c.cluster_id] = c;
// temp_miner.drain.add_seq_to_prefix_tree(temp_miner.drain.root_node, c)`).
//
// This is a deliberate divergence from upstream drain3's own
// FilePersistence format (jsonpickle + zlib + base64 of the entire Node
// tree, see .venv/Lib/site-packages/drain3/template_miner.py
// save_state/load_state): it does not need to be byte-compatible with old
// Python snapshots (this is a fresh Go-side state store, per the task
// brief), and reconstructing the tree from clusters is both simpler than
// porting jsonpickle's object graph format to Go and already proven
// correct by drain3's own worker-reconstruction code path above.
type snapshot struct {
	ClustersCounter int               `json:"clusters_counter"`
	Clusters        []clusterSnapshot `json:"clusters"`
}

// SaveToFile writes the Miner's current cluster state to path as JSON,
// creating parent directories as needed (mirrors parser.py's
// `os.makedirs(os.path.dirname(persistence_path), exist_ok=True)`,
// parser.py:34).
func (m *Miner) SaveToFile(path string) error {
	m.mu.RLock()
	snap := snapshot{ClustersCounter: m.tree.clustersCounter}
	for _, c := range m.tree.clusters.Values() {
		snap.Clusters = append(snap.Clusters, clusterSnapshot{ID: c.ID, Tokens: c.Tokens, Size: c.Size})
	}
	m.mu.RUnlock()

	data, err := json.Marshal(snap)
	if err != nil {
		return err
	}

	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return os.WriteFile(path, data, 0o644)
}

// LoadFromFile replaces the Miner's cluster state with the snapshot at
// path, rebuilding the prefix tree from the loaded clusters (see snapshot's
// doc comment). If the file does not exist, this is a no-op — mirrors
// drain3's FilePersistence.load_state returning None for a missing file,
// which TemplateMiner.load_state treats as "no saved state" and leaves the
// miner as freshly constructed (template_miner.py:69-75).
func (m *Miner) LoadFromFile(path string) error {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	var snap snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.tree.root = newNode()
	m.tree.clusters = newClusterCache(m.cfg.MaxClusters)
	m.tree.clustersCounter = snap.ClustersCounter

	for _, cs := range snap.Clusters {
		cluster := &LogCluster{ID: cs.ID, Tokens: cs.Tokens, Size: cs.Size}
		m.tree.clusters.Set(cluster.ID, cluster)
		m.tree.addSeqToPrefixTree(m.tree.root, cluster)
	}
	return nil
}
