#!/usr/bin/env bash
# GitHub Pages の「詰まった配信」を取り消す。
#
# Pages の配信は一度に1本しか進まない。前の1本が終わらないまま居座ると、
# 後続は deployment_queued のまま10分待って諦める（実測: 2026-08-06 12:56 の
# 2本とも、10分間ずっと deployment_queued のまま失敗）。こうなると
# 新しい中身が一切公開されず、サイトは開けないままになる。
#
# そこで配信の前に、github-pages 環境のまだ終わっていない配信を取り消す。
# 取り消しの相手はコミットの sha（Pages の配信IDは sha そのもの）。
#
# 今回の sha（$GITHUB_SHA）には絶対に触らない。自分の分を取り消すと、
# そのあと何度配信しても「Deployment cancelled.」で即座に弾かれる
# （実測: 2026-08-06 13:17 の 4c9cfe81。これで公開が2回とも落ちた）。
#
# 取り消せなくても失敗にはしない。呼び出し側は続けて配信を試す。
#
# 使い方: GH_TOKEN=... scripts/unstick-pages-deploy.sh [取り消したあとの待ち秒数]

set -uo pipefail

wait_after="${1:-20}"
repo="$GITHUB_REPOSITORY"
found=0

while IFS=$'\t' read -r id sha; do
  [ -n "$id" ] || continue
  [ "$sha" = "$GITHUB_SHA" ] && continue          # 自分の分は残す
  state=$(gh api "repos/$repo/deployments/$id/statuses?per_page=1" \
            --jq '.[0].state // "none"' 2>/dev/null || echo none)
  case "$state" in
    queued|in_progress|pending)
      echo "居座っている配信: $sha ($state) → 取り消す"
      gh api -X POST "repos/$repo/pages/deployments/$sha/cancel" 2>&1 || true
      found=1
      ;;
  esac
done < <(gh api "repos/$repo/deployments?environment=github-pages&per_page=30" \
           --jq '.[] | [.id, .sha] | @tsv' 2>/dev/null || true)

if [ "$found" = "0" ]; then
  echo "詰まっている配信はありません"
else
  echo "取り消したので ${wait_after} 秒待ちます"
  sleep "$wait_after"
fi
