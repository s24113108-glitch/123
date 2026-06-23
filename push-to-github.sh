#!/usr/bin/env bash
# 用法: ./push-to-github.sh https://github.com/username/repo.git
if [ -z "$1" ]; then
  echo "Usage: $0 https://github.com/username/repo.git"
  exit 1
fi
git init
git add .
git commit -m "initial commit"
git remote add origin "$1"
git branch -M main
git push -u origin main
echo "推送完成。若需要憑證或 SSH，請按提示或先設定 SSH key。"
