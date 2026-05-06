# Commit Range Standard

## Marker

The documentation sync marker lives at `docs/track/documentation-sync.md`.

Required fields:

- `Last documented commit: <sha>`
- `Last sync date: <YYYY-MM-DD>`
- `Scope: <summary>`

## Range Selection

1. If the user gives a range, use it.
2. Else read the marker and use `<last documented commit>..HEAD`.
3. If the marker is missing, inspect recent history and ask for a baseline only if choosing one would be risky.
4. Include uncommitted changes when the user asks about last edited files.

## Commands

- Commits: `git log --oneline <base>..HEAD`
- Changed files: `git diff --name-status <base>..HEAD`
- Current uncommitted files: `git status --short`
- File-specific history: `git log --oneline -- <path>`

## Marker Update Rule

Update the marker to `HEAD` only after:

- documentation has been updated, or
- the audited range has no documentation impact and that conclusion is recorded.

