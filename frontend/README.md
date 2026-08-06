# BEAN TRACKER（フロント）

世界中のコーヒー豆に辿り着くためのインフラ ── 売らない、評価しない、送客に徹する。

Next.js 14（App Router）で作った閲覧用の画面です。静的書き出し（`output: "export"`）
なのでサーバは要りません。GitHub Pages に置いています。

**データは巡回した本物です。** リポジトリ直下の Python クローラーが各ロースターの EC を
回り、`components/data/live.generated.json` を更新します。手で確認した種データ
（`seedBeans`）は、巡回で実データが取れたロースターのぶんだけ差し替わります
（`components/data/beans.js`）。

---

## 画面

| 画面 | 中身 |
| --- | --- |
| 図鑑 | 豆を一覧。産地・価格・精製・在庫で絞り込み、¥/$ 切替 |
| 地球 | 回る地球儀からロースターを探す |
| 診断 | 4問で好みの型と相性のロースターを出す |
| 味わい | 味の座標マップ。精製ごとのページにも降りられる |
| レアロット | ゲイシャ・シドラなどを 100gあたりの価格で並べる |
| ☕ 味の記録 | 飲んだ豆の記録・ポートフォリオ・ログイン・同期 |
| プレミアム | プラン、通知の設定 |
| About | このサイトの成り立ちと、いま図鑑に入っているものの内訳 |

画面の状態は URL に載ります（`?v=` 表示中の画面 / `?b=` 開いている豆 / `?r=` ロースター …）。
そのまま送れば同じ画面が開きます（`components/lib/urlState.js`）。

## 手元で動かす

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # eslint
npm run build    # 静的書き出し（out/）
```

公開と同じ見え方を確かめたいときは、サブパスを付けて書き出します。

```bash
NEXT_PUBLIC_BASE_PATH=/bean-tracker npm run build
```

## 公開

`.github/workflows/deploy-frontend.yml` が `main` への push で走り、書き出して
GitHub Pages へ配信します。配信先のサブパス（`/bean-tracker`）は CI が
`actions/configure-pages` から受け取って渡すので、手で書く場所はありません。

初回だけ **Settings → Pages → Build and deployment → Source** を
**「GitHub Actions」** にしてください。`Deploy from a branch` のままだと、
ブランチ公開とワークフロー公開が両方走り、配信が互いの順番待ちで詰まります
（2026-08-06 の File not found はこれが原因でした）。

公開のあと、ワークフロー自身が実際にページを開いて 200 が返るかを確かめます。
開けなければ公開は失敗として止まります。

## ファイルの置き方

```
app/                      ルート（page.jsx と legal/）
components/
  BeanTracker.jsx         画面の組み立てと、URL・為替・絞り込みの配線
  ui/                     共通パーツ（BeanCard / DetailSheet / Portfolio / Splash …）
  views/                  各画面（GlobeView / FlavorMapView / MyLogView / PremiumView …）
  lib/                    見た目を持たない部分
  data/                   豆とロースター
```

**lib/**（画面から計算を追い出す場所）

| ファイル | 役割 |
| --- | --- |
| `catalog.js` | 図鑑の絞り込み・並び替え・ページ割り |
| `currency.js` | 為替（対円）、価格の文字づくり、100gあたりの換算 |
| `palette.js` | 精製方法ごとの色。100gあたりの値段でレア色に振る |
| `urlState.js` | 画面の状態を URL に載せる／読み戻す |
| `store.js` | 端末内の保存（味の記録・通知設定・再入荷ウォッチ） |
| `account.js` | ログインと同期（Supabase。未設定でも端末内だけで動く） |
| `entitlements.js` `usePlan.js` `billing.js` | プランと上限、Stripe への受け渡し |
| `push.js` | プッシュ通知の購読（iPhone はホーム画面に追加が条件） |
| `photos.js` | 味の記録の写真（IndexedDB） |
| `isCoffee.js` | 巡回データから豆以外（器具・サブスク・卸）を落とす |
| `theme.js` `constants.js` `utils.js` `analysis.js` | 配色・産地リスト・送客リンク・集計 |

**data/**

| ファイル | 役割 |
| --- | --- |
| `roasters.js` + `roasters/<地域>.js` | `ROASTERS` / `ROASTER_GROUPS`。追加は地域ファイルへ |
| `seedBeans.js` | 手で確認した豆。巡回データが無いロースターの分だけ残る |
| `live.generated.json` / `live.js` | 巡回の実データ（クローラーが書き換える） |
| `beans.js` | 上の2つを重ねて `BEANS` にする |
| `flavors.js` | 味わいマップの座標 |
| `note.generated.json` | note の記事見出し（About に出す） |

地域キー: `nordic` / `uk` / `europe` / `northAmerica` / `oceania` / `eastAsia` /
`seAsiaIndia` / `latinAmerica` / `africaMideast`

## 覚えておくこと

- **`next/image` は使わない。** 最適化サーバが無い書き出しで、`images.unoptimized` も
  立てている。味の記録の写真は IndexedDB から読む `data:` URL で、そもそも扱えない。
  eslint 側でもこの警告は切ってある（理由は `.eslintrc.js` に書いた）。
- **Cesium は遅延読み込み。** 地球儀を開くまで取りに行かない。`public/cesium/` は
  `scripts/copy-cesium.mjs` が build/dev の前に複製する（コミットしない）。
- **オフライン。** `public/sw.js`。ページの取得だけは毎回ネットに行き、落ちたときだけ
  保存したものを出す。JS や画像は保存優先。中身を変えたらキャッシュ名を上げる。
