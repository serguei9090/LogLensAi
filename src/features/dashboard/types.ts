export interface DashboardStats {
  total_logs: number;
  total_clusters: number;
  level_counts: Record<string, number>;
  top_clusters: { template: string; count: number }[];
  top_error_clusters: { template: string; count: number }[];
  time_series: any[];
  source_heatmap: {
    timestamp: string;
    source_id: string;
    source_name: string;
    count: number;
  }[];
  latest_ai_insight: string | null;
  new_patterns_count: number;
  workspace_count: number;
  active_tailers: number;
  bucket_interval?: string;
  time_bounds?: { min: string; max: string };
}
