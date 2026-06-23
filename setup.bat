@echo off
REM 臨時允許 PowerShell 執行政策並安裝 npm 套件（只在此視窗）
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process; npm install"
if %ERRORLEVEL% neq 0 (
  echo npm install 發生錯誤，請檢查終端輸出。
) else (
  echo 套件安裝完成。
)
echo 若要啟動伺服器，執行: npm start
