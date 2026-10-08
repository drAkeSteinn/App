@echo off
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
title Next.js App - Windows Launcher

set "PORT=3000"
set "APP_URL=http://localhost:%PORT%"
set "LOGFILE=start-log.txt"
set "MODE=dev"

if /I "%~1"=="prod" set "MODE=prod"
if /I "%~1"=="production" set "MODE=prod"

> "%LOGFILE%" echo ==========================================
>> "%LOGFILE%" echo Next.js Windows launcher
>> "%LOGFILE%" echo Date: %date% %time%
>> "%LOGFILE%" echo Folder: %CD%
>> "%LOGFILE%" echo Mode: %MODE%
>> "%LOGFILE%" echo URL: %APP_URL%
>> "%LOGFILE%" echo ==========================================
>> "%LOGFILE%" echo.

cls
echo ==========================================================
echo                NEXT.JS APP - WINDOWS
echo ==========================================================
echo.
echo Project folder:
echo %CD%
echo.
echo Mode: %MODE%
echo URL : %APP_URL%
echo Log : %LOGFILE%
echo.
echo Default: development mode.
echo To launch production mode use:
echo   start_app_windows_3000.bat prod
echo ==========================================================
echo.

if not exist "package.json" (
    echo [ERROR] package.json was not found in this folder.
    echo [ERROR] package.json was not found. >> "%LOGFILE%"
    echo Put this BAT file in the project root, beside package.json.
    echo.
    pause
    exit /b 1
)

call :RefreshPath
call :CheckNode
if errorlevel 1 goto :fatal

call :CheckNpm
if errorlevel 1 goto :fatal

call :PrintVersions

call :CheckServer
if "%SERVER_RUNNING%"=="1" (
    echo.
    echo [OK] Port %PORT% is already in use by PID %SERVER_PID%.
    echo Opening %APP_URL% ...
    >> "%LOGFILE%" echo [INFO] Port %PORT% already active. PID: %SERVER_PID%
    start "" "%APP_URL%"
    echo.
    pause
    exit /b 0
)

call :InstallDependencies
if errorlevel 1 goto :fatal

call :PreparePrisma
if errorlevel 1 goto :fatal

if /I "%MODE%"=="prod" goto :production

goto :development


:development
set "NODE_ENV=development"
echo.
echo ==========================================================
echo Starting DEVELOPMENT server...
echo %APP_URL%
echo.
echo Press CTRL+C to stop the server.
echo ==========================================================
echo.
>> "%LOGFILE%" echo [INFO] Running npm run dev:windows

call :OpenBrowserSoon
call npm run dev:windows
set "EXITCODE=%ERRORLEVEL%"
goto :server_exit


:production
set "NODE_ENV=production"
set "PORT=%PORT%"
set "HOSTNAME=127.0.0.1"
echo.
echo ==========================================================
echo Building app for PRODUCTION...
echo ==========================================================
echo.
>> "%LOGFILE%" echo [INFO] Running npm run build

call npm run build
if errorlevel 1 (
    echo [ERROR] Production build failed.
    >> "%LOGFILE%" echo [ERROR] npm run build failed.
    goto :fatal
)

echo.
echo ==========================================================
echo Starting PRODUCTION server...
echo %APP_URL%
echo.
echo Press CTRL+C to stop the server.
echo ==========================================================
echo.
>> "%LOGFILE%" echo [INFO] Running npm run start:windows

call :OpenBrowserSoon
if exist ".next\standalone\server.js" (
    echo [INFO] Standalone build detected.
    >> "%LOGFILE%" echo [INFO] Starting standalone server.
    call npm run start:standalone
) else (
    echo [INFO] Standard Next.js build detected.
    >> "%LOGFILE%" echo [INFO] Starting next start.
    call npm run start:windows
)
set "EXITCODE=%ERRORLEVEL%"
goto :server_exit


:server_exit
echo.
echo ==========================================================
echo Server stopped. Exit code: %EXITCODE%
echo ==========================================================
>> "%LOGFILE%" echo [INFO] Server stopped. Exit code: %EXITCODE%
echo.
pause
exit /b %EXITCODE%


:CheckNode
echo [1/5] Checking Node.js...
>> "%LOGFILE%" echo [1/5] Checking Node.js...

where node >nul 2>&1
if not errorlevel 1 (
    echo [OK] Node.js detected.
    >> "%LOGFILE%" echo [OK] Node.js detected.
    exit /b 0
)

echo [WARN] Node.js is not installed or is not available in PATH.
>> "%LOGFILE%" echo [WARN] Node.js not found.

where winget >nul 2>&1
if errorlevel 1 (
    echo [ERROR] winget is not available.
    echo Install Node.js LTS manually and run this BAT again.
    >> "%LOGFILE%" echo [ERROR] winget not available; Node.js cannot be installed automatically.
    exit /b 1
)

echo Installing Node.js LTS with winget...
>> "%LOGFILE%" echo [INFO] Installing Node.js LTS with winget...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements >> "%LOGFILE%" 2>&1

call :RefreshPath
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js installation finished, but node is still not in PATH.
    echo Close this window, open it again and rerun the BAT.
    >> "%LOGFILE%" echo [ERROR] Node.js still not found after winget install.
    exit /b 1
)

echo [OK] Node.js installed.
>> "%LOGFILE%" echo [OK] Node.js installed.
exit /b 0


:CheckNpm
echo [2/5] Checking npm...
>> "%LOGFILE%" echo [2/5] Checking npm...

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo Reinstall Node.js LTS or review your PATH.
    >> "%LOGFILE%" echo [ERROR] npm not found.
    exit /b 1
)

echo [OK] npm detected.
>> "%LOGFILE%" echo [OK] npm detected.
exit /b 0


:PrintVersions
echo [3/5] Versions:
for /f "delims=" %%A in ('node -v') do echo   Node: %%A
for /f "delims=" %%A in ('npm -v') do echo   npm : %%A

echo [3/5] Versions: >> "%LOGFILE%"
node -v >> "%LOGFILE%" 2>&1
npm -v >> "%LOGFILE%" 2>&1
exit /b 0


:CheckServer
set "SERVER_RUNNING=0"
set "SERVER_PID="

echo [4/5] Checking port %PORT%...
>> "%LOGFILE%" echo [4/5] Checking port %PORT%...

for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "SERVER_RUNNING=1"
    set "SERVER_PID=%%A"
    goto :CheckServerDone
)

:CheckServerDone
if "%SERVER_RUNNING%"=="1" (
    echo [INFO] Port %PORT% is already active. PID: %SERVER_PID%
) else (
    echo [OK] Port %PORT% is available.
)
exit /b 0


:InstallDependencies
echo [5/5] Checking dependencies...
>> "%LOGFILE%" echo [5/5] Checking dependencies...

if exist "node_modules\next\package.json" (
    echo [OK] node_modules is already installed.
    >> "%LOGFILE%" echo [OK] Dependencies already installed.
    exit /b 0
)

echo [INFO] Installing project dependencies...
>> "%LOGFILE%" echo [INFO] Installing project dependencies...

if exist "package-lock.json" (
    echo [INFO] package-lock.json detected. Trying npm ci...
    >> "%LOGFILE%" echo [INFO] Running npm ci...
    call npm ci
    if not errorlevel 1 goto :DependenciesInstalled

    echo [WARN] npm ci failed. Falling back to npm install...
    >> "%LOGFILE%" echo [WARN] npm ci failed; falling back to npm install.
)

call npm install
if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    >> "%LOGFILE%" echo [ERROR] Dependency installation failed.
    exit /b 1
)

:DependenciesInstalled
echo [OK] Dependencies installed.
>> "%LOGFILE%" echo [OK] Dependencies installed.
exit /b 0


:PreparePrisma
if not exist "prisma\schema.prisma" (
    >> "%LOGFILE%" echo [INFO] prisma\schema.prisma not found. Prisma generate skipped.
    exit /b 0
)

echo.
echo [INFO] Prisma schema detected. Generating Prisma Client...
>> "%LOGFILE%" echo [INFO] Running npx prisma generate...

call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma Client generation failed.
    >> "%LOGFILE%" echo [ERROR] npx prisma generate failed.
    exit /b 1
)

echo [OK] Prisma Client generated.
>> "%LOGFILE%" echo [OK] Prisma Client generated.
exit /b 0


:OpenBrowserSoon
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process '%APP_URL%'" >nul 2>&1
exit /b 0


:RefreshPath
set "PATH=%ProgramFiles%\nodejs;%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%PATH%"
exit /b 0


:fatal
echo.
echo ==========================================================
echo ERROR: The application could not be prepared or started.
echo Review:
echo %LOGFILE%
echo ==========================================================
echo.
pause
exit /b 1
