package drain3

import "strings"

// LogCluster is a single Drain template cluster: a token sequence (with
// <*> wildcards inserted where tokens have diverged across matched lines)
// shared by every log line assigned to it. Mirrors drain3.drain.LogCluster.
type LogCluster struct {
	Tokens []string
	ID     int
	Size   int
}

// Template renders the cluster's token sequence back into the space-joined
// template string, e.g. "User <*> logged in from <*>". Mirrors
// LogCluster.get_template.
func (c *LogCluster) Template() string {
	return strings.Join(c.Tokens, " ")
}

func (c *LogCluster) clone() *LogCluster {
	tokens := make([]string, len(c.Tokens))
	copy(tokens, c.Tokens)
	return &LogCluster{Tokens: tokens, ID: c.ID, Size: c.Size}
}
