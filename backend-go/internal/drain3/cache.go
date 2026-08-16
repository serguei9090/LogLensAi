package drain3

import "container/list"

// clusterCache is a size-bounded (when maxSize > 0) least-recently-used
// cache of clusters keyed by cluster ID. It mirrors drain3.drain's use of
// cachetools.LRUCache (wrapped as LogClusterCache) for Drain.id_to_cluster:
// unlimited when max_clusters is None/0, otherwise evicting the
// least-recently-touched cluster once the cache is full.
//
//   - Get mirrors LogClusterCache.get(): a lookup that does NOT affect
//     recency, used by fastMatch when scoring candidate clusters (Python:
//     "Returns the value of the item... without updating the cache
//     eviction algorithm").
//   - Touch mirrors the recency side effect of plain `cache[key]` access in
//     Python (add_log_message does `self.id_to_cluster[cluster_id]` purely
//     for its LRU side effect after growing an existing cluster).
//   - Set mirrors `cache[key] = value`, which both inserts/updates AND
//     marks most-recently-used, evicting the LRU entry on overflow exactly
//     like cachetools.LRUCache's popitem-on-insert behavior.
//
// Eviction here does NOT reach into the prefix tree to remove the evicted
// cluster's ID from whichever leaf node(s) reference it — upstream drain3
// doesn't do that either. Stale IDs are instead filtered out lazily, the
// next time a new cluster is appended to that specific leaf (see
// tree.addSeqToPrefixTree's "clean up stale clusters" step) and via Get
// returning nil for an evicted ID (which fastMatch treats as "skip this
// candidate").
type clusterCache struct {
	maxSize int // 0 = unlimited
	ll      *list.List
	elems   map[int]*list.Element
	data    map[int]*LogCluster
}

func newClusterCache(maxSize int) *clusterCache {
	return &clusterCache{
		maxSize: maxSize,
		ll:      list.New(),
		elems:   make(map[int]*list.Element),
		data:    make(map[int]*LogCluster),
	}
}

// Get returns the cluster without updating recency, or nil if absent/evicted.
func (c *clusterCache) Get(id int) *LogCluster {
	return c.data[id]
}

// Touch marks id most-recently-used (if present) and returns its cluster.
func (c *clusterCache) Touch(id int) *LogCluster {
	if el, ok := c.elems[id]; ok {
		c.ll.MoveToFront(el)
	}
	return c.data[id]
}

// Set inserts or replaces a cluster and marks it most-recently-used. When
// the cache is at capacity, the least-recently-used entry is evicted and
// its ID returned (evicted=true).
func (c *clusterCache) Set(id int, cluster *LogCluster) (evictedID int, evicted bool) {
	if el, ok := c.elems[id]; ok {
		c.data[id] = cluster
		c.ll.MoveToFront(el)
		return 0, false
	}

	el := c.ll.PushFront(id)
	c.elems[id] = el
	c.data[id] = cluster

	if c.maxSize > 0 && len(c.data) > c.maxSize {
		back := c.ll.Back()
		if back != nil {
			evID, _ := back.Value.(int)
			c.ll.Remove(back)
			delete(c.elems, evID)
			delete(c.data, evID)
			return evID, true
		}
	}
	return 0, false
}

// Len returns the number of clusters currently tracked.
func (c *clusterCache) Len() int { return len(c.data) }

// Values returns all tracked clusters in unspecified order.
func (c *clusterCache) Values() []*LogCluster {
	out := make([]*LogCluster, 0, len(c.data))
	for _, v := range c.data {
		out = append(out, v)
	}
	return out
}
