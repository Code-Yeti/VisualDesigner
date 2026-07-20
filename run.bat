@echo off
setlocal
set PORT=4173
cd /d "%~dp0"

if exist node_modules goto build

echo Installing dependencies - first run only...
call npm install
if errorlevel 1 goto installfailed
goto build

:installfailed
echo npm install failed.
pause
exit /b 1

:build
echo Building VisualDesigner...
call npm run build
if errorlevel 1 goto buildfailed
goto serve

:buildfailed
echo Build failed.
pause
exit /b 1

:serve
echo Starting local server on http://localhost:%PORT% ...
start "VisualDesigner server" cmd /c "npm run preview -- --port %PORT% --strictPort"

timeout /t 3 /nobreak >nul

start "" "http://localhost:%PORT%"

echo.
echo VisualDesigner is running at http://localhost:%PORT%
echo A separate VisualDesigner server window is keeping it running - close that window to stop the app.
echo.
pause
