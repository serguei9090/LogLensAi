// Manual end-to-end smoke test: spawns the compiled Go sidecar over stdio
// via SidecarBridge and performs one real get_health round-trip. Not part
// of `flutter test` (needs a real subprocess) -- run manually with:
//   dart run tool/rpc_smoketest.dart
// ignore_for_file: avoid_print
import "package:loglensai/services/sidecar_bridge.dart";

Future<void> main() async {
  final bridge = SidecarBridge(
    executable: "../backend-go/sidecar.exe",
    executableArgs: ["--stdio"],
  );

  try {
    print("Calling get_health over stdio...");
    final result = await bridge.call<Map<String, dynamic>>("get_health", {});
    print("OK: isUsingHttp=${bridge.isUsingHttp} isProcessAlive=${bridge.isProcessAlive}");
    print("Result: $result");
  } catch (e) {
    print("FAILED: $e");
    rethrow;
  } finally {
    await bridge.dispose();
  }
}
