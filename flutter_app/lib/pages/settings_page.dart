/// Dart port of `src/components/pages/SettingsPage.tsx`.
///
/// The React source is a thin wrapper: a `flex-1 overflow-auto` scroll
/// container around the lazily-loaded [SettingsPanel] organism (which does
/// all the real work -- section nav, every settings form, save/test-connection
/// flows). This port is equally thin, but does *not* add a second scroll
/// container around [SettingsPanel]: that organism already lays itself out
/// as a fixed-height nav column + its own internal `SingleChildScrollView`
/// content pane (`settings_panel.dart`'s `build`, a `Row` with
/// `CrossAxisAlignment.stretch`), so it needs a bounded-height ancestor the
/// same way the React version's `flex-1` flex child does -- wrapping it in
/// another `SingleChildScrollView` here would hand it unbounded height and
/// break that stretch layout. [Scaffold.body] already provides exactly the
/// bounded-height context it needs, matching `settings_panel_test.dart`'s
/// own wrapping convention.
///
/// The [SettingsPanel] organism already pulls everything it needs from
/// [settingsProvider] internally (see that organism's doc comment), so
/// there's no local state, no `onSave` callback to wire up, and no
/// lazy-loading concern (Flutter doesn't code-split at this granularity the
/// way Vite's `lazy()` does) -- just layout.
library;

import "package:flutter/material.dart";

import "../theme/app_theme.dart";
import "../widgets/organisms/settings_panel.dart";

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: const SettingsPanel(),
    );
  }
}
