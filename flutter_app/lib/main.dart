import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:window_manager/window_manager.dart";

import "app.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Desktop window sizing (1280x720 per the Phase 5 spec). window_manager
  // only registers its platform channel on windows/macos/linux, matching
  // this project's `flutter create --platforms=windows,macos,linux` scaffold.
  await windowManager.ensureInitialized();
  const windowOptions = WindowOptions(
    size: Size(1280, 720),
    minimumSize: Size(960, 600),
    center: true,
    title: "LogLensAi",
    titleBarStyle: TitleBarStyle.normal,
  );
  unawaited(
    windowManager.waitUntilReadyToShow(windowOptions, () async {
      await windowManager.show();
      await windowManager.focus();
    }),
  );

  runApp(const ProviderScope(child: LogLensApp()));
}
