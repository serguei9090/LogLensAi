/// Dart port of `src/components/organisms/ImportFeedModal.tsx`.
///
/// 4-tab (Local/SSH/Manual/Live) log-import modal. Internal open/tab/field
/// state lives in [ingestionProvider] exactly like the React version reads
/// `useIngestionStore` directly (no local component state duplicating it);
/// the actual side-effecting import actions are exposed as required
/// callback props ([onImportLocal], [onImportSSH], [onIngestManual],
/// [onImportLive]) -- again mirroring the React source, which receives
/// these as props from `InvestigationPage`'s `useLogIngestion` hook rather
/// than calling `callSidecar` itself. That page-level orchestration hook
/// (workspace/source creation, job polling kickoff, tailing registration)
/// is out of scope for this organism -- it belongs to whichever page
/// composes this modal, not the modal itself.
///
/// Known quirk carried forward, not fixed (see STATUS.md's Phase 4
/// validation notes): manual-paste ingestion via `ingest_logs` never
/// creates an `ingestion_jobs` row, so the caller's job-completion polling
/// never observes it finishing. This is a pre-existing backend/frontend gap
/// reproduced identically against both the Go and Python sidecars -- out of
/// scope here, and this port doesn't attempt to paper over it.
///
/// Deviations from the React source:
///  - No OS-level drag-and-drop: Flutter has no `desktop_drop` (or similar)
///    dependency wired into `pubspec.yaml` yet, and Tauri's
///    `tauri://drag-drop` event has no Flutter-desktop equivalent. The Local
///    tab uses the already-built `NativeFilePicker` molecule (browse-only)
///    instead of a drop zone.
///  - The Live tab's two protocol toggles are `Container`+`InkWell` cards
///    rather than a full custom `Button` variant, and the "Configuration
///    Note" callout is a themed `Container` instead of the ad hoc orange
///    Tailwind classes -- same content/affordance, simplified chrome.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../providers/ingestion_provider.dart";
import "../../providers/settings_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";
import "../atoms/tail_switch.dart";
import "../molecules/native_file_picker.dart";
import "../molecules/source_selector.dart";

class ImportFeedModal extends ConsumerWidget {
  const ImportFeedModal({
    super.key,
    required this.onImportLocal,
    required this.onImportSSH,
    required this.onIngestManual,
    required this.onImportLive,
  });

  final void Function(String path, bool tail) onImportLocal;
  final void Function(
    String host,
    int port,
    String user,
    String pass,
    String path,
    bool tail,
  )
  onImportSSH;
  final void Function(String logs) onIngestManual;
  final void Function(String name, {required bool syslog, required bool http}) onImportLive;

  static const List<SourceSelectorOption> _tabs = [
    SourceSelectorOption(id: "local", icon: Icons.folder_open, label: "Files"),
    SourceSelectorOption(id: "ssh", icon: Icons.dns_outlined, label: "SSH"),
    SourceSelectorOption(id: "manual", icon: Icons.code, label: "Manual"),
    SourceSelectorOption(id: "live", icon: Icons.podcasts, label: "Live"),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(ingestionProvider);
    final notifier = ref.read(ingestionProvider.notifier);

    if (!state.isImportOpen) return const SizedBox.shrink();

    void close() {
      if (!state.isImportProcessing) notifier.setImportOpen(false);
    }

    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            onTap: close,
            child: Container(color: AppColors.bgBase.withValues(alpha: 0.9)),
          ),
        ),
        Center(
          child: Material(
            color: Colors.transparent,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.8)),
                  borderRadius: BorderRadius.circular(AppRadius.modal),
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _Header(processing: state.isImportProcessing, onClose: close),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
                      child: SourceSelector(
                        options: _tabs,
                        activeId: state.importActiveTab,
                        onSelect: notifier.setImportActiveTab,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 300),
                        child: _buildTab(state, notifier),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTab(IngestionState state, IngestionNotifier notifier) {
    switch (state.importActiveTab) {
      case "ssh":
        return _SshTab(state: state, notifier: notifier, onImportSSH: onImportSSH);
      case "manual":
        return _ManualTab(state: state, notifier: notifier, onIngestManual: onIngestManual);
      case "live":
        return _LiveTab(state: state, notifier: notifier, onImportLive: onImportLive);
      case "local":
      default:
        return _LocalTab(state: state, notifier: notifier, onImportLocal: onImportLocal);
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.processing, required this.onClose});

  final bool processing;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
        color: Color(0x08FFFFFF),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Ingest Source", style: AppTypography.h1.copyWith(fontSize: 17)),
                const SizedBox(height: 2),
                Text(
                  "Connect a data source for real-time analysis",
                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: "Close",
            icon: const Icon(Icons.close, size: 20),
            color: AppColors.textMuted,
            onPressed: processing ? null : onClose,
          ),
        ],
      ),
    );
  }
}

const _labelStyle = TextStyle(
  fontSize: 11,
  fontWeight: FontWeight.w700,
  letterSpacing: 0.6,
  color: AppColors.textMuted,
);

// ── Local ────────────────────────────────────────────────────────────────

class _LocalTab extends StatelessWidget {
  const _LocalTab({required this.state, required this.notifier, required this.onImportLocal});

  final IngestionState state;
  final IngestionNotifier notifier;
  final void Function(String path, bool tail) onImportLocal;

  @override
  Widget build(BuildContext context) {
    final processing = state.isImportProcessing;
    final path = state.importLocalPath;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text("SOURCE FILE", style: _labelStyle),
        const SizedBox(height: AppSpacing.sm),
        if (path.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border.withValues(alpha: 0.8)),
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: const Icon(Icons.description_outlined, color: AppColors.primary, size: 20),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        path.split(RegExp(r"[\\/]")).lastWhere((_) => true, orElse: () => path),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body.copyWith(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        path,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 16),
                  color: AppColors.textMuted,
                  onPressed: processing ? null : () => notifier.setImportLocalPath(""),
                ),
              ],
            ),
          )
        else
          IgnorePointer(
            ignoring: processing,
            child: Opacity(
              opacity: processing ? 0.5 : 1,
              child: NativeFilePicker(
                value: "",
                onChange: notifier.setImportLocalPath,
                placeholder: "Drag & drop, or click Browse to select a log file",
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.lg),
        const Divider(height: 1, color: AppColors.borderMuted),
        const SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TailSwitch(
              checked: state.importLocalTail,
              onChanged: notifier.setImportLocalTail,
              label: "Tail",
              disabled: processing,
            ),
            ElevatedButton.icon(
              onPressed: (path.trim().isEmpty || processing)
                  ? null
                  : () => onImportLocal(path.trim(), state.importLocalTail),
              icon: processing
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textInverse),
                    )
                  : const Icon(Icons.upload, size: 16),
              label: Text(processing ? "Processing..." : "Initialize"),
            ),
          ],
        ),
      ],
    );
  }
}

// ── SSH ──────────────────────────────────────────────────────────────────

class _SshTab extends StatelessWidget {
  const _SshTab({required this.state, required this.notifier, required this.onImportSSH});

  final IngestionState state;
  final IngestionNotifier notifier;
  final void Function(String host, int port, String user, String pass, String path, bool tail)
  onImportSSH;

  @override
  Widget build(BuildContext context) {
    final processing = state.isImportProcessing;
    final canConnect =
        !processing &&
        state.importSshHost.isNotEmpty &&
        state.importSshUser.isNotEmpty &&
        state.importSshPath.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: _field(
                label: "SECURE HOST",
                hint: "server.prod.local",
                value: state.importSshHost,
                onChanged: notifier.setImportSshHost,
                enabled: !processing,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _field(
                label: "PORT",
                value: state.importSshPort,
                onChanged: notifier.setImportSshPort,
                enabled: !processing,
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _field(
                label: "LOGIN USER",
                value: state.importSshUser,
                onChanged: notifier.setImportSshUser,
                enabled: !processing,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _field(
                label: "SECRET / KEY",
                hint: "••••••••",
                value: state.importSshPass,
                onChanged: notifier.setImportSshPass,
                enabled: !processing,
                obscureText: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        _field(
          label: "ABSOLUTE LOG PATH",
          hint: "/var/log/syslog",
          value: state.importSshPath,
          onChanged: notifier.setImportSshPath,
          enabled: !processing,
          mono: true,
        ),
        const SizedBox(height: AppSpacing.lg),
        const Divider(height: 1, color: AppColors.borderMuted),
        const SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TailSwitch(
              checked: state.importSshTail,
              onChanged: notifier.setImportSshTail,
              label: "Stream remotely",
              disabled: processing,
            ),
            ElevatedButton.icon(
              onPressed: canConnect
                  ? () => onImportSSH(
                      state.importSshHost,
                      int.tryParse(state.importSshPort) ?? 22,
                      state.importSshUser,
                      state.importSshPass,
                      state.importSshPath,
                      state.importSshTail,
                    )
                  : null,
              icon: processing
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textInverse),
                    )
                  : const Icon(Icons.terminal, size: 16),
              label: Text(processing ? "Connecting..." : "Connect"),
            ),
          ],
        ),
      ],
    );
  }

  static Widget _field({
    required String label,
    required String value,
    required ValueChanged<String> onChanged,
    required bool enabled,
    String? hint,
    bool obscureText = false,
    bool mono = false,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _labelStyle),
        const SizedBox(height: 6),
        TextField(
          enabled: enabled,
          obscureText: obscureText,
          keyboardType: keyboardType,
          controller: TextEditingController(text: value)
            ..selection = TextSelection.collapsed(offset: value.length),
          onChanged: onChanged,
          style: mono ? AppTypography.log.copyWith(fontSize: 12) : AppTypography.body.copyWith(fontSize: 13),
          decoration: InputDecoration(isDense: true, hintText: hint),
        ),
      ],
    );
  }
}

// ── Manual ───────────────────────────────────────────────────────────────

class _ManualTab extends StatelessWidget {
  const _ManualTab({required this.state, required this.notifier, required this.onIngestManual});

  final IngestionState state;
  final IngestionNotifier notifier;
  final void Function(String logs) onIngestManual;

  @override
  Widget build(BuildContext context) {
    final processing = state.isImportProcessing;
    final logs = state.importManualLogs;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        RichText(
          text: TextSpan(
            style: _labelStyle,
            children: const [
              TextSpan(text: "DIRECT PASTE  "),
              TextSpan(
                text: "— newline separated",
                style: TextStyle(fontWeight: FontWeight.w400, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          enabled: !processing,
          maxLines: 8,
          controller: TextEditingController(text: logs)
            ..selection = TextSelection.collapsed(offset: logs.length),
          onChanged: notifier.setImportManualLogs,
          style: AppTypography.log.copyWith(fontSize: 11),
          decoration: const InputDecoration(
            hintText:
                "[2024-03-27 10:00:00] INFO Engine started...\n"
                "[2024-03-27 10:00:01] ERROR Connection refused",
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: Alignment.centerRight,
          child: ElevatedButton.icon(
            onPressed: (logs.trim().isEmpty || processing)
                ? null
                : () => onIngestManual(logs.trim()),
            icon: processing
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textInverse),
                  )
                : const Icon(Icons.upload, size: 16),
            label: Text(processing ? "Processing..." : "Process Buffer"),
          ),
        ),
      ],
    );
  }
}

// ── Live ─────────────────────────────────────────────────────────────────

class _LiveTab extends ConsumerWidget {
  const _LiveTab({required this.state, required this.notifier, required this.onImportLive});

  final IngestionState state;
  final IngestionNotifier notifier;
  final void Function(String name, {required bool syslog, required bool http}) onImportLive;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final processing = state.isImportProcessing;
    final settings = ref.watch(settingsProvider).settings;
    final activeWorkspaceId = ref.watch(workspaceProvider).activeWorkspaceId;
    final name = state.importLiveName;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text("COLLECTION LABEL (TAB NAME)", style: _labelStyle),
        const SizedBox(height: 6),
        TextField(
          enabled: !processing,
          controller: TextEditingController(text: name)
            ..selection = TextSelection.collapsed(offset: name.length),
          onChanged: notifier.setImportLiveName,
          style: AppTypography.body.copyWith(fontSize: 13),
          decoration: const InputDecoration(isDense: true, hintText: "e.g. Production Cluster"),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: _ProtocolCard(
                icon: Icons.wifi,
                label: "Syslog (UDP)",
                description: "Passive listening on port 514",
                active: state.importLiveSyslog,
                enabled: !processing,
                onTap: () => notifier.setImportLiveSyslog(!state.importLiveSyslog),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _ProtocolCard(
                icon: Icons.http,
                label: "HTTP API",
                description: "POST endpoint on port 5002",
                active: state.importLiveHttp,
                enabled: !processing,
                onTap: () => notifier.setImportLiveHttp(!state.importLiveHttp),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.warning.withValues(alpha: 0.05),
            border: Border.all(color: AppColors.warning.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline, size: 18, color: AppColors.warning),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "CONFIGURATION NOTE",
                      style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.warning),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Ports are managed globally in Settings. All traffic matching the selected "
                      "protocols will be routed to this workspace using the label above.",
                      style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (state.importLiveHttp || state.importLiveSyslog) ...[
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.bgBase.withValues(alpha: 0.5),
              border: Border.all(color: AppColors.borderSubtle),
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("READY TO INGEST", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
                const SizedBox(height: AppSpacing.sm),
                if (state.importLiveHttp)
                  _endpointRow(
                    "HTTP ENDPOINT",
                    "POST http://localhost:${settings.ingestionHttpPort}/ingest/"
                        "$activeWorkspaceId/${name.isEmpty ? 'my-collection' : name}",
                  ),
                if (state.importLiveSyslog)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.sm),
                    child: _endpointRow(
                      "SYSLOG TARGET (UDP)",
                      "127.0.0.1:${settings.ingestionSyslogPort}",
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: Alignment.centerRight,
          child: ElevatedButton.icon(
            onPressed:
                (name.trim().isEmpty ||
                    (!state.importLiveSyslog && !state.importLiveHttp) ||
                    processing)
                ? null
                : () => onImportLive(
                    name.trim(),
                    syslog: state.importLiveSyslog,
                    http: state.importLiveHttp,
                  ),
            icon: processing
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textInverse),
                  )
                : const Icon(Icons.podcasts, size: 16),
            label: Text(processing ? "Starting..." : "Start Collection"),
          ),
        ),
      ],
    );
  }

  static Widget _endpointRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted),
        ),
        const SizedBox(height: 4),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: AppColors.bgSurface.withValues(alpha: 0.5),
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Text(
            value,
            style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.primary),
          ),
        ),
      ],
    );
  }
}

class _ProtocolCard extends StatelessWidget {
  const _ProtocolCard({
    required this.icon,
    required this.label,
    required this.description,
    required this.active,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String description;
  final bool active;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Material(
        color: active ? AppColors.primary.withValues(alpha: 0.05) : AppColors.bgSurface,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              border: Border.all(color: active ? AppColors.primary : AppColors.border),
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(icon, size: 20, color: active ? AppColors.primary : AppColors.textMuted),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary : AppColors.textMuted,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: active ? AppColors.primary : AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
