#!/usr/bin/env bash
# iOSアプリに入れる中身を作る。
#
# Web版（GitHub Pages）は /bean-tracker というサブパスの下に置くので
# NEXT_PUBLIC_BASE_PATH を渡してビルドしている。アプリの中では
# capacitor://localhost が起点になり、同じものを入れると
# /bean-tracker/_next/... を探しに行って真っ白になる。
# ここでは基準パスを空にして書き出す。
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ frontend を（サブパス無しで）書き出します"
cd frontend
npm ci --silent 2>/dev/null || npm install --silent
NEXT_PUBLIC_BASE_PATH="" npm run build
cd ..

# 書き出しの中身を軽く確かめる。真っ白なアプリを審査に出さないための保険。
INDEX="frontend/out/index.html"
test -f "$INDEX" || { echo "✗ $INDEX がありません"; exit 1; }
if grep -q '"/bean-tracker/_next' "$INDEX"; then
  echo "✗ サブパス付きのまま書き出されています（NEXT_PUBLIC_BASE_PATH が残っている）"
  exit 1
fi
grep -q '/_next/static' "$INDEX" || { echo "✗ アセットの参照が見つかりません"; exit 1; }

echo "✓ frontend/out を用意しました（$(du -sh frontend/out | cut -f1)）"
