# Feature: Custom Timestamp Parser Modal (FEAT-PARS-001)

## 🎯 Objective
Enable users to define custom timestamp extraction logic for non-standard log files without writing code. This is critical for interleaving logs in Fusion Mode where "Creation Time" (filesystem/ingest time) leads to inaccurate ordering.

## 🛠️ Components
- **Organism**: `CustomParserModal`
- **Sidecar API**: `get_sample_lines(source_id)`, `update_source_parser(source_id, config)`
- **Sidecar Logic**: Dynamic regex extraction in `FileTailer` and `Ingest` paths.

## 🎨 User Flow (Highlight-to-Parse)
1. **Trigger**: User clicks "Advanced Settings" in `FusionConfigEngine`.
2. **Sampling**: Modal displays 10 unique raw lines from the source.
3. **Selection**: User highlights the characters representing the date/time on the first sample.
4. **Logic Generation**:
   - The UI calculates the substring position.
   - The backend attempts to generate a regex matching that specific substring pattern (e.g. `\d{4}-\d{2}-\d{2}`) for future lines.
5. **Validation**: The modal applies the regex to all 10 sample lines and displays the "Normalized Output" in a preview column.
6. **Deployment**: Save stores the regex in `fusion_configs.parser_config`.

## 🏗️ Architecture (Hexagonal)
- **Port (Interface)**: `LogParserPort` defines `extract_timestamp(line: str) -> datetime`.
- **Adapter (Impl)**: `RegexParserAdapter` uses patterns from DuckDB.
- **Persistence**: `fusion_configs` table (workspace_id, source_id, config_json).

## ✅ Success Criteria
- User can select a timestamp in a weird log format (e.g. `[INFO] (2025/01/01 12:00) message`).
- The system extracts `2025/01/01 12:00`.
- The `timestamp` column in `logs` table uses the extracted value instead of `now()`.
- Logs from multiple sources are sorted correctly in the "Fusion" view.

## 📅 Roadmap
- [ ] Task 1: BE — Schema update for `fusion_configs` (JSON blob).
- [ ] Task 2: BE — RPC `get_sample_lines` implementation.
- [ ] Task 3: FE — `CustomParserModal` UI with selection detection.
- [ ] Task 4: BE — Integrate regex parser into `FileTailer` and `_ingest_single_log`.
