# Skill: Generate Frontend Code

## Objective
Your goal as the Frontend Engineer is to build a stunning, responsive interface based on Atomic Design principles in the `src/` directory.

## Rules of Engagement
- **Dynamic Coding**: You are working on the React 19 + TypeScript + Vite project.
- **Save Location**: Save all your raw code in `src/components/` (atoms, molecules, organisms, templates, pages) and `src/store/`.
- **Rich Aesthetics**: 
  - Mandatory use of modern, premium visual design (curated palettes from `docs/Documentation/design/theme.md`, glassmorphism, dynamic animations).
  - No hardcoded hex colors; use CSS custom properties from `src/styles/globals.css`.
- **Code Standards**: 
  - Mandatory detailed documentation for all component state and logic.
  - Mandatory "TODO(ID)" protocol in `docs/track/TODO.md` for any incomplete elements.
  - Ensure all components are organized into the Atomic Design structure.

## Instructions
1. **Read the Layout/Contract**: Open and carefully study `docs/track/Technical_Specification.md` and `docs/Documentation/reference/API_SPEC.md`.
2. **Setup Design Foundation**: Use tokens from `docs/Documentation/design/theme.md`.
3. **Build Atomic Components**: Develop the necessary components starting from atoms and molecules in `src/components/`.
4. **Assemble Pages**: Compose the final pages in `src/components/pages/` and link them to the backend API via `useSidecarBridge.ts`.
5. **Output**: Dump your frontend code perfectly into the `src/` directory. Do not skip or summarize any code blocks. Ensure all `package.json` configurations are respected.
