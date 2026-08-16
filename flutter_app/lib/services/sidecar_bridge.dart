/// Dart port of `src/lib/hooks/useSidecarBridge.ts`'s `callSidecar` +
/// `src-tauri/src/sidecar.rs`'s `SidecarManager`.
///
/// Two transports, auto-selected:
///  - **stdio** (default, "desktop" mode): spawns the Go sidecar binary as a
///    subprocess and speaks newline-delimited JSON-RPC 2.0 over its
///    stdin/stdout, mirroring `SidecarManager::send_request` /
///    `write_and_read` in the old Rust shell (including its
///    respawn-on-death, retry-once-on-failure behavior).
///  - **http** ("web" mode fallback): POSTs the same JSON-RPC envelope to
///    `http://localhost:5000/rpc`, mirroring the TS bridge's non-Tauri path
///    (`VITE_APP_MODE=web` / no `__TAURI_INTERNALS__`). Used automatically
///    when the stdio executable can't be spawned (e.g. iterating against an
///    already-running `sidecar.exe --http` during dev), or explicitly via
///    [SidecarBridge.http].
library;

import "dart:async";
import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;

import "../models/json_rpc.dart";

/// Thrown for transport-level failures (process spawn/died, HTTP
/// unreachable) as opposed to [RpcError], which is a well-formed
/// `{code, message}` error the backend itself returned.
class SidecarTransportException implements Exception {
  SidecarTransportException(this.message, {this.cause});
  final String message;
  final Object? cause;

  @override
  String toString() =>
      "SidecarTransportException: $message${cause != null ? ' ($cause)' : ''}";
}

class SidecarBridge {
  /// Desktop/dev default: spawn `sidecar.exe --stdio` (or `--stdio
  /// --with-http` if you also want the HTTP surface up for tooling) as a
  /// child process and talk NDJSON over its pipes. Falls back to HTTP mode
  /// automatically if the executable can't be spawned.
  SidecarBridge({
    this.executable = "../backend-go/sidecar.exe",
    this.executableArgs = const ["--stdio"],
    this.httpUrl = "http://localhost:5000/rpc",
    this.workingDirectory,
    this.requestTimeout = const Duration(seconds: 30),
  }) : _forceHttp = false;

  /// Web/dev-iteration mode: talk directly to an already-running sidecar's
  /// HTTP surface, matching the React app's `VITE_APP_MODE=web` fallback.
  /// No subprocess is spawned in this mode.
  SidecarBridge.http({this.httpUrl = "http://localhost:5000/rpc", this.requestTimeout = const Duration(seconds: 30)})
    : executable = "",
      executableArgs = const [],
      workingDirectory = null,
      _forceHttp = true;

  final String executable;
  final List<String> executableArgs;
  final String httpUrl;
  final String? workingDirectory;
  final Duration requestTimeout;

  final bool _forceHttp;

  /// Once a stdio spawn attempt fails outright (binary missing, etc.) we
  /// stop retrying it for the lifetime of this bridge and fall back to HTTP
  /// permanently — mirrors "no subprocess available" web mode.
  bool _httpFallback = false;

  Process? _process;
  StreamSubscription<String>? _stdoutSub;
  StreamSubscription<List<int>>? _stderrSub;
  final Map<int, Completer<JsonRpcResponse>> _pending = {};
  int _nextId = 1;
  final http.Client _httpClient = http.Client();

  bool get isUsingHttp => _forceHttp || _httpFallback;
  bool get isProcessAlive => _process != null;

  /// Origin (scheme+host+port) of [httpUrl], e.g. `http://localhost:5000`
  /// for the default `http://localhost:5000/rpc`. Used by callers that need
  /// to hit sibling HTTP endpoints on the sidecar that aren't part of the
  /// JSON-RPC surface (e.g. `/api/stream_chat`'s SSE stream for AI chat).
  String get httpOrigin {
    final uri = Uri.parse(httpUrl);
    return "${uri.scheme}://${uri.host}:${uri.port}";
  }

  /// Exposes the underlying [http.Client] for callers that need to make
  /// raw HTTP requests against sidecar endpoints outside the JSON-RPC
  /// surface (see [httpOrigin]).
  http.Client get httpClient => _httpClient;

  /// Single entrypoint every RPC call goes through. [T] should match the
  /// shape of the backend's `result` for [method] (a `Map<String,dynamic>`,
  /// `List<dynamic>`, primitive, or `null`); callers deserialize into a
  /// typed model themselves (e.g. `LogEntry.fromJson`) since `result`'s
  /// shape varies per-method.
  Future<T> call<T>(String method, [Map<String, dynamic> params = const {}]) async {
    final id = _nextId++;
    final request = JsonRpcRequest(id: id, method: method, params: params);

    final response = (_forceHttp || _httpFallback)
        ? await _callHttp(request)
        : await _callStdioWithRetry(request);

    if (response.error != null) {
      throw response.error!;
    }
    return response.result as T;
  }

  // ── HTTP transport ──────────────────────────────────────────────────

  Future<JsonRpcResponse> _callHttp(JsonRpcRequest request) async {
    try {
      final resp = await _httpClient
          .post(
            Uri.parse(httpUrl),
            headers: {"Content-Type": "application/json"},
            body: jsonEncode(request.toJson()),
          )
          .timeout(requestTimeout);

      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        throw SidecarTransportException(
          "Sidecar HTTP Error: ${resp.statusCode} ${resp.reasonPhrase}",
        );
      }
      return JsonRpcResponse.fromJson(
        jsonDecode(resp.body) as Map<String, dynamic>,
      );
    } on SidecarTransportException {
      rethrow;
    } catch (e) {
      throw SidecarTransportException(
        "Failed to communicate with the sidecar over HTTP. Is it running?",
        cause: e,
      );
    }
  }

  // ── stdio transport ─────────────────────────────────────────────────

  /// Mirrors `SidecarManager::send_request`: ensure alive (spawn if not),
  /// attempt the write+read, and on failure respawn once and retry exactly
  /// once more before giving up.
  Future<JsonRpcResponse> _callStdioWithRetry(JsonRpcRequest request) async {
    try {
      await _ensureSpawned();
    } on SidecarTransportException {
      // Binary couldn't be started at all -- fall back to HTTP permanently,
      // matching "no subprocess available" web mode.
      _httpFallback = true;
      return _callHttp(request);
    }

    try {
      return await _writeAndRead(request);
    } catch (_) {
      // First attempt failed (dead pipe, process exited, etc). Respawn and
      // retry exactly once, mirroring the Rust manager's single retry.
      await _killProcess();
      await _ensureSpawned();
      return _writeAndRead(request);
    }
  }

  Future<void> _ensureSpawned() async {
    if (_process != null) return;
    try {
      final process = await Process.start(
        executable,
        executableArgs,
        workingDirectory: workingDirectory,
        runInShell: false,
      );
      _process = process;

      _stdoutSub = process.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(_handleLine, onError: (Object _) {}, onDone: _handleProcessDone);

      // Surface stderr for debugging without treating it as protocol data.
      _stderrSub = process.stderr.listen((bytes) {
        stderr.add(bytes);
      });

      unawaited(
        process.exitCode.then((_) {
          _handleProcessDone();
        }),
      );
    } catch (e) {
      _process = null;
      throw SidecarTransportException("Failed to spawn sidecar process", cause: e);
    }
  }

  void _handleLine(String line) {
    if (line.trim().isEmpty) return;
    Map<String, dynamic> json;
    try {
      json = jsonDecode(line) as Map<String, dynamic>;
    } catch (_) {
      return; // Not a JSON-RPC line (e.g. stray log output) -- ignore.
    }
    final response = JsonRpcResponse.fromJson(json);
    final id = response.id;
    final key = id is num ? id.toInt() : int.tryParse(id?.toString() ?? "");
    if (key == null) return;
    final completer = _pending.remove(key);
    completer?.complete(response);
  }

  void _handleProcessDone() {
    _process = null;
    // Any request still awaiting a reply on a dead pipe fails fast so
    // _callStdioWithRetry's catch block can respawn+retry immediately
    // instead of waiting out the full request timeout.
    for (final completer in _pending.values) {
      if (!completer.isCompleted) {
        completer.completeError(
          SidecarTransportException("Empty response from sidecar (process likely exited)"),
        );
      }
    }
    _pending.clear();
  }

  Future<JsonRpcResponse> _writeAndRead(JsonRpcRequest request) async {
    final process = _process;
    if (process == null) {
      throw SidecarTransportException("Sidecar process is not running");
    }

    final completer = Completer<JsonRpcResponse>();
    _pending[request.id] = completer;

    try {
      process.stdin.write(request.toLine());
      await process.stdin.flush();
    } catch (e) {
      _pending.remove(request.id);
      throw SidecarTransportException("Failed to write to sidecar stdin", cause: e);
    }

    return completer.future.timeout(
      requestTimeout,
      onTimeout: () {
        _pending.remove(request.id);
        throw SidecarTransportException(
          "Timed out waiting for sidecar response to '${request.method}'",
        );
      },
    );
  }

  Future<void> _killProcess() async {
    final process = _process;
    _process = null;
    await _stdoutSub?.cancel();
    await _stderrSub?.cancel();
    _stdoutSub = null;
    _stderrSub = null;
    process?.kill();
  }

  /// Releases the subprocess (if any) and the HTTP client. Call when the
  /// app shuts down or the bridge is no longer needed.
  Future<void> dispose() async {
    await _killProcess();
    _httpClient.close();
    _handleProcessDone();
  }
}
