# Feature Specification: Fusion Mode (Multi-Source Orchestration)

**Status**: Draft (Cycle Started)  
**ID**: FEAT-FUSION-001  
**Owner**: @pm / Antigravity  

## 1. Vision
Transform the basic "All" log view into a professional **Fusion Engine**. This allows investigators to selectively merge multiple log sources (Local, SSH, etc.), resolve timezone discrepancies, and handle non-standard timestamp formats through an interactive UI.

## 2. User Experience (UX Flow)
1. **The Entry**: User clicks the "Fusion" tab in the main navigation.
2. **The Configuration**: If no sources are active, the **Fusion Config Screen** appears (replacing the table).
3. **The Selection**: User toggles checkboxes for specific files and sets their Timezone offsets.
4. **The Validation**: System flags any "Parser Errors" (logs it can't read).
5. **The Fix (Optional)**: User opens the **Pattern Parser Modal** to manually define a timestamp format for a broken source.
6. **The Result**: User clicks "Fuse Logs," transitioning to a unified virtual log table with interleaved, sorted data.

## 3. Atomic Design Components

### Atoms
- `SourceCheckbox`: Toggle for individual files.
- `TimezoneOffsetPicker`: Minimal dropdown for UTC offsets (+/- hours).
- `ParserStatusBadge`: `IDLE`, `VERIFIED`, `FAILED` states.
- `SampleLineDisplay`: Monospace block for raw log text in the parser modal.

### Molecules
- `SourceConfigRow`: Composes Source Name + Type + TZ + Parser Status.
- `PatternHighlighter`: Interactive text selector for the parser modal sample lines.
- `FusionSummaryCard`: Mini-stats (Total Sources, Total Lines, Time Range).

### Organisms
- `FusionConfigEngine`: The primary setup view before log rendering.
- `CustomParserModal`: The overlay for regex/format definition.
- `FusedToolbar`: Context-aware toolbar for filtering across multiple sources.

## 4. Technical Requirements

### Backend (Sidecar)
- **JSON-RPC**: `get_fused_logs` method (extension of `get_logs` but aware of multiple tables/sources).
- **DuckDB**: Optimization for `UNION ALL` or temporary view joins across sources.
- **Normalization**: Standardized `unix_epoch` internal storage.

### Data Model (Pydantic)
```python
class SourceConfig(BaseModel):
    source_id: str
    enabled: bool = True
    tz_offset: int = 0  # Minutes
    custom_format: str | None = None
```

## 5. Implementation Roadmap
1. [ ] **UI Design**: Mockup the Fusion Configuration interface.
2. [ ] **State Storage**: Update `workspaceStore` to persist Fusion configurations per workspace.
3. [ ] **Pattern Logic**: Implement the Logic to "Guess" or "Define" formats from sample lines.
4. [ ] **Dual View**: Transition logic between "Config Mode" and "Investigation Mode" in the Fusion tab.

## 6. Acceptance Criteria
- [ ] Users can select exactly 2 out of 4 files and see only their interleaved logs.
- [ ] A file from London (UTC) and New York (UTC-5) align correctly on the shared timeline.
- [ ] A log with format `[27-Mar-2026] :: INFO` can be successfully parsed after manual definition.
