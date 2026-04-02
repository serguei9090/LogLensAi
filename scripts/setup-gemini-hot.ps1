# ========================================================
# Gemini Hot Mode Setup Script
# Clones and builds the gemini-cli repository in a git-ignored folder.
# ========================================================

$geminiDir = "gemini-cli"

if (!(Test-Path $geminiDir)) {
    Write-Host "🚀 Cloning gemini-cli repository..." -ForegroundColor Cyan
    git clone https://github.com/google/gemini-cli.git $geminiDir
} else {
    Write-Host "✅ gemini-cli repository already exists. Updating..." -ForegroundColor Cyan
    Push-Location $geminiDir
    git pull
    Pop-Location
}

Push-Location $geminiDir
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "🏗️ Building project..." -ForegroundColor Cyan
npm run build

Write-Host "✨ Setup complete!" -ForegroundColor Green
Pop-Location
