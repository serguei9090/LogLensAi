# TODO(AI-BE-004): Persistent Provider Session Tracking

## 🎯 Objective
Enable sub-second "Hot Mode" resume by storing the `taskId` (A2A session ID) in the `ai_sessions` table in DuckDB. 

## 🏗️ Architecture
- **Table Change**: `ALTER TABLE ai_sessions ADD COLUMN provider_session_id TEXT`
- **Logic**:
  1. When calling `GeminiCLIProvider` for the first time, store the returned `taskId` in `ai_sessions`.
  2. When re-calling the provider (even after app restart), check if `provider_session_id` exists.
  3. Attempt A2A communication with that `taskId`.
  4. If A2A task has expired (404/500), create new task and update `provider_session_id`.

## 🔄 Interaction
- **Sidecar API**: `method_send_ai_message` will bridge the database and the provider-specific session IDs.
- **Provider Interface**: Update `AIChatMessage` to optionally carry back the `provider_session_id`.

## ✅ Success Criteria
- [ ] Closing and restarting the sidecar allows resuming a Hot Mode chat without re-injecting 50+ messages context.
- [ ] Multiple concurrent sessions work with independent A2A tasks.
