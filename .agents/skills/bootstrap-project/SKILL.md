# Skill: Bootstrap Project

## Objective
Your goal as the Project Adapter (@project-adapter) is to transform this directory from a "Generic Template" into a "Project-Specific Factory."

## Instructions
1. **Scan the Root**: Detect the stack. Search for:
   - `package.json`, `bun.lockb`, `yarn.lock`
   - `pyproject.toml`, `requirements.txt`, `poetry.lock`
   - `pubspec.yaml`
   - `docker-compose.yml`, `Dockerfile`
   - `.github/workflows/`
2. **Analyze Structure**: Determine the naming conventions (e.g., `/src` vs `/lib`) and UI patterns (e.g. Tailwind vs. Material).
3. **Calibrate Personas**: Update `.agents/agents.md`. If it's a Flutter project, replace the "React/Tauri" expertise of `@frontend-expert` with "Flutter/Dart/BLoC." 
4. **Calibrate Skills**: Update `.agents/skills/deploy_app.md` to use the correct commands (e.g., `flutter run` vs `npm run dev`).
5. **Verify HAL**: Ensure `agents.yaml` reflects the paths of the current directory.
6. **Report**: Give the user a summary of the new "Identity" for the AI team.
