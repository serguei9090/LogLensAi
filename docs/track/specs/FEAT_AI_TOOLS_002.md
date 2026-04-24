# FEAT-AI-TOOLS-002: Advanced Copilot UI & Skill System

## Context
Following FEAT-AI-TOOLS-001, we need to improve the user experience and expand the capabilities of the AI Copilot. The objective is to refine the configuration UX, allow custom dynamic context across the workspace, enable custom skills creation/uploading (like `.agents/skills`), and optimize chat streaming.

## Implementation Plan

### Phase A: Copilot Context & Orchestrator UI
1. **AI Layer in Orchestrator Hub**: 
   - Move "Workspace Global Context" out of "Visual Layers" into a new "AI Layer" category.
   - Change from a Switch to an Action Button that opens a modal allowing the user to provide extensive, custom text context that the AI will always ingest for the workspace.
   - Update `InvestigationStore` to store this context string.

### Phase B: Config & AI Skills Management
1. **Collapsible Tools UI**: 
   - In `SettingsPanel.tsx`, move the AI Tools toggles (Search tool, Memory tool) into an expandable/retractable (Accordion-style) UI section called "Tools".
2. **Skills Manager**:
   - In the same Settings UI, add a custom "Skills" manager.
   - Implement an "Add Skill" button that opens a new modal to either write a Custom Skill (markdown-based) or reference a local script, following the `.agents/skills` system.

### Phase C: Chat UX Optimization
1. **Streaming Fix**: 
   - Analyze and resolve the chat window rendering issue where tokens are seemingly delayed until finalization. Ensure real-time chunk streaming.
2. **Refined Thinking GUI**: 
   - Implement the provided visual reference for the `<think>` block, formatting it as a foldable "˅ Thought for X seconds" drop-down. 
