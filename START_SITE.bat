@echo off
set "SITE_FILE=%~dp0index.html"

if not exist "%SITE_FILE%" (
  echo index.html was not found next to this script.
  pause
  exit /b 1
)

start "" "%SITE_FILE%"
