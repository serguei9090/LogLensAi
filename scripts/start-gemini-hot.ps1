# ========================================================
# Gemini A2A Server Bootstrapper (LogLensAi Hot Mode)
# ========================================================

# [1] Set environment variables for Speed and Auth
$env:USE_CCPA = "1"
$env:GEMINI_MODEL = "gemini-2.5-flash"
$env:GEMINI_CLI_MODEL = "gemini-2.5-flash"
$env:CODER_AGENT_PORT = "22436"

# [2] Set environment variables for Local Persistence
$env:GEMINI_A2A_PERSISTENCE = "local"

# Force absolute path to avoid subfolder issues 
# Using the workspace root gemini_sessions folder
$projectSessions = Join-Path $PSScriptRoot "..\gemini_sessions\chat_back"
$env:GEMINI_A2A_DB_PATH = $projectSessions
$env:GEMINI_DIR = $projectSessions
$env:GEMINI_TASK_STORAGE_PATH = $projectSessions
$env:A2A_STORAGE_ROOT = $projectSessions

# [3] Create session directory if it doesn't exist
if (!(Test-Path $projectSessions)) {
    New-Item -ItemType Directory -Force -Path $projectSessions | Out-Null
}

$a2aPath = Join-Path $PSScriptRoot "..\gemini-cli\packages\a2a-server"
if (!(Test-Path $a2aPath)) {
    Write-Host "[ERROR] gemini-cli repository not found in workspace root." -ForegroundColor Red
    Write-Host "Run 'bun run setup:gemini' first." -ForegroundColor Yellow
    exit 1
}

# [4] Navigate to the A2A package and start it
Push-Location $a2aPath
Write-Host "[INIT] Launching Persistent A2A Server on Port 22436..." -ForegroundColor Green
Write-Host "[LOG] Sessions stored in: $projectSessions" -ForegroundColor Cyan
npm start
Pop-Location
