@echo off
REM 用法: push-to-github.bat https://github.com/username/repo.git
if "%~1"=="" (
  echo Usage: push-to-github.bat https://github.com/username/repo.git
  exit /b 1
)
git init
git add .
git commit -m "initial commit"
git remote add origin %~1
git branch -M main
git push -u origin main
echo 推送完成（若提示輸入帳密或使用 SSH 請依指示操作）。
