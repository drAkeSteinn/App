@echo off
rem Keep an interactive CMD open even after syntax errors.
if defined ARENA_BATCH_CHILD goto MAIN
set "ARENA_BATCH_CHILD=1"
cmd /d /k ""%~f0" %*"
exit /b

:MAIN
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 goto FATAL
set "PORT=3000"
set "APP_URL=http://localhost:3000"
set "LOGFILE=%CD%\start-log.txt"
set "MODE=dev"
if /I "%~1"=="prod" set "MODE=prod"
if /I "%~1"=="production" set "MODE=prod"
set "FFMPEG_DIR=%CD%\.venv\Scripts"
set "STREAM_DIR=%CD%\mini-services\stream-server"
set "INGEST_DIR=%CD%\mini-services\ingest-server"
> "%LOGFILE%" echo Next.js Windows launcher - %DATE% %TIME%
>> "%LOGFILE%" echo Folder: %CD%
>> "%LOGFILE%" echo Mode: %MODE%
echo ==========================================
echo Next.js Windows launcher - FIXED
echo Folder: %CD%
echo Mode: %MODE%
echo URL: %APP_URL%
echo ==========================================
if not exist "package.json" goto MISSING_PACKAGE
call :CheckNode
if errorlevel 1 goto FATAL
call :CheckNpm
if errorlevel 1 goto FATAL
call :PrintVersions
if errorlevel 1 goto FATAL
call :StartStreamServer
if errorlevel 1 echo [WARN] MediaMTX could not start. Check start-log.txt.
call :CheckServer
if "%SERVER_RUNNING%"=="1" goto ALREADY_RUNNING
call :InstallDependencies
if errorlevel 1 goto FATAL
call :PreparePrisma
if errorlevel 1 goto FATAL
call :EnsureFFmpeg
if errorlevel 1 echo [WARN] FFmpeg is unavailable. Optional HTTP ingestion disabled.
call :StartIngestServer
if /I "%MODE%"=="prod" goto PRODUCTION

goto DEVELOPMENT

:DEVELOPMENT
set "NODE_ENV=development"
echo [APP] Starting Next.js development server...
>> "%LOGFILE%" echo [APP] npm run dev:windows
start "" "%APP_URL%"
call npm.cmd run dev:windows
set "EXITCODE=%ERRORLEVEL%"
goto SERVER_EXIT

:PRODUCTION
set "NODE_ENV=production"
set "HOSTNAME=127.0.0.1"
echo [APP] Building production app...
>> "%LOGFILE%" echo [APP] npm run build
call npm.cmd run build
if errorlevel 1 goto FATAL
echo [APP] Starting Next.js production server...
start "" "%APP_URL%"
if exist ".next\standalone\server.js" goto START_STANDALONE
call npm.cmd run start:windows
set "EXITCODE=%ERRORLEVEL%"
goto SERVER_EXIT

:START_STANDALONE
call npm.cmd run start:standalone
set "EXITCODE=%ERRORLEVEL%"
goto SERVER_EXIT

:SERVER_EXIT
echo.
echo [APP] Server stopped. Exit code: %EXITCODE%
>> "%LOGFILE%" echo [APP] Server stopped, exit code %EXITCODE%
echo See: "%LOGFILE%"
pause
exit /b %EXITCODE%

:ALREADY_RUNNING
echo [INFO] Port 3000 is already in use by PID %SERVER_PID%.
echo [INFO] Check whether your app is already running.
start "" "%APP_URL%"
pause
exit /b 0

:MISSING_PACKAGE
echo [ERROR] package.json not found beside the launcher.
goto FATAL

:FATAL
echo.
echo [ERROR] Setup failed. Read the last error above.
if defined LOGFILE echo [ERROR] Log: "%LOGFILE%"
pause
exit /b 1

:CheckNode
echo [1/5] Checking Node.js...
where node.exe >nul 2>&1
if errorlevel 1 goto NODE_MISSING
node -e "const major=+process.versions.node.split('.')[0];process.exit(major>=20?0:1)"
if errorlevel 1 goto NODE_OLD
echo [OK] Node.js detected.
exit /b 0
:NODE_OLD
echo [ERROR] Node.js 20 or newer required. Recommended: current LTS.
exit /b 1
:NODE_MISSING
echo [ERROR] Node.js not detected. Install Node.js LTS from nodejs.org.
exit /b 1

:CheckNpm
echo [2/5] Checking npm...
where npm.cmd >nul 2>&1
if errorlevel 1 goto NPM_MISSING
echo [OK] npm detected.
exit /b 0
:NPM_MISSING
echo [ERROR] npm.cmd not detected on PATH.
exit /b 1

:PrintVersions
echo [3/5] Versions:
node --version
call npm.cmd --version
if errorlevel 1 exit /b 1
exit /b 0

:CheckServer
set "SERVER_RUNNING=0"
set "SERVER_PID="
echo [4/5] Checking port 3000...
for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do set "SERVER_PID=%%A"
if not defined SERVER_PID goto PORT_FREE
set "SERVER_RUNNING=1"
exit /b 0
:PORT_FREE
echo [OK] Port 3000 is available.
exit /b 0

:InstallDependencies
echo [5/5] Checking dependencies...
if not exist "node_modules\next\package.json" goto DO_INSTALL
if not exist ".launcher-package.sha256" goto DO_INSTALL
powershell -NoProfile -Command "$a=(Get-FileHash -LiteralPath 'package.json' -Algorithm SHA256).Hash; $b=(Get-Content -LiteralPath '.launcher-package.sha256' -Raw).Trim(); if($a -ne $b){exit 1}" >nul 2>&1
if errorlevel 1 goto DO_INSTALL
echo [OK] Dependencies already installed for this package.json.
exit /b 0
:DO_INSTALL
echo [NPM] Installing dependencies...
>> "%LOGFILE%" echo [NPM] Installing dependencies
if not exist "package-lock.json" goto NPM_INSTALL
call npm.cmd ci
if not errorlevel 1 goto NPM_INSTALLED
echo [WARN] npm ci failed; attempting npm install.
:NPM_INSTALL
call npm.cmd install
if errorlevel 1 goto NPM_FAILED
:NPM_INSTALLED
powershell -NoProfile -Command "(Get-FileHash -LiteralPath 'package.json' -Algorithm SHA256).Hash | Set-Content -LiteralPath '.launcher-package.sha256'" >nul 2>&1
echo [OK] Dependencies installed.
exit /b 0
:NPM_FAILED
echo [ERROR] npm dependency installation failed.
exit /b 1

:PreparePrisma
if not exist "prisma\schema.prisma" exit /b 0
echo [PRISMA] Generating Prisma Client...
call npx.cmd prisma generate
if errorlevel 1 exit /b 1
exit /b 0

:StartStreamServer
echo [STREAM] Preparing MediaMTX on RTMP port 1935...
if not exist "%STREAM_DIR%\mediamtx.yml" goto STREAM_NO_CONFIG
netstat -ano | findstr /R /C:":1935 .*LISTENING" >nul 2>&1
if not errorlevel 1 goto STREAM_ACTIVE
if exist "%STREAM_DIR%\mediamtx.exe" goto STREAM_START
if not exist "%STREAM_DIR%" mkdir "%STREAM_DIR%"
echo [STREAM] Downloading portable MediaMTX...
>> "%LOGFILE%" echo [STREAM] Download MediaMTX
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $tmp=Join-Path ([IO.Path]::GetTempPath()) ('mediamtx-'+[guid]::NewGuid().ToString('N')); try {New-Item -ItemType Directory -Path $tmp | Out-Null; $zip=Join-Path $tmp 'mediamtx.zip'; Invoke-WebRequest -Uri 'https://github.com/bluenviron/mediamtx/releases/download/v1.21.1/mediamtx_v1.21.1_windows_amd64.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $tmp 'extract'); $exe=Get-ChildItem -LiteralPath (Join-Path $tmp 'extract') -Filter 'mediamtx.exe' -Recurse -File | Select-Object -First 1; if(!$exe){throw 'MediaMTX executable missing'}; Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $env:STREAM_DIR 'mediamtx.exe') -Force; exit 0} catch {Write-Error $_; exit 1} finally {Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue}" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto STREAM_DOWNLOAD_FAILED
if not exist "%STREAM_DIR%\mediamtx.exe" goto STREAM_DOWNLOAD_FAILED
:STREAM_START
echo [STREAM] Starting MediaMTX...
start "ARENA MediaMTX" /min /D "%STREAM_DIR%" cmd.exe /d /c "mediamtx.exe mediamtx.yml 1>>stream.log 2>&1"
set "RTMP_WAIT=0"
:STREAM_WAIT
netstat -ano | findstr /R /C:":1935 .*LISTENING" >nul 2>&1
if not errorlevel 1 goto STREAM_ACTIVE
set /a RTMP_WAIT+=1
if %RTMP_WAIT% GEQ 10 goto STREAM_TIMEOUT
ping -n 2 127.0.0.1 >nul
goto STREAM_WAIT
:STREAM_ACTIVE
echo [OK] RTMP port 1935 is active. OBS key: arena
exit /b 0
:STREAM_NO_CONFIG
echo [WARN] MediaMTX config missing: mini-services\stream-server\mediamtx.yml
>> "%LOGFILE%" echo [WARN] Missing mediamtx.yml
exit /b 1
:STREAM_DOWNLOAD_FAILED
echo [WARN] MediaMTX download failed. See start-log.txt.
exit /b 1
:STREAM_TIMEOUT
echo [WARN] MediaMTX did not open port 1935. Review stream.log.
exit /b 1

:EnsureFFmpeg
echo [FFMPEG] Checking FFmpeg...
if exist "%FFMPEG_DIR%\ffmpeg.exe" goto FFMPEG_LOCAL
where ffmpeg.exe >nul 2>&1
if not errorlevel 1 goto FFMPEG_GLOBAL
if not exist "%FFMPEG_DIR%" mkdir "%FFMPEG_DIR%"
echo [FFMPEG] Downloading portable FFmpeg into .venv\Scripts...
>> "%LOGFILE%" echo [FFMPEG] Download FFmpeg
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $tmp=Join-Path ([IO.Path]::GetTempPath()) ('ffmpeg-'+[guid]::NewGuid().ToString('N')); try {New-Item -ItemType Directory -Path $tmp | Out-Null; $zip=Join-Path $tmp 'ffmpeg.zip'; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $tmp 'extract'); $exe=Get-ChildItem -LiteralPath (Join-Path $tmp 'extract') -Filter 'ffmpeg.exe' -Recurse -File | Select-Object -First 1; if(!$exe){throw 'FFmpeg executable missing'}; Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $env:FFMPEG_DIR 'ffmpeg.exe') -Force; $probe=Join-Path $exe.DirectoryName 'ffprobe.exe'; if(Test-Path -LiteralPath $probe){Copy-Item -LiteralPath $probe -Destination (Join-Path $env:FFMPEG_DIR 'ffprobe.exe') -Force}; exit 0} catch {Write-Error $_; exit 1} finally {Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue}" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto FFMPEG_FAILED
:FFMPEG_LOCAL
set "PATH=%FFMPEG_DIR%;%PATH%"
"%FFMPEG_DIR%\ffmpeg.exe" -version >nul 2>&1
if errorlevel 1 goto FFMPEG_FAILED
echo [OK] Local FFmpeg is ready.
exit /b 0
:FFMPEG_GLOBAL
echo [OK] System FFmpeg is available.
exit /b 0
:FFMPEG_FAILED
echo [WARN] FFmpeg download or validation failed. Check start-log.txt.
exit /b 1

:StartIngestServer
if not exist "%INGEST_DIR%\index.js" exit /b 0
where ffmpeg.exe >nul 2>&1
if errorlevel 1 goto INGEST_NO_FFMPEG
netstat -ano | findstr /R /C:":3030 .*LISTENING" >nul 2>&1
if not errorlevel 1 goto INGEST_ACTIVE
start "ARENA Ingest" /min /D "%INGEST_DIR%" cmd.exe /d /c "node index.js 1>>ingest.log 2>&1"
echo [INGEST] HTTP ingestion starting on port 3030.
exit /b 0
:INGEST_ACTIVE
echo [INGEST] Port 3030 is already active.
exit /b 0
:INGEST_NO_FFMPEG
echo [WARN] Ingest service skipped because FFmpeg is missing.
exit /b 0
