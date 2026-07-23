# BEAN TRACKER

世界中のコーヒー豆に辿り着くためのインフラ ── 売らない、評価しない、送客に徹する。

これは Next.js で作られたプロトタイプです。図鑑・地球・診断・味わい・レアロットの5画面が動きます。
（データはまだサンプルです。自動巡回・実データ連携は次のステップで追加します）

---

## これは何をするもの?

- **図鑑**: 豆をグリッドで一覧。産地・価格・精製・在庫でフィルタ。¥/$ 換算切替つき
- **地球**: 回る地球儀からロースターを探す
- **診断**: 4問であなたの好みタイプと相性ロースターを提案
- **味わい**: 味の座標マップ。色と動きで系統がわかる
- **レアロット**: ゲイシャ・シドラなど希少品種を 100gあたり価格で並べて追跡

---

## 公開するまで（GitHub Pages・自動デプロイ）

このリポジトリには公開の自動化が同梱されています（`.github/workflows/deploy-frontend.yml`）。
`frontend/` を静的サイトとして書き出し、GitHub Pages に自動でデプロイします。**外部サービスの登録は不要**です。

### 手順（初回だけ）

1. この内容を **`main` ブランチにマージ**（Pull Request を作ってマージ）。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **「GitHub Actions」** にする。
   - ワークフローが `enablement: true` で自動有効化を試みますが、反映されない場合はここを手動で選択。
3. **Actions** タブ →「フロント公開 (GitHub Pages)」→ **Run workflow**（または `frontend/` を変更して main に push）。
4. 1〜2分で `https://<あなたのID>.github.io/bean-tracker/` に公開されます 🎉

### 以後は自動

`frontend/` を編集して `main` に push するたびに、ビルド→公開まで**全自動**で走ります。
（配信先のサブパス `/bean-tracker` は `next.config.mjs` の `basePath` を CI が自動設定します。）

### Vercel を使いたい場合（任意）

Vercel でも公開できます。その場合は Import 時に **Root Directory を `frontend`** に指定してください
（`next.config.mjs` の `output: "export"` があっても Vercel は Next.js として最適配信します）。

---

## 自分のパソコンで動かして確認する（任意）

公開前に手元で見たいときは、フォルダの中でこう打ちます:

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開くと動きます。

---

## この先の育て方（メモ）

- **実データ化**: `components/data/roasters/`（地域別 `ROASTERS`）と `components/data/beans.js`（`BEANS`）のサンプルデータを、巡回で取得した本物のデータに差し替える
- **自動巡回**: GitHub Actions（毎朝1回）で各ロースターのECを巡回 → データ更新 → 自動で反映
  - Shopify は `/products.json` で取得、BASE / STORES は専用パーサー
  - 消えた豆は削除せず「アーカイブ」保存（初日から貯めるのが大事）
- **会員・通知（v2）**: ログインは Supabase Auth など、決済は Stripe に委譲（自作しない）
- **送客計測**: 各ECリンクを `/go/豆ID` の中継URL＋UTMパラメータ経由にして、クリックを記録

---

## 技術メモ

- Next.js 14（App Router）/ React 18 / d3（地球儀）
- 状態はすべてメモリ内。外部DB・APIキーは現時点で不要
- ファイル構成（データ / UI / ロジックを分離）:
  - `components/BeanTracker.jsx` — アプリ本体（各画面を組み立てるメイン）
  - **画面コンポーネント**
    - `components/ui/` — 共通パーツ（`Package` / `BeanCard` / `DetailSheet` / `Splash`）
    - `components/views/` — 各画面（`RoasterPage` / `GlobeView` / `DiagnosisView` / `FlavorMapView` / `GeishaView`）
  - **データ**（地域別に分割 → インデックスで統合）
    - `components/data/roasters.js` + `components/data/roasters/<地域>.js` — `ROASTERS` / `ROASTER_GROUPS`。各社に `region` 付き。追加はここを編集
    - `components/data/beans.js` + `components/data/beans/<地域>.js` — `BEANS`
    - 地域キー: `nordic` / `uk` / `europe` / `northAmerica` / `oceania` / `eastAsia` / `seAsiaIndia` / `latinAmerica` / `africaMideast`
    - `components/data/flavors.js` — `FLAVORS` / `FLAVOR_MAP`（味わいマップ）
    - `components/data/diagnosis.js` — `QUESTIONS` / `TYPE_LABEL`（好み診断）
  - **ロジック / 定数**
    - `components/lib/currency.js` — 為替レート・価格フォーマッタ・ライブレート取得
    - `components/lib/theme.js` — 配色・ステータス表示（`STATUS`）
    - `components/lib/constants.js` — 原産地リスト（`ORIGINS`）
    - `components/lib/utils.js` — 送客リンク生成（`shopHref`）
