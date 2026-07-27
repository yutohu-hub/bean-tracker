#!/usr/bin/env bash
# 巡回用の自己ホストランナーを1コマンドで用意する。
#
#   bash scripts/setup-runner.sh <登録トークン>
#
# 登録トークンの取り方:
#   GitHub → リポジトリ → Settings → Actions → Runners → New self-hosted runner
#   表示される ./config.sh --token XXXXX の XXXXX 部分
#
# なぜ必要か: GitHub共有ランナーのIPは Shopify から 429 で拒否され続けるため
# （待っても解消しないことを実測済み）、通常回線のIPから巡回する必要がある。
set -euo pipefail

REPO_URL="https://github.com/yutohu-hub/bean-tracker"
TOKEN="${1:-}"
DIR="${RUNNER_DIR:-$HOME/bean-tracker-runner}"

if [ -z "$TOKEN" ]; then
  echo "使い方: bash scripts/setup-runner.sh <登録トークン>"
  echo "トークン: $REPO_URL/settings/actions/runners/new の ./config.sh --token の値"
  exit 1
fi

# --- OS/CPU を判定して正しいランナーを選ぶ ---
case "$(uname -s)" in
  Darwin) OS=osx ;;
  Linux)  OS=linux ;;
  *) echo "未対応のOSです: $(uname -s)"; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH=x64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) echo "未対応のCPUです: $(uname -m)"; exit 1 ;;
esac

echo "==> 前提を確認"
command -v git >/dev/null || { echo "git が必要です"; exit 1; }
command -v python3 >/dev/null || { echo "python3 が必要です"; exit 1; }
python3 -c 'import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)' \
  || { echo "Python 3.10 以上が必要です（現在: $(python3 -V)）"; exit 1; }
python3 -m venv --help >/dev/null 2>&1 \
  || echo "  ※ venv が無いようです。Ubuntu/Debian なら: sudo apt install python3-venv"

echo "==> ランナーを $DIR に用意（$OS/$ARCH）"
mkdir -p "$DIR" && cd "$DIR"

if [ ! -f ./config.sh ]; then
  VER=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
        | sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p' | head -1)
  echo "    actions-runner v$VER を取得"
  curl -fsSL -o runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${VER}/actions-runner-${OS}-${ARCH}-${VER}.tar.gz"
  tar xzf runner.tar.gz && rm -f runner.tar.gz
fi

echo "==> リポジトリに登録"
./config.sh --url "$REPO_URL" --token "$TOKEN" \
            --name "$(hostname)-bean-tracker" --labels self-hosted \
            --unattended --replace

echo "==> 常駐サービスとして起動"
if [ "$OS" = "linux" ]; then
  sudo ./svc.sh install && sudo ./svc.sh start
else
  ./svc.sh install && ./svc.sh start
fi

cat <<'DONE'

==========================================================
ランナーの登録が完了しました。

残り1ステップ（ブラウザで30秒）:
  Settings → Secrets and variables → Actions → Variables タブ
  → New repository variable
       Name : CRAWL_RUNNER
       Value: self-hosted

これで毎日正午(JST)の巡回があなたのIPで動き、
図鑑の在庫・価格が自動更新されます。

停止したいとき: この端末で  cd ~/bean-tracker-runner && sudo ./svc.sh stop
共有ランナーに戻すとき: 上の変数 CRAWL_RUNNER を削除
==========================================================
DONE
