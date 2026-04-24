# AI-FE-003: AI Investigation Sidebar & Chat History

## 🎯 Objective
Create a collapsible investigation sidebar where the user can chat with the AI about selected logs and maintain multiple investigation contexts.

## 🏗️ UI/UX Design

### 1. `AIInvestigationSidebar.tsx` (Organism)
- **Position**: Right-aligned overlay or slide-in (collapsible).
- **Style**: Base-UI black background, transparency, glassmorphism.
- **Top Bar**: Search/Filter sessions, "New Session" button.
- **History List**: Accordion or scrollable list of named sessions.
- **Active Session Content**: 
  - Chat bubbles (user/ai).
  - Code-formatted log context (snippets of the logs being discussed).
  - Streaming text support.

### 2. Interaction
- **Add to Chat**: User selects logs in `VirtualLogTable` -> Action Pill -> "Send to Chat".
- **Visual Feedback**: The Sidebar opens immediately, logs are appended to the context.

### 3. Session Management
- **Automatic Naming**: If first message, AI generates a summary title (e.g., "Memory Outage Analysis").
- **Manual Renaming**: Inline editable titles.

## 🛠️ Components involved:
- `AIInvestigationSidebar.tsx`: The main sidebar organism.
- `ChatBubble.tsx` (Molecule): Renders user/ai messages.
- `SessionList.tsx` (Molecule): History manager.
- `SettingsPage.tsx`: Integrated multi-provider configuration (Dynamic forms).
- `aiStore.ts` (New Store): To track active sessions, history, and current provider.

## 🔄 Interaction Flow
1. **User Settings**: Choose AI Studio -> Enter Key -> Select `Gemini 1.5 Pro`.
2. **Investigation**: Select 10 Error logs -> Floating Pill: "Analyze with Agent".
3. **Sidebar**: Opens, AI provides an initial root-cause theory based on the 10 logs.
4. **Follow-up**: User asks "Are these from the same instance?", AI checks the metadata.
