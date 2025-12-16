# PowerShell script to start local server for FormWiz GUI
# To run: Navigate to this folder in PowerShell and run: .\start-server.ps1
# Or run: powershell -ExecutionPolicy Bypass -File "start-server.ps1"

Write-Host "Starting local server for FormWiz GUI..." -ForegroundColor Green
Write-Host ""
Write-Host "Server will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Open: http://localhost:8000/gui.html in your browser" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Try Python first
$pythonFound = $false
try {
    $null = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Using Python HTTP server..." -ForegroundColor Green
        python -m http.server 8000
        $pythonFound = $true
    }
} catch {}

# Try Python 3 if Python didn't work
if (-not $pythonFound) {
    try {
        $null = python3 --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Using Python 3 HTTP server..." -ForegroundColor Green
            python3 -m http.server 8000
            $pythonFound = $true
        }
    } catch {}
}

# Try Node.js http-server if Python didn't work
if (-not $pythonFound) {
    try {
        $null = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Using Node.js http-server..." -ForegroundColor Green
            npx --yes http-server -p 8000
            $pythonFound = $true
        }
    } catch {}
}

# If nothing worked
if (-not $pythonFound) {
    Write-Host ""
    Write-Host "ERROR: No server found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install one of the following:" -ForegroundColor Yellow
    Write-Host "  - Python 3: https://www.python.org/downloads/"
    Write-Host "  - Node.js: https://nodejs.org/"
    Write-Host ""
    Read-Host "Press Enter to exit"
}

