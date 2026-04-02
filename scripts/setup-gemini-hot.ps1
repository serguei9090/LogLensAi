# ========================================================
# Gemini Hot Mode Setup Script
# Clones and builds the gemini-cli repository in a git-ignored folder.
# ========================================================

$geminiDir = "gemini-cli"

if (!(Test-Path $geminiDir)) {
    Write-Host "[INIT] Cloning gemini-cli repository..." -ForegroundColor Cyan
    git clone https://github.com/google-gemini/gemini-cli.git $geminiDir
} else {
    Write-Host "[OK] gemini-cli repository already exists. Updating..." -ForegroundColor Cyan
    Push-Location $geminiDir
    git pull
    Pop-Location
}

Push-Location $geminiDir
Write-Host "[PKG] Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "[BUILD] Building project..." -ForegroundColor Cyan
npm run build

Write-Host "[DONE] Setup complete!" -ForegroundColor Green
Pop-Location
