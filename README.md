# BEAN TRACKER 🌍☕

世界のスペシャルティロースターのECサイトを自動巡回して、**新着・再入荷・売り切れ**を検知するトラッカー。BeanHoardと同じ原理で、あなたのGitHubアカウント上で無料で動き続けます。

## このリポジトリの構成

このリポジトリには2つの実装が共存しています。

- **ルート（Python版クローラー）** — GitHub Actionsで各ECを巡回し、差分検知して `docs/` に静的サイトを生成する本体（下記「仕組み」以降）。
- **`frontend/`（Next.js版UIプロトタイプ）** — 図鑑・地球・診断・味わい・レアロットの5画面を持つ閲覧用UI。現時点はサンプルデータで動作。詳細は `frontend/README.md` を参照。
  ```bash
  cd frontend
  npm install
  npm run dev    # http://localhost:3000
  npm run build  # 本番ビルド（動作確認済み）
  ```

## 仕組み

```
GitHub Actions（6時間ごと）
   ↓
crawler.py が各店のECを巡回
   （Shopify → /products.json、WooCommerce → /wp-json/... を自動判定）
   ↓
state.py が前回のDBと比較して差分を検知
   ・初めて見た商品 → 新着
   ・12時間以上欠品→復活 → 再入荷（欠品期間つき）
   ・在庫あり→なし → 売り切れ
   ↓
build_site.py が docs/ にサイトを生成 → GitHub Pagesで公開
   （任意）notify.py がDiscordに通知
```

## セットアップ（15分・コード編集不要）

1. **GitHubにリポジトリを作る**
   github.com で「New repository」→ 名前は `bean-tracker` など → Public で作成。

2. **このフォルダの中身を全部アップロード**
   リポジトリ画面の「uploading an existing file」からドラッグ&ドロップでOK。
   `.github` フォルダ（隠しフォルダ）も忘れずに。コマンドが使えるなら:
   ```bash
   git init && git add . && git commit -m "init"
   git remote add origin https://github.com/あなたのID/bean-tracker.git
   git push -u origin main
   ```

3. **Actionsを有効化**
   リポジトリの「Actions」タブ →「I understand… enable them」→
   左の「Bean Tracker 巡回」→「Run workflow」で初回を手動実行。

4. **Pagesを有効化**
   「Settings」→「Pages」→ Source: `Deploy from a branch`、
   Branch: `main` / フォルダ: `/docs` → Save。
   数分後 `https://あなたのID.github.io/bean-tracker/` でサイトが見られます。

以降は**6時間ごとに自動巡回**され、サイトが勝手に更新されます。

## ロースターの追加・削除

`config/roasters.yaml` に1ブロック追記するだけ:

```yaml
  - name: 好きなロースター
    country: JP
    url: https://example-shop.com
    currency: JPY
```

ShopifyかWooCommerceの店ならそのまま動きます（世界のスペシャルティ系はかなりの割合がShopify）。取得に失敗した店はサイトのフッターに表示されるので、URLを見直すか削除してください。

## Discord通知（任意）

1. Discordのサーバー設定 → 連携サービス → Webhook作成 → URLコピー
2. GitHubリポジトリの Settings → Secrets and variables → Actions →
   「New repository secret」で名前 `DISCORD_WEBHOOK_URL`、値にURLを貼る

以降、新着・再入荷があるたびDiscordに届きます。

## ローカルでの動作テスト

```bash
pip install -r requirements.txt
python main.py --mock fixtures   # ネット不要のテストデータで一巡
python main.py                   # 実際に巡回（数分かかります）
open docs/index.html             # 生成されたサイトを確認
```

## 設定値（config/roasters.yaml の settings）

| キー | 意味 | 初期値 |
|---|---|---|
| min_oos_hours | 何時間以上の欠品からの復活を「再入荷」とみなすか | 12 |
| max_pages | 1店舗あたりの最大取得ページ数（250商品/頁） | 4 |
| concurrency | 同時アクセス数 | 8 |

## 注意とマナー

- 巡回は6時間に1回・各店への同時アクセスは控えめに設定してあります。頻度を上げすぎない（cronを1時間未満にしない）こと。
- 価格・在庫は各店の公開データのスナップショットです。購入前に必ず店舗ページで確認を。
- 各ストアの利用規約は尊重してください。あくまで個人のチェック用ツールとして。
