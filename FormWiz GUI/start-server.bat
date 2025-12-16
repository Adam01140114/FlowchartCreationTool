@echo off
echo Starting local server for FormWiz GUI...
echo.
echo Server will be available at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"

REM Try Python first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python HTTP server...
    python -m http.server 8000
    goto :end
)

REM Try Python 3
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python 3 HTTP server...
    python3 -m http.server 8000
    goto :end
)

REM Try Node.js http-server
where node >nul 2>&1
if %errorlevel% == 0 (
    echo Using Node.js http-server...
    npx --yes http-server -p 8000
    goto :end
)

echo.
echo ERROR: No server found!
echo.
echo Please install one of the following:
echo   - Python 3: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
pause
goto :end

:end



