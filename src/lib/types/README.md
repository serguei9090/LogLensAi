# Generated API Types (`src/lib/types`)

## Overview
Auto-generated TypeScript type definitions representing the JSON-RPC 2.0 request, response, and payload contract between the frontend and the sidecar backend. Generated from the repository's JSON Schema via `json-schema-to-typescript`.

## Interface
- `LogLensAiAPISchema` (`[generated.ts:LogLensAiAPISchema]`): Top-level discriminated union covering all generated JSON-RPC request, response, and domain payload interfaces.
- Transport envelopes: `JSONRPCRequest`, `Params`, `JSONRPCResponse` (`[generated.ts:JSONRPCRequest]`, `[generated.ts:Params]`, `[generated.ts:JSONRPCResponse]`).
- Log & ingestion requests/models: `LogFilter`, `GetLogsRequest`, `StartTailRequest`, `StartSSHTailRequest`, `IngestLogEntry`, `IngestLogsRequest`, `UpdateCommentRequest`, `GetWorkspaceSourcesRequest`, `ReadFileRequest`, `GetAnomaliesRequest`, `GetLogDistributionRequest`, `GetMetadataFacetsRequest` (`[generated.ts:LogFilter]`, `[generated.ts:GetLogsRequest]`, `[generated.ts:StartTailRequest]`, `[generated.ts:StartSSHTailRequest]`, `[generated.ts:IngestLogEntry]`, `[generated.ts:IngestLogsRequest]`, `[generated.ts:UpdateCommentRequest]`, `[generated.ts:GetWorkspaceSourcesRequest]`, `[generated.ts:ReadFileRequest]`, `[generated.ts:GetAnomaliesRequest]`, `[generated.ts:GetLogDistributionRequest]`, `[generated.ts:GetMetadataFacetsRequest]`).
- Fusion & parser configuration contracts: `FusionSourceConfig`, `UpdateTemporalOffsetsRequest`, `Offsets`, `GetTemporalOffsetsRequest`, `UpdateFusionConfigRequest`, `GetFusionConfigRequest`, `GetSampleLinesRequest`, `UpdateSourceParserRequest`, `GetFusedLogsRequest` (`[generated.ts:FusionSourceConfig]`, `[generated.ts:UpdateTemporalOffsetsRequest]`, `[generated.ts:Offsets]`, `[generated.ts:GetTemporalOffsetsRequest]`, `[generated.ts:UpdateFusionConfigRequest]`, `[generated.ts:GetFusionConfigRequest]`, `[generated.ts:GetSampleLinesRequest]`, `[generated.ts:UpdateSourceParserRequest]`, `[generated.ts:GetFusedLogsRequest]`).
- AI, memory & settings contracts: `SendAiMessageRequest`, `GetAiSessionsRequest`, `GetAiMessagesRequest`, `SaveMemoryRequest`, `SearchMemoryRequest`, `GetSettingsRequest`, `UpdateSettingsRequest`, `Settings` (`[generated.ts:SendAiMessageRequest]`, `[generated.ts:GetAiSessionsRequest]`, `[generated.ts:GetAiMessagesRequest]`, `[generated.ts:SaveMemoryRequest]`, `[generated.ts:SearchMemoryRequest]`, `[generated.ts:GetSettingsRequest]`, `[generated.ts:UpdateSettingsRequest]`, `[generated.ts:Settings]`).

## Invariants
- Generated-artifact immutability: `generated.ts` must never be edited by hand; update the source JSON schema and regenerate with `json-schema-to-typescript` (`[generated.ts:LogLensAiAPISchema]`).
- Open-object compatibility: All generated request, response, and config interfaces preserve `[k: string]: unknown` index signatures (`[generated.ts:JSONRPCRequest]`, `[generated.ts:JSONRPCResponse]`).

## Side Effects
- `None` (type-only definitions with zero runtime execution or state mutation).

## Verification
- Run: `bun test`
