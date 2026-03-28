# scripts/clean-sidecar.ps1
# Forces the stop of zombie sidecar processes (Python/uv/Tauri) on dev start
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*sidecar/main.py*" -or $_.Name -like "*LogLensAi-sidecar*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# Also remove stale WAL files that cause locked session errors
Remove-Item -Path "loglens.duckdb.wal" -ErrorAction SilentlyContinue
echo "Sidecar processes and stale WAL files cleaned."
