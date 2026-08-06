#!/usr/bin/env bash
# GitHub Pages の「詰まった配信」を取り消す。
#
# Pages の配信は一度に1本しか進まない。前の1本が終わらないまま居座ると、
# 後続は 400 で弾かれる。
#
#   Deployment request failed for 3557d694... due to in progress deployment.
#   Please cancel f14dfe0f... first or wait for it to complete.
#
# こうなると新しい中身が一切公開されず、サイトは開けないままになる。
# そこで配信の前に、github-pages 環境の過去の配信を取り消しておく。
# 取り消しの相手はコミットの sha（Pages の配信IDは sha そのもの）。
#
# ■ 状態で選り分けてはいけない
#
# 最初は Deployments API の state が queued / in_progress / pending のものだけを
# 取り消していた。これが効かなかった。2026-08-06 14:05 の実測:
#
#   詰まっている配信はありません            ← このスクリプトの出力
#   Please cancel f14dfe0f... first        ← その直後の Pages の返事
#
# f14dfe0f は Pages 側では「進行中」なのに、Deployments API 側では
# そう見えていない（deploy-pages が時間切れで自分の配信を取り消したあと、
# 2つの API の見え方がずれる）。状態を信じると、まさに詰まらせている1本を
# 見逃す。だから状態では絞らず、自分以外は片っ端から取り消す。
#
# 終わっている配信への取り消しは、相手側で弾かれるだけで害はない。
# 同時に走ることは concurrency: pages で防いでいる。
#
# ■ 今回の sha には絶対に触らない
#
# 自分の分を取り消すと、そのあと何度配信しても「Deployment cancelled.」で
# 即座に弾かれる（実測: 2026-08-06 13:17 の 4c9cfe81。公開が2回とも落ちた）。
#
# 取り消せなくても失敗にはしない。呼び出し側は続けて配信を試す。
#
# 使い方: GH_TOKEN=... scripts/unstick-pages-deploy.sh [取り消したあとの待ち秒数]

set -uo pipefail

wait_after="${1:-20}"
repo="$GITHUB_REPOSITORY"
tried=0

while IFS=$'\t' read -r id sha; do
  [ -n "$id" ] || continue
  [ "$sha" = "$GITHUB_SHA" ] && continue          # 自分の分は残す

  state=$(gh api "repos/$repo/deployments/$id/statuses?per_page=1" \
            --jq '.[0].state // "none"' 2>/dev/null || echo none)

  # 状態は判断には使わず、記録のためだけに出す（上の理由）
  if out=$(gh api -X POST "repos/$repo/pages/deployments/$sha/cancel" 2>&1); then
    echo "取り消した: ${sha:0:8} (Deployments API では $state)"
    tried=$((tried + 1))
  else
    # 終わっている配信はここに来る。詰まりの原因ではないので黙って流す
    echo "そのまま: ${sha:0:8} ($state) — $(echo "$out" | head -1)"
  fi
done < <(gh api "repos/$repo/deployments?environment=github-pages&per_page=10" \
           --jq '.[] | [.id, .sha] | @tsv' 2>/dev/null || true)

if [ "$tried" = "0" ]; then
  echo "取り消せた配信はありません"
else
  echo "$tried 本を取り消したので ${wait_after} 秒待ちます"
  sleep "$wait_after"
fi
