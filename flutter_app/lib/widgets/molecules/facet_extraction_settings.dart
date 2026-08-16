/// Dart port of `src/components/molecules/FacetExtractionSettings.tsx`.
///
/// Settings sub-panel for the list of custom facet-extraction regex rules
/// (`AppSettings.facetExtractions` / [FacetExtractionRule]): add, edit
/// inline, enable/disable, delete. Also has a collapsible reference panel
/// listing the backend's always-on system heuristics (ip/uuid/email/etc.)
/// -- informational only, not editable.
library;

import "package:flutter/material.dart";

import "../../models/settings.dart";
import "../../theme/app_theme.dart";
import "../atoms/help_tooltip.dart";

class _SystemFacet {
  const _SystemFacet(this.name, this.desc, this.pattern);
  final String name;
  final String desc;
  final String pattern;
}

const List<_SystemFacet> _kSystemFacets = [
  _SystemFacet("ip", "IPv4 and IPv6 addresses", "Heuristic (Heuristic-based validation)"),
  _SystemFacet("uuid", "Standard UUIDs", "[0-9a-f]{8}-..."),
  _SystemFacet("email", "Email addresses", "[a-z0-9._%+-]+@..."),
  _SystemFacet("user_id / status", "Common fields", "user_id=123, status=200"),
  _SystemFacet("kv_pairs", "Generic Key=Value", "key=value, key:value"),
];

class FacetExtractionSettings extends StatefulWidget {
  const FacetExtractionSettings({
    super.key,
    required this.rules,
    required this.onChange,
    this.title = "Custom Facet Extraction",
  });

  final List<FacetExtractionRule> rules;
  final ValueChanged<List<FacetExtractionRule>> onChange;
  final String title;

  @override
  State<FacetExtractionSettings> createState() => _FacetExtractionSettingsState();
}

class _FacetExtractionSettingsState extends State<FacetExtractionSettings> {
  bool _showSystem = false;
  final _newName = TextEditingController();
  final _newRegex = TextEditingController();
  final _newGroup = TextEditingController(text: "1");

  @override
  void dispose() {
    _newName.dispose();
    _newRegex.dispose();
    _newGroup.dispose();
    super.dispose();
  }

  void _addRule() {
    final name = _newName.text.trim();
    final regex = _newRegex.text.trim();
    if (name.isEmpty || regex.isEmpty) return;
    final group = int.tryParse(_newGroup.text) ?? 1;
    widget.onChange([
      ...widget.rules,
      FacetExtractionRule(name: name, regex: regex, group: group, enabled: true),
    ]);
    _newName.clear();
    _newRegex.clear();
    _newGroup.text = "1";
    setState(() {});
  }

  void _removeRule(int index) {
    final next = [...widget.rules]..removeAt(index);
    widget.onChange(next);
  }

  void _toggleRule(int index) {
    final r = widget.rules[index];
    final next = [...widget.rules];
    next[index] = FacetExtractionRule(name: r.name, regex: r.regex, group: r.group, enabled: !r.enabled);
    widget.onChange(next);
  }

  void _updateRule(int index, {String? name, String? regex, int? group}) {
    final r = widget.rules[index];
    final next = [...widget.rules];
    next[index] = FacetExtractionRule(
      name: name ?? r.name,
      regex: regex ?? r.regex,
      group: group ?? r.group,
      enabled: r.enabled,
    );
    widget.onChange(next);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(widget.title, style: AppTypography.h2),
                      const SizedBox(width: AppSpacing.xs),
                      const HelpTooltip(
                        message:
                            "Define custom regex patterns to extract metadata (facets) from raw "
                            "logs. Facets are stored as structured JSON and can be searched or "
                            "filtered immediately.",
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "Rules are applied in order. Use named groups (?<name>...) or index.",
                    style: AppTypography.body.copyWith(color: AppColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
            OutlinedButton(
              onPressed: () => setState(() => _showSystem = !_showSystem),
              child: Text(_showSystem ? "Hide System Facets" : "Show System Facets"),
            ),
          ],
        ),
        if (_showSystem) ...[
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.05),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "ACTIVE SYSTEM HEURISTICS (ALWAYS ON)",
                  style: AppTypography.labelCaps.copyWith(color: AppColors.primaryHover),
                ),
                const SizedBox(height: AppSpacing.xs),
                for (final sf in _kSystemFacets)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                sf.name,
                                style: AppTypography.body.copyWith(fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                sf.desc,
                                style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          sf.pattern,
                          style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.primaryHover),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  "* System facets are optimized for high-performance extraction and cannot be disabled.",
                  style: AppTypography.body.copyWith(
                    fontSize: 10,
                    fontStyle: FontStyle.italic,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < widget.rules.length; i++) _ruleRow(i),
              _newRuleRow(),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _cheatSheet()),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface.withValues(alpha: 0.4),
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Text(
                  "Named groups like (?<user_id>...) will automatically map to the facet name "
                  "if available.",
                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _cheatSheet() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.4),
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("CHEAT SHEET", style: AppTypography.labelCaps.copyWith(fontSize: 10)),
          const SizedBox(height: 4),
          Text(r"\d+ - Match digits", style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted)),
          Text(r"\w+ - Match word chars", style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted)),
          Text(
            r"\[(.*?)\] - Capture within brackets",
            style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _ruleRow(int index) {
    final rule = widget.rules[index];
    return Opacity(
      opacity: rule.enabled ? 1 : 0.5,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.borderMuted)),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: TextField(
                controller: TextEditingController(text: rule.name)
                  ..selection = TextSelection.collapsed(offset: rule.name.length),
                onChanged: (v) => _updateRule(index, name: v),
                decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                style: AppTypography.body.copyWith(fontSize: 13),
              ),
            ),
            Expanded(
              flex: 3,
              child: TextField(
                controller: TextEditingController(text: rule.regex)
                  ..selection = TextSelection.collapsed(offset: rule.regex.length),
                onChanged: (v) => _updateRule(index, regex: v),
                decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                style: AppTypography.monoBody.copyWith(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
            SizedBox(
              width: 48,
              child: TextField(
                controller: TextEditingController(text: rule.group.toString()),
                onChanged: (v) => _updateRule(index, group: int.tryParse(v) ?? 1),
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                style: AppTypography.body.copyWith(fontSize: 13),
              ),
            ),
            IconButton(
              onPressed: () => _toggleRule(index),
              icon: Icon(
                rule.enabled ? Icons.toggle_on : Icons.toggle_off,
                color: rule.enabled ? AppColors.primary : AppColors.textMuted,
              ),
            ),
            IconButton(
              onPressed: () => _removeRule(index),
              icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _newRuleRow() {
    final canAdd = _newName.text.trim().isNotEmpty && _newRegex.text.trim().isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
      color: AppColors.primary.withValues(alpha: 0.05),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: TextField(
              controller: _newName,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(isDense: true, border: InputBorder.none, hintText: "New facet..."),
              style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
            ),
          ),
          Expanded(
            flex: 3,
            child: TextField(
              controller: _newRegex,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: "Regex pattern...",
              ),
              style: AppTypography.monoBody.copyWith(fontSize: 13),
            ),
          ),
          SizedBox(
            width: 48,
            child: TextField(
              controller: _newGroup,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(isDense: true, border: InputBorder.none),
              style: AppTypography.body.copyWith(fontSize: 13),
            ),
          ),
          const SizedBox(width: 40),
          IconButton(
            onPressed: canAdd ? _addRule : null,
            icon: const Icon(Icons.add),
            color: AppColors.primary,
          ),
        ],
      ),
    );
  }
}
