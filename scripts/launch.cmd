@echo off
rem One-Click PC Privacy Shield launcher (ASCII only; no COM, no registry changes, no deletions)
rem Copy this .cmd into the folder that holds your sensitive .txt, then double-click it.
rem PC_SHIELD_DIR points at the folder to scan; PC_SHIELD_HOME points at this skill.
set "PC_SHIELD_DIR=%~dp0"
if not defined PC_SHIELD_HOME set "PC_SHIELD_HOME=%USERPROFILE%\.dsh\skills\pc-privacy-shield"
if not exist "%PC_SHIELD_HOME%\scripts\pc-shield.ps1" (
  echo [PC Privacy Shield] pc-shield.ps1 not found.
  echo Set PC_SHIELD_HOME to the folder that contains scripts\pc-shield.ps1, then retry.
  pause
  exit /b 2
)
start "" /B powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PC_SHIELD_HOME%\scripts\pc-shield.ps1"
