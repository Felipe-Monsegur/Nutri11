@echo off
REM Script para iniciar Nutri11 en local
cd /d "%~dp0"
echo ========================================
echo   Nutri11 - Desarrollo local
echo ========================================
echo.
echo La aplicacion estara disponible en: http://localhost:5180
echo.
echo Presiona Ctrl+C para detener la aplicacion
echo.

start "" "http://localhost:5180"
call npm.cmd run dev

pause
