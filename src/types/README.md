# Domain Types (`src/types`)

## Overview
Hand-authored frontend TypeScript interfaces and union types for structured log entries and the Laya decision-engine rules, checkpoints, evaluation outputs, and local ONNX model status.

## Interface
- `QuestionType`, `LayaQuestion`, `LayaCheckpoint`, `LayaSettings`, `LayaDecisionResult`, `LayaModelStatus` (`[laya.ts:QuestionType]`, `[laya.ts:LayaQuestion]`, `[laya.ts:LayaCheckpoint]`, `[laya.ts:LayaSettings]`, `[laya.ts:LayaDecisionResult]`, `[laya.ts:LayaModelStatus]`): Types defining Laya rule schemas (`"choice" | "score" | "noul"`), versioned rule checkpoints, CPU/GPU configuration, inference results, and ONNX artifact download state.
- `LogLevel` & `LogEntry` (`[log.ts:LogLevel]`, `[log.ts:LogEntry]`): Log severity union (`"DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "TRACE" | "VERBOSE" | "CRITICAL"`) and normalized log record shape with Drain3 cluster fields, annotations, and extracted facets.

## Invariants
- Enumerated Laya unions: `QuestionType` allows only `"choice" | "score" | "noul"`, `LayaSettings.device` allows only `"cpu" | "gpu"`, and `LayaModelStatus.state` allows only `"idle" | "downloading" | "ready" | "error"` (`[laya.ts:QuestionType]`, `[laya.ts:LayaSettings]`, `[laya.ts:LayaModelStatus]`).
- Enumerated log severities: `LogLevel` constrains `LogEntry.level` to the 8 uppercase severity literals (`[log.ts:LogLevel]`, `[log.ts:LogEntry]`).

## Side Effects
- `None` (pure TypeScript type definitions with zero runtime execution or state mutation).

## Verification
- Run: `bun test`
