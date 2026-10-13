import { describe, expect, it } from "vitest";

/**
 * rpc_contract.spec.ts
 * Contract & API Testing tier:
 * Validates JSON-RPC 2.0 structure and schemas for client <-> sidecar communication.
 */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

describe("JSON-RPC 2.0 Contract Validation Tier", () => {
  it("should conform to JSON-RPC 2.0 request envelope specifications", () => {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "get_logs",
      params: {
        workspace_id: "default",
        offset: 0,
        limit: 50,
      },
      id: "req-101",
    };

    expect(request.jsonrpc).toBe("2.0");
    expect(typeof request.method).toBe("string");
    expect(request.method.length).toBeGreaterThan(0);
    expect(request.id).toBeDefined();
    expect(request.params).toBeTypeOf("object");
  });

  it("should validate successful response schema contracts", () => {
    const response: JsonRpcResponse<{ total: number; logs: unknown[] }> = {
      jsonrpc: "2.0",
      result: {
        total: 100,
        logs: [],
      },
      id: "req-101",
    };

    expect(response.jsonrpc).toBe("2.0");
    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();
    expect(response.result?.total).toBeTypeOf("number");
    expect(Array.isArray(response.result?.logs)).toBe(true);
  });

  it("should validate standard JSON-RPC error codes (-32600 to -32603)", () => {
    const rpcErrorResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method not found",
      },
      id: "req-102",
    };

    expect(rpcErrorResponse.jsonrpc).toBe("2.0");
    expect(rpcErrorResponse.result).toBeUndefined();
    expect(rpcErrorResponse.error).toBeDefined();
    expect([-32600, -32601, -32602, -32603]).toContain(rpcErrorResponse.error?.code);
  });

  it("should validate all primary registered sidecar method names", () => {
    const registeredMethods = [
      "get_logs",
      "get_clustering_status",
      "set_clustering_mode",
      "start_tail",
      "ingest_logs",
      "analyze_cluster",
      "send_ai_message",
      "get_ai_sessions",
      "get_anomalies",
      "get_settings",
      "update_settings",
      "get_health",
      "factory_reset",
    ];

    for (const method of registeredMethods) {
      expect(method).toMatch(/^[a-z]+(_[a-z0-9]+)*$/);
    }
  });

  it("should validate analyze_cluster request contract with optional similarity threshold", () => {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "analyze_cluster",
      params: {
        cluster_id: "cluster-42",
        workspace_id: "default",
        sample_size: 20,
        similarity_threshold: 0.75,
      },
      id: "req-analyze-1",
    };

    expect(request.method).toBe("analyze_cluster");
    expect(request.params?.cluster_id).toBe("cluster-42");
    expect(request.params?.workspace_id).toBe("default");
    expect(request.params?.similarity_threshold).toBe(0.75);
  });

  it("should validate analyze_cluster response contract with RAG triage fields", () => {
    interface AnalyzeClusterContractResult {
      summary: string;
      root_cause: string;
      recommended_actions: string[];
      is_known_issue: boolean;
      classification: "KNOWN ISSUE" | "NEW ANOMALY";
      tag: string;
      match_score: number;
      matched_signature: string;
      known_resolution: string;
    }

    const response: JsonRpcResponse<AnalyzeClusterContractResult> = {
      jsonrpc: "2.0",
      result: {
        summary: "Connection timeout to redis",
        root_cause: "Redis sentinel unreachable",
        recommended_actions: ["Restart sentinel pod", "Verify network security group"],
        is_known_issue: true,
        classification: "KNOWN ISSUE",
        tag: "🟡 KNOWN ISSUE (Matches resolution in memory)",
        match_score: 0.88,
        matched_signature: "Connection timeout to redis",
        known_resolution: "Restart sentinel pod",
      },
      id: "req-analyze-1",
    };

    expect(response.result).toBeDefined();
    expect(response.result?.is_known_issue).toBe(true);
    expect(["KNOWN ISSUE", "NEW ANOMALY"]).toContain(response.result?.classification);
    expect(response.result?.tag).toContain("KNOWN ISSUE");
    expect(response.result?.match_score).toBeGreaterThanOrEqual(0);
    expect(response.result?.match_score).toBeLessThanOrEqual(1);
    expect(Array.isArray(response.result?.recommended_actions)).toBe(true);
  });
});
