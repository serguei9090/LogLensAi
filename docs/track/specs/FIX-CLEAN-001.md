# FIX-CLEAN-001: Technical Debt Remediation

**Status**: Active
**Severity**: Medium (Maintainability)
**Assigned**: @qa

## Problem Statement
The codebase has accumulated several high-severity linting errors (Biome) that impact performance (unnecessary re-renders in `ThinkingBlock`), stability (`index` keys in `MarkdownContent`), and accessibility (form labels).

## Remediation Strategy
1. **React Keys**: Use stable content-based IDs or a dedicated `useId` for list elements in `MarkdownContent` and `CustomParserModal`.
2. **Hook Pruning**: Remove redundant dependencies in `ThinkingBlock.tsx` and prune unused selectors in `VirtualLogTable.tsx`.
3. **Accessibility**: Standardize all buttons to include `type="button"` and ensure labels are correctly mapped to inputs using `htmlFor`.
4. **Type Safety**: Replace `any` in `CustomParserModal` with strict interfaces mirroring the backend parser configurations.

## Impact Analysis
- **High**: `VirtualLogTable` and `MarkdownContent` are core UI components. Any instability here affects the entire log analysis experience.
- **Low Risk**: These are surgical fixes with high automated test coverage potential.

## Task Checklist
- [ ] Fix `MarkdownContent.tsx` keys
- [ ] Prune `ThinkingBlock.tsx` hook dependencies
- [ ] Fix `CustomParserModal.tsx` accessibility and types
- [ ] Clean up `VirtualLogTable.tsx` store selectors
- [ ] Resolve non-null assertions in `InvestigationLayout.tsx`
