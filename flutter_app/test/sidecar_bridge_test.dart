import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:loglensai/models/json_rpc.dart";

void main() {
  group("JsonRpcRequest", () {
    test("toJson produces a well-formed JSON-RPC 2.0 envelope", () {
      final req = JsonRpcRequest(
        id: 42,
        method: "get_health",
        params: const {"workspace_id": "ws-1"},
      );
      final json = req.toJson();
      expect(json["jsonrpc"], "2.0");
      expect(json["id"], 42);
      expect(json["method"], "get_health");
      expect(json["params"], {"workspace_id": "ws-1"});
    });

    test("toLine frames the request as a single newline-terminated JSON line", () {
      final req = JsonRpcRequest(id: 1, method: "get_health");
      final line = req.toLine();

      expect(line.endsWith("\n"), isTrue);
      expect("\n".allMatches(line).length, 1, reason: "must be exactly one line");

      final decoded = jsonDecode(line.trimRight()) as Map<String, dynamic>;
      expect(decoded["method"], "get_health");
      expect(decoded["id"], 1);
    });

    test("defaults params to an empty object when omitted", () {
      final req = JsonRpcRequest(id: 2, method: "get_health");
      expect(req.toJson()["params"], <String, dynamic>{});
    });
  });

  group("JsonRpcResponse", () {
    test("parses a successful response", () {
      final resp = JsonRpcResponse.fromJson({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {"status": "ok"},
      });
      expect(resp.error, isNull);
      expect((resp.result as Map)["status"], "ok");
    });

    test("parses an error response into a typed RpcError", () {
      final resp = JsonRpcResponse.fromJson({
        "jsonrpc": "2.0",
        "id": 1,
        "error": {"code": -32601, "message": "Method not found"},
      });
      expect(resp.result, isNull);
      expect(resp.error, isNotNull);
      expect(resp.error!.code, -32601);
      expect(resp.error!.message, "Method not found");
    });
  });
}
