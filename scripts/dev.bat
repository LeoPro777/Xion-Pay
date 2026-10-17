@echo off
title Xion-Pay Dev Server (Backend + Frontend)
echo =================================================================
echo   XION-PAY: Iniciando Backend y Frontend simultaneamente
echo =================================================================

set PYTHON_EXE=.\backend\.venv\Scripts\python.exe
if not exist %PYTHON_EXE% set PYTHON_EXE=python

%PYTHON_EXE% scripts\run_dev.py
pause
