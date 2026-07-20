@echo off
setlocal

set PORT=4173
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies (first run only)...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Building VisualDesigner...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo Starting local server on http://localhost:%PORT% ...
start "VisualDesigner server" cmd /c "npm run preview -- --port %PORT% --strictPort"

REM Give the server a moment to boot before opening the browser.
timeout /t 3 /nobreak >nul

start "" "http://localhost:%PORT%"

echo.
echo VisualDesigner is running at http://localhost:%PORT%
echo A separate "VisualDesigner server" window is keeping it running - close that window to stop the app.
echo.
pause
