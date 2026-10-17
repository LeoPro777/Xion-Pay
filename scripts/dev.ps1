# ==============================================================================
# Xion-Pay: Script de inicio local integrado (PowerShell)
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  XION-PAY: Iniciando Backend y Frontend simultaneamente" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$PythonExe = ".\backend\.venv\Scripts\python.exe"
if (-Not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

# Ejecutar el orquestador de desarrollo
& $PythonExe .\scripts\run_dev.py
