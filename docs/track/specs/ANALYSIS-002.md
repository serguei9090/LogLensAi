# TODOC: ANALYSIS-002 - Contextual Selection Filter

## Overview
Enable rapid filtering by allowing users to select text within any log line and immediately add or exclude that value from the current investigation.

## Behavioral Specs
- **Trigger**: User selects a substring in the `VirtualLogTable` or right-clicks a cell.
- **Actions**:
    - `(+) Filter to this`: Adds a `contains` filter for the selected text.
    - `(-) Exclude this`: Adds a `not_contains` filter for the selected text.
    - `(>>) Map Field`: Opens a quick-parser to map the selection to a known field (IP, Status, etc).
- **Implementation**:
    - Use `window.getSelection()` and a floating Action Pill.
    - Update `investigationStore.filters` which triggers a re-fetch.

## Design
- Minimalist floating menu (shadcn components).
- Context-aware: If clicking a "Source" cell, offer to filter by that specific source ID.
