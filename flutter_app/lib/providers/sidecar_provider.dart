import "package:flutter_riverpod/flutter_riverpod.dart";

import "../services/sidecar_bridge.dart";

/// App-wide singleton [SidecarBridge]. All 9 store providers read RPC calls
/// through this — swap it out (e.g. `sidecarBridgeProvider.overrideWithValue`)
/// in tests to inject a fake bridge.
final sidecarBridgeProvider = Provider<SidecarBridge>((ref) {
  final bridge = SidecarBridge();
  ref.onDispose(() {
    // Fire-and-forget: Provider.onDispose can't be async.
    // ignore: discarded_futures
    bridge.dispose();
  });
  return bridge;
});
