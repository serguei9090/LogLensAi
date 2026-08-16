/// Dart port of `src/components/organisms/AIInvestigationSidebar.tsx`.
///
/// The right-panel AI investigation chat: a resizable panel with a message
/// transcript (markdown + thinking blocks + A2UI-rendered widgets +
/// streaming typing indicator), session management (new/switch/rename), and
/// a bottom composer (multi-line input, send/stop, slash-command palette,
/// reasoning toggle).
///
/// Everything besides [onEngineSettingsOpen] and [onOpenHistorySearch] is
/// pulled from Riverpod providers ([aiProvider], [investigationProvider],
/// [workspaceProvider], [settingsProvider], [uiProvider]) rather than passed
/// down as props, mirroring the React source's store-driven design (it only
/// takes `onEngineSettingsOpen?`).
library;

import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/ai_session.dart";
import "../../models/ui_column.dart";
import "../../providers/ai_provider.dart";
import "../../providers/investigation_provider.dart";
import "../../providers/settings_provider.dart";
import "../../providers/ui_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";
import "../atoms/a2ui_renderer.dart";
import "../atoms/markdown_content.dart";
import "../atoms/thinking_block.dart";
import "../atoms/typing_indicator.dart";
import "ai_history_search_modal.dart";

/// Slash-command palette entries. Mirrors the React source's `AI_COMMANDS`.
const List<({String cmd, String label, String desc})> _kAiCommands = [
  (cmd: "/search", label: "Search Memory", desc: "Search previously saved issues"),
  (cmd: "/save", label: "Save Memory", desc: "Force save the current context as memory"),
  (cmd: "/query", label: "Query Logs", desc: "Search across active workspace logs"),
  (cmd: "/analyze", label: "Analyze Cluster", desc: "Perform deep-dive analysis on a log pattern"),
  (cmd: "/anomalies", label: "Find Anomalies", desc: "Scan workspace for statistical outliers"),
  (cmd: "/create_column", label: "Create Column", desc: "Ask AI to create a custom column"),
  (cmd: "/create_facet", label: "Create Facet", desc: "Ask AI to extract a custom facet (mask)"),
];

// ── `parseThinking` port ────────────────────────────────────────────────
//
// Extracts `<think>...</think>` (and several other reasoning-tag dialects
// emitted by different local models) from a message's raw content, and
// strips A2UI `[[A2UI]]...[[/A2UI]]` tags from the visible response. Port
// of the React source's module-level `parseThinking`/`stripChannelTags`/
// `stripA2UITags`/`findFirstTagIndex` helpers.

const List<String> _kChannelTags = [
  "<|channel>thought",
  "<|channel|>thought",
  "<|channel>text",
  "<|channel|>text",
  "<channel|>",
  "<|think|>",
  "<|thought|>",
  "<|text|>",
];

String _stripChannelTags(String text) {
  var result = text;
  for (final tag in _kChannelTags) {
    result = result.replaceAll(tag, "");
  }
  return result;
}

final RegExp _kA2uiTagRe = RegExp(r"\[\[A2UI\]\].*?(\[\[/A2UI\]\]|$)", dotAll: true);

String _stripA2uiTags(String text) => text.replaceAll(_kA2uiTagRe, "").trim();

const List<String> _kThinkStartTags = [
  "<think>",
  "<|channel>thought",
  "<|channel|>thought",
  "<|thought|>",
  "[reasoning]",
];

const List<String> _kThinkEndTags = [
  "</think>",
  "<|channel>text",
  "<|channel|>text",
  "<channel|>",
  "<|text|>",
  "[/reasoning]",
];

({int index, int length}) _findFirstTagIndex(
  String content,
  List<String> tags, [
  int startFrom = 0,
]) {
  var firstIdx = -1;
  var tagLen = 0;
  for (final tag in tags) {
    final idx = content.indexOf(tag, startFrom);
    if (idx != -1 && (firstIdx == -1 || idx < firstIdx)) {
      firstIdx = idx;
      tagLen = tag.length;
    }
  }
  return (index: firstIdx, length: tagLen);
}

class _ParsedThinking {
  const _ParsedThinking({required this.thinking, required this.response, required this.isStreamingThink});
  final String? thinking;
  final String response;
  final bool isStreamingThink;
}

/// Splits raw assistant [content] into `(thinking, response,
/// isStreamingThink)`. Kept file-private (unlike the React source's
/// exported `parseThinking`) since this file is the sole owner of the
/// parsing logic and nothing outside it needs to call in.
_ParsedThinking _parseThinking(String content) {
  if (content.isEmpty) {
    return const _ParsedThinking(thinking: null, response: "", isStreamingThink: false);
  }

  final start = _findFirstTagIndex(content, _kThinkStartTags);
  final searchStart = start.index == -1 ? 0 : start.index + start.length;
  final end = _findFirstTagIndex(content, _kThinkEndTags, searchStart);

  if (end.index != -1) {
    final prefix = start.index == -1 ? "" : content.substring(0, start.index);
    var thinking = start.index == -1
        ? content.substring(0, end.index)
        : content.substring(start.index + start.length, end.index);
    var response = prefix + content.substring(end.index + end.length);

    thinking = _stripChannelTags(thinking);
    response = _stripChannelTags(response);

    for (final tag in [..._kThinkStartTags, ..._kThinkEndTags]) {
      response = response.replaceAll(tag, "");
      thinking = thinking.replaceAll(tag, "");
    }

    final trimmedThinking = thinking.trim();
    return _ParsedThinking(
      thinking: trimmedThinking.isEmpty ? null : trimmedThinking,
      response: _stripA2uiTags(response.trim()),
      isStreamingThink: false,
    );
  }

  if (start.index != -1) {
    final thinkingContent = _stripChannelTags(content.substring(start.index + start.length));
    return _ParsedThinking(
      thinking: thinkingContent,
      response: content.substring(0, start.index).trim(),
      isStreamingThink: true,
    );
  }

  return _ParsedThinking(
    thinking: null,
    response: _stripA2uiTags(_stripChannelTags(content)),
    isStreamingThink: false,
  );
}

/// The right-panel AI investigation chat interface.
///
/// Renders nothing when `aiProvider`'s `isSidebarOpen` is false, matching
/// the React source's `if (!isSidebarOpen) return null;` early exit.
class AIInvestigationSidebar extends ConsumerStatefulWidget {
  const AIInvestigationSidebar({super.key, this.onEngineSettingsOpen, this.onOpenHistorySearch});

  /// Opens the engine/model settings surface. Mirrors the React prop of the
  /// same name exactly (it's the *only* prop the React component takes).
  final VoidCallback? onEngineSettingsOpen;

  /// Opens the full session search/history UI. React mounts
  /// `AIHistorySearchModal` unconditionally with local `isSearchModalOpen`
  /// state; this port's `AIHistorySearchModal` is dialog-based
  /// (`AIHistorySearchModal.show(context)`, see `ai_history_search_modal.dart`)
  /// so by default "Show N more…" opens it directly. This callback exists
  /// purely as a test/embedding seam -- when supplied, it's called instead
  /// of pushing the dialog route (handy for widget tests that don't want a
  /// real `Navigator`/`MaterialApp` route stack involved).
  final VoidCallback? onOpenHistorySearch;

  @override
  ConsumerState<AIInvestigationSidebar> createState() => _AIInvestigationSidebarState();
}

class _AIInvestigationSidebarState extends ConsumerState<AIInvestigationSidebar> {
  final TextEditingController _inputController = TextEditingController();
  final FocusNode _inputFocusNode = FocusNode();
  final TextEditingController _titleController = TextEditingController();
  final FocusNode _titleFocusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();

  bool _isEditingTitle = false;
  String _pendingSessionName = "";
  bool _showCommands = false;
  bool _isReasoningEnabled = true;

  @override
  void initState() {
    super.initState();
    _inputController.addListener(_handleInputChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _maybeFetchInitialData();
    });
  }

  @override
  void dispose() {
    _inputController.removeListener(_handleInputChanged);
    _inputController.dispose();
    _inputFocusNode.dispose();
    _titleController.dispose();
    _titleFocusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _handleInputChanged() {
    final val = _inputController.text;
    final shouldShow = val.startsWith("/");
    if (shouldShow != _showCommands) {
      setState(() => _showCommands = shouldShow);
    } else {
      // Refresh so the send-button enabled state and command filter react
      // to keystrokes even when _showCommands doesn't flip.
      setState(() {});
    }
  }

  String _generateDefaultName() {
    final rand = 100000 + DateTime.now().microsecondsSinceEpoch % 900000;
    return "LOG-$rand";
  }

  String get _effectivePendingName {
    if (_pendingSessionName.isEmpty) {
      _pendingSessionName = _generateDefaultName();
    }
    return _pendingSessionName;
  }

  void _maybeFetchInitialData() {
    final aiState = ref.read(aiProvider);
    if (!aiState.isSidebarOpen) return;
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    if (workspaceId.isNotEmpty) {
      unawaited(ref.read(aiProvider.notifier).fetchSessions(workspaceId));
    }
  }

  // ── A2UI action dispatch (mirrors handleA2UIAction) ─────────────────

  void _handleA2UIAction(Map<String, dynamic>? action) {
    final type = action?["type"] as String?;
    if (type == null) return;

    switch (type) {
      case "filter":
        final field = action!["field"] as String?;
        final value = action["value"];
        if (field != null && value != null) {
          ref.read(investigationProvider.notifier).setFilters([
            {
              "id": DateTime.now().millisecondsSinceEpoch.toString(),
              "field": field,
              "value": value,
              "operator": action["operator"] as String? ?? "equals",
            },
          ]);
        }
      case "search":
        final query = action!["query"] as String?;
        if (query != null) {
          ref.read(investigationProvider.notifier).setSearchQuery(query);
        }
      case "command":
        final command = action!["command"] as String?;
        if (command != null) {
          _inputController.text = command;
          _inputFocusNode.requestFocus();
        }
      case "add_column":
        final label = action!["label"] as String?;
        if (label != null) {
          final colId = action["id"] as String? ?? "col-${DateTime.now().millisecondsSinceEpoch}";
          final exists = ref.read(uiProvider).customColumns.any((c) => c.id == colId);
          if (!exists) {
            ref.read(uiProvider.notifier).addCustomColumn(
              CustomColumnDef(
                id: colId,
                label: label,
                width: action["width"] as String? ?? "120px",
                source: action["source"] as String? ?? "user",
                regex: action["regex"] as String?,
              ),
            );
          }
        }
      default:
        // Unhandled A2UI action -- graceful no-op (mirrors React's
        // `console.warn("Unhandled A2UI action:", a)`).
        break;
    }
  }

  // ── Send / rename / new-session handlers ─────────────────────────────

  Future<void> _handleSend() async {
    final text = _inputController.text;
    final workspace = ref.read(workspaceProvider).activeWorkspace;
    if (text.trim().isEmpty || workspace == null) return;

    _inputController.clear();
    setState(() => _showCommands = false);

    final aiState = ref.read(aiProvider);
    final settings = ref.read(settingsProvider).settings;
    final selectedLogIds = ref.read(investigationProvider).selectedLogIds;

    await ref.read(aiProvider.notifier).sendMessage(
      SendMessageParams(
        workspaceId: workspace.id,
        message: text,
        contextLogs: selectedLogIds,
        model: settings.aiModel,
        sessionName: aiState.currentSessionId == null ? _effectivePendingName : null,
        reasoning: _isReasoningEnabled,
      ),
    );

    if (selectedLogIds.isNotEmpty) {
      ref.read(investigationProvider.notifier).clearSelection();
    }
  }

  Future<void> _handleRename() async {
    final newTitle = _titleController.text.trim();
    if (newTitle.isEmpty) {
      setState(() => _isEditingTitle = false);
      return;
    }

    final aiState = ref.read(aiProvider);
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    if (aiState.currentSessionId != null && workspaceId.isNotEmpty) {
      await ref.read(aiProvider.notifier).renameSession(
        aiState.currentSessionId!,
        newTitle,
        workspaceId,
      );
    } else {
      _pendingSessionName = newTitle;
    }
    if (mounted) setState(() => _isEditingTitle = false);
  }

  void _handleNewSession() {
    ref.read(aiProvider.notifier).setSession(null);
    setState(() {
      _pendingSessionName = _generateDefaultName();
      _isEditingTitle = false;
    });
  }

  void _startEditingTitle(String currentTitle) {
    _titleController.text = currentTitle;
    setState(() => _isEditingTitle = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _titleFocusNode.requestFocus();
    });
  }

  // ── Resize handle ─────────────────────────────────────────────────────

  void _handleResizeDrag(DragUpdateDetails details) {
    final current = ref.read(aiProvider).sidebarWidth;
    // Panel sits at the right edge of the screen, drag handle is on its
    // *left* edge -- dragging left (negative dx) grows the panel, mirrors
    // the React source's `window.innerWidth - e.clientX` computation.
    final next = (current - details.delta.dx).clamp(320.0, 800.0);
    ref.read(aiProvider.notifier).setSidebarWidth(next);
  }

  // ── Scroll-to-bottom ──────────────────────────────────────────────────

  void _scrollToBottom({required bool animate}) {
    if (!mounted || !_scrollController.hasClients) return;
    final target = _scrollController.position.maxScrollExtent;
    if (animate) {
      _scrollController.animateTo(
        target,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    } else {
      _scrollController.jumpTo(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSidebarOpen = ref.watch(aiProvider.select((s) => s.isSidebarOpen));

    // Session-switch -> instant scroll; new/streaming messages -> smooth
    // scroll. Mirrors the React source's two separate scroll effects.
    ref.listen<String?>(aiProvider.select((s) => s.currentSessionId), (prev, next) {
      if (prev != next) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom(animate: false));
      }
    });
    ref.listen<int>(aiProvider.select((s) => s.messages.length), (prev, next) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom(animate: true));
    });
    ref.listen<String>(
      aiProvider.select((s) => s.messages.isEmpty ? "" : s.messages.last.content),
      (prev, next) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom(animate: true));
      },
    );
    ref.listen<bool>(aiProvider.select((s) => s.isSidebarOpen), (prev, next) {
      if (next && prev != true) _maybeFetchInitialData();
    });

    if (!isSidebarOpen) {
      return const SizedBox.shrink();
    }

    final sidebarWidth = ref.watch(aiProvider.select((s) => s.sidebarWidth));

    return SizedBox(
      width: sidebarWidth,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            decoration: const BoxDecoration(
              color: AppColors.bgApp,
              border: Border(left: BorderSide(color: AppColors.borderSubtle)),
            ),
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(child: _buildBody(context)),
                _buildFooter(context),
              ],
            ),
          ),
          Positioned(
            left: -2,
            top: 0,
            bottom: 0,
            width: 4,
            child: MouseRegion(
              cursor: SystemMouseCursors.resizeLeftRight,
              child: GestureDetector(
                key: const Key("aiSidebarResizeHandle"),
                behavior: HitTestBehavior.translucent,
                onHorizontalDragUpdate: _handleResizeDrag,
                child: const SizedBox.expand(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────────

  Widget _buildHeader(BuildContext context) {
    final currentSessionId = ref.watch(aiProvider.select((s) => s.currentSessionId));
    final sessions = ref.watch(aiProvider.select((s) => s.sessions));
    AiSession? currentSession;
    for (final s in sessions) {
      if (s.sessionId == currentSessionId) {
        currentSession = s;
        break;
      }
    }
    final displayTitle = currentSession?.name.isNotEmpty == true
        ? currentSession!.name
        : (_pendingSessionName.isNotEmpty ? _pendingSessionName : "Investigation Hub");

    return Container(
      height: 65,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.accentVioletBg,
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            child: const Icon(Icons.auto_awesome, size: 16, color: AppColors.accentViolet),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_isEditingTitle)
                  TextField(
                    key: const Key("aiSidebarTitleField"),
                    controller: _titleController,
                    focusNode: _titleFocusNode,
                    style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    ),
                    onSubmitted: (_) => _handleRename(),
                    onTapOutside: (_) => _handleRename(),
                  )
                else
                  InkWell(
                    onTap: () => _startEditingTitle(displayTitle),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            displayTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.edit, size: 12, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                Text(
                  currentSessionId != null ? "Active Session" : "New Investigation",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelCaps.copyWith(
                    fontSize: 9,
                    color: AppColors.textMuted.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: "New Investigation",
            icon: const Icon(Icons.add, size: 18),
            color: AppColors.textMuted,
            onPressed: _handleNewSession,
          ),
          IconButton(
            tooltip: "Engine Settings",
            icon: const Icon(Icons.memory, size: 18),
            color: AppColors.textMuted,
            onPressed: widget.onEngineSettingsOpen,
          ),
          IconButton(
            key: const Key("aiSidebarCloseButton"),
            tooltip: "Close",
            icon: const Icon(Icons.close, size: 18),
            color: AppColors.textMuted,
            onPressed: () => ref.read(aiProvider.notifier).setSidebarOpen(false),
          ),
        ],
      ),
    );
  }

  // ── Body (empty state / recent sessions / message list) ─────────────

  Widget _buildBody(BuildContext context) {
    final messages = ref.watch(aiProvider.select((s) => s.messages));
    final isLoading = ref.watch(aiProvider.select((s) => s.isLoading));
    final sessions = ref.watch(aiProvider.select((s) => s.sessions));

    return SingleChildScrollView(
      controller: _scrollController,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: messages.isEmpty
          ? _buildEmptyState(context, sessions)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < messages.length; i++)
                  _MessageRow(
                    message: messages[i],
                    prevRole: i > 0 ? messages[i - 1].role : null,
                    isLoading: isLoading,
                    isLastMessage: i == messages.length - 1,
                    onA2UIAction: _handleA2UIAction,
                  ),
              ],
            ),
    );
  }

  Widget _buildEmptyState(BuildContext context, List<AiSession> sessions) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 16),
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.05),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
          ),
          child: Icon(Icons.forum_outlined, size: 32, color: AppColors.primary.withValues(alpha: 0.2)),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          "AI Investigator Ready",
          style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Text(
            "Select logs to start a context-aware analysis or resume a previous investigation.",
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textMuted, height: 1.6),
          ),
        ),
        if (sessions.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xl + AppSpacing.lg),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              "RECENT INVESTIGATIONS",
              style: AppTypography.labelCaps.copyWith(color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final s in sessions.take(4)) _RecentSessionCard(session: s),
          if (sessions.length > 4)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    if (widget.onOpenHistorySearch != null) {
                      widget.onOpenHistorySearch!();
                    } else {
                      AIHistorySearchModal.show(context);
                    }
                  },
                  child: Text(
                    "Show ${sessions.length - 4} more...",
                    style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.textMuted),
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }

  // ── Footer (context chip + composer) ─────────────────────────────────

  Widget _buildFooter(BuildContext context) {
    final selectedLogIds = ref.watch(investigationProvider.select((s) => s.selectedLogIds));
    final isLoading = ref.watch(aiProvider.select((s) => s.isLoading));
    final canSend = _inputController.text.trim().isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (selectedLogIds.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.05),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "CONTEXT: ${selectedLogIds.length} LOGS",
                    style: AppTypography.labelCaps.copyWith(
                      fontSize: 9,
                      color: AppColors.primary.withValues(alpha: 0.8),
                    ),
                  ),
                  InkWell(
                    onTap: () => ref.read(investigationProvider.notifier).clearSelection(),
                    child: Text(
                      "Clear Selection",
                      style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (_showCommands) _buildCommandPalette(),
          Stack(
            children: [
              Focus(
                onKeyEvent: (node, event) {
                  if (event is! KeyDownEvent) return KeyEventResult.ignored;
                  if (event.logicalKey == LogicalKeyboardKey.enter &&
                      !HardwareKeyboard.instance.isShiftPressed) {
                    setState(() => _showCommands = false);
                    unawaited(_handleSend());
                    return KeyEventResult.handled;
                  }
                  if (event.logicalKey == LogicalKeyboardKey.escape) {
                    setState(() => _showCommands = false);
                    return KeyEventResult.handled;
                  }
                  return KeyEventResult.ignored;
                },
                child: TextField(
                  key: const Key("aiSidebarInputField"),
                  controller: _inputController,
                  focusNode: _inputFocusNode,
                  minLines: 3,
                  maxLines: 10,
                  style: AppTypography.body.copyWith(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: "Search patterns or analyze errors...",
                    contentPadding: const EdgeInsets.only(
                      left: AppSpacing.md,
                      top: AppSpacing.sm,
                      right: 48,
                      bottom: AppSpacing.sm,
                    ),
                    fillColor: AppColors.bgSurfaceBright.withValues(alpha: 0.5),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      borderSide: const BorderSide(color: AppColors.borderSubtle),
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 12,
                bottom: 12,
                child: isLoading
                    ? _StopButton(
                        onPressed: () => ref.read(aiProvider.notifier).stopMessage(),
                      )
                    : _SendButton(enabled: canSend, onPressed: canSend ? () => unawaited(_handleSend()) : null),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _buildReasoningToggle(),
        ],
      ),
    );
  }

  Widget _buildCommandPalette() {
    final query = _inputController.text.toLowerCase();
    final matches = _kAiCommands.where((c) => c.cmd.startsWith(query)).toList();
    if (matches.isEmpty) return const SizedBox.shrink();

    return Container(
      key: const Key("aiSidebarCommandPalette"),
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: Border.all(color: AppColors.borderSubtle),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final cmd in matches)
            InkWell(
              onTap: () {
                _inputController.text = "${cmd.cmd} ";
                _inputController.selection = TextSelection.collapsed(offset: _inputController.text.length);
                setState(() => _showCommands = false);
                _inputFocusNode.requestFocus();
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      cmd.cmd,
                      style: AppTypography.monoBody.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                    Text(
                      cmd.desc,
                      style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildReasoningToggle() {
    return InkWell(
      onTap: () => setState(() => _isReasoningEnabled = !_isReasoningEnabled),
      borderRadius: BorderRadius.circular(AppRadius.xl),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
        decoration: BoxDecoration(
          color: _isReasoningEnabled ? AppColors.warning.withValues(alpha: 0.1) : Colors.transparent,
          border: Border.all(
            color: _isReasoningEnabled
                ? AppColors.warning.withValues(alpha: 0.2)
                : AppColors.borderSubtle.withValues(alpha: 0.6),
          ),
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _isReasoningEnabled ? Icons.lightbulb : Icons.lightbulb_outline,
              size: 14,
              color: _isReasoningEnabled ? AppColors.warning : AppColors.textMuted,
            ),
            const SizedBox(width: 6),
            Text(
              "THINK",
              style: AppTypography.labelCaps.copyWith(
                fontSize: 9,
                color: _isReasoningEnabled ? AppColors.warning : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Message list rows ────────────────────────────────────────────────────

class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.message,
    required this.prevRole,
    required this.isLoading,
    required this.isLastMessage,
    required this.onA2UIAction,
  });

  final AiMessage message;
  final String? prevRole;
  final bool isLoading;
  final bool isLastMessage;
  final void Function(Map<String, dynamic>? action) onA2UIAction;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == "user";
    final isSameRoleAsPrev = prevRole == message.role;

    final parsed = isUser
        ? _ParsedThinking(thinking: null, response: message.content, isStreamingThink: false)
        : _parseThinking(message.content);

    final isAssistantAndEmpty = !isUser && parsed.thinking == null && parsed.response.isEmpty;
    final showTypingIndicator = isAssistantAndEmpty && isLoading && isLastMessage;
    final isPulseActive = parsed.isStreamingThink && isLoading && isLastMessage;

    final avatar = Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: isUser ? AppColors.bgSurfaceBright : AppColors.primary.withValues(alpha: 0.1),
        border: Border.all(
          color: isUser ? AppColors.borderSubtle : AppColors.primary.withValues(alpha: 0.2),
        ),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Icon(
        isUser ? Icons.person_outline : Icons.smart_toy_outlined,
        size: 16,
        color: isUser ? AppColors.textMuted : AppColors.accentViolet,
      ),
    );

    final bubble = Container(
      key: Key("aiMessageBubble_${message.id}"),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: isUser ? AppColors.bgSurface : AppColors.bgApp,
        border: Border.all(color: AppColors.borderSubtle),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(isUser ? AppRadius.xl : 0),
          topRight: Radius.circular(isUser ? 0 : AppRadius.xl),
          bottomLeft: const Radius.circular(AppRadius.xl),
          bottomRight: const Radius.circular(AppRadius.xl),
        ),
      ),
      child: showTypingIndicator
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const TypingIndicator(),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  "thinking…",
                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isUser && (parsed.thinking != null || isPulseActive))
                  ThinkingBlock(content: parsed.thinking ?? "", isStreaming: isPulseActive),
                if (isUser)
                  Text(
                    message.content,
                    textAlign: TextAlign.right,
                    style: AppTypography.body.copyWith(fontSize: 13, color: AppColors.textPrimary),
                  )
                else ...[
                  MarkdownContent(content: parsed.response),
                  if (message.a2uiPayload != null)
                    A2UIRenderer(payload: message.a2uiPayload, onAction: onA2UIAction),
                ],
              ],
            ),
    );

    return Padding(
      padding: EdgeInsets.only(top: isSameRoleAsPrev ? 4 : AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isUser) Opacity(opacity: isSameRoleAsPrev ? 0 : 1, child: avatar),
          if (!isUser) const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Column(
              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (message.contextLogs != null && message.contextLogs!.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Text(
                      "${message.contextLogs!.length} logs attached",
                      style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.primary),
                    ),
                  ),
                bubble,
                if (!isSameRoleAsPrev)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, left: 4, right: 4),
                    child: Text(
                      _formatTimestamp(message.timestamp),
                      style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.textMuted),
                    ),
                  ),
              ],
            ),
          ),
          if (isUser) const SizedBox(width: AppSpacing.sm),
          if (isUser) Opacity(opacity: isSameRoleAsPrev ? 0 : 1, child: avatar),
        ],
      ),
    );
  }
}

String _formatTimestamp(String isoTimestamp) {
  final dt = DateTime.tryParse(isoTimestamp)?.toLocal();
  if (dt == null) return "";
  final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final minute = dt.minute.toString().padLeft(2, "0");
  final period = dt.hour >= 12 ? "PM" : "AM";
  return "$hour12:$minute $period";
}

class _RecentSessionCard extends ConsumerWidget {
  const _RecentSessionCard({required this.session});

  final AiSession session;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Material(
        color: AppColors.bgSurfaceBright.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          onTap: () => ref.read(aiProvider.notifier).setSession(session.sessionId),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.borderSubtle),
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  session.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  session.lastModified,
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

// ── Send / stop buttons ──────────────────────────────────────────────────

class _SendButton extends StatelessWidget {
  const _SendButton({required this.enabled, required this.onPressed});

  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? AppColors.primary : AppColors.bgSurface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        key: const Key("aiSidebarSendButton"),
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onPressed,
        child: Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          child: Icon(
            Icons.send,
            size: 16,
            color: enabled ? AppColors.textInverse : AppColors.textMuted.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}

class _StopButton extends StatelessWidget {
  const _StopButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.error,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        key: const Key("aiSidebarStopButton"),
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onPressed,
        child: const SizedBox(
          width: 32,
          height: 32,
          child: Icon(Icons.stop, size: 16, color: Colors.white),
        ),
      ),
    );
  }
}
