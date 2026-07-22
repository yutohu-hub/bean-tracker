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

## 公開するまで（3ステップ）

パソコンにこのフォルダがある前提です。難しい設定はありません。

### ステップ1 — GitHub に置く

1. [github.com](https://github.com) でアカウントを作る（無料）
2. 右上の「＋」→「New repository」でリポジトリを作る
   - 名前は `bean-tracker` など。Public のままでOK
3. 作成後の画面に出るコマンドを使うか、GitHub Desktop アプリを使ってこのフォルダを丸ごとアップロードする
   - いちばん簡単なのは [GitHub Desktop](https://desktop.github.com/) を入れて、このフォルダを「Add existing repository」で選び、「Publish」を押す方法

### ステップ2 — Vercel に繋ぐ

1. [vercel.com](https://vercel.com) に GitHub アカウントでログイン（無料）
2. 「Add New...」→「Project」
3. さっき作った `bean-tracker` リポジトリを選んで「Import」
4. 設定は何も変えずに「Deploy」を押す

数十秒待つと、`https://bean-tracker-xxxx.vercel.app` のような URL が発行されます。これで世界に公開されました。

### ステップ3 — 以後は自動

コードを直して GitHub に上げる（push する）たびに、Vercel が自動でサイトを更新します。
あなたがやることは「コードを直して上げる」だけです。

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
- ファイル構成（データとUIを分離）:
  - `components/BeanTracker.jsx` — UI本体（各画面のコンポーネント）
  - `components/data/roasters.js` — 地域別ファイルを統合するインデックス（`ROASTERS` / `ROASTER_GROUPS`）
  - `components/data/roasters/` — 地域別のロースター定義（`nordic` / `uk` / `europe` / `northAmerica` / `oceania` / `eastAsia` / `seAsiaIndia` / `latinAmerica` / `africaMideast`）。各社に `region` フィールド付き。追加時はここを編集
  - `components/data/beans.js` — `BEANS`（豆データ）
  - `components/data/flavors.js` — `FLAVORS` / `FLAVOR_MAP`（味わいマップ）
  - `components/data/diagnosis.js` — `QUESTIONS` / `TYPE_LABEL`（好み診断）
  - `components/lib/currency.js` — 為替レート・価格フォーマッタ・ライブレート取得
