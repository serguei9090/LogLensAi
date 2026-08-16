/// JSON-RPC 2.0 envelope types, mirroring `backend-go/internal/models/rpc.go`
/// and `src/lib/hooks/useSidecarBridge.ts`'s `SidecarRequest`/`SidecarResponse`.
library;

import "dart:convert";

/// Outgoing request envelope: `{jsonrpc, id, method, params}`.
class JsonRpcRequest {
  const JsonRpcRequest({
    required this.id,
    required this.method,
    this.params = const <String, dynamic>{},
    this.jsonrpc = "2.0",
  });

  final String jsonrpc;
  final int id;
  final String method;
  final Map<String, dynamic> params;

  Map<String, dynamic> toJson() => {
    "jsonrpc": jsonrpc,
    "id": id,
    "method": method,
    "params": params,
  };

  /// Serializes to a single line of JSON with a trailing `\n`, matching the
  /// newline-delimited-JSON framing the Go stdio loop expects (one request
  /// per line, mirrors `src-tauri/src/sidecar.rs`'s `write_and_read`).
  String toLine() => "${jsonEncode(toJson())}\n";
}

/// Error object nested in a [JsonRpcResponse] on failure.
class RpcError implements Exception {
  const RpcError({required this.code, required this.message, this.data});

  final int code;
  final String message;
  final Object? data;

  factory RpcError.fromJson(Map<String, dynamic> json) => RpcError(
    code: (json["code"] as num?)?.toInt() ?? -32000,
    message: json["message"] as String? ?? "JSON-RPC Error",
    data: json["data"],
  );

  @override
  String toString() {
    if (data == null) return "RpcError($code): $message";
    return "RpcError($code): $message\n\nDetail:\n$data";
  }
}

/// Incoming response envelope: `{jsonrpc, id, result?, error?}`.
class JsonRpcResponse {
  const JsonRpcResponse({
    required this.jsonrpc,
    required this.id,
    this.result,
    this.error,
  });

  final String jsonrpc;
  final Object? id;
  final Object? result;
  final RpcError? error;

  factory JsonRpcResponse.fromJson(Map<String, dynamic> json) {
    final errJson = json["error"];
    return JsonRpcResponse(
      jsonrpc: json["jsonrpc"] as String? ?? "2.0",
      id: json["id"],
      result: json["result"],
      error: errJson is Map<String, dynamic>
          ? RpcError.fromJson(errJson)
          : null,
    );
  }
}
