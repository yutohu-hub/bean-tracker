# 自己ホストランナーで巡回する

## なぜ必要か

GitHub Actions の共有ランナーから Shopify の商品API（`/products.json`）にアクセスすると、
ほぼ全店が **HTTP 429（Too Many Requests）** を返します。これは巡回のやり方ではなく、
**GitHub のIPアドレス帯に対する制限**です。実測で確認しました。

- 待機を 15秒 → 30秒 → 60秒 → 90秒 と延ばして1回58分かけても、結果は変わらず429
- 取得できるのは Manhattan Coffee Roasters（WooCommerce）のみ = 37店舗中1店舗

自宅PCやVPSなど**普通の回線のIP**から巡回すれば、この制限を受けにくくなります。

## 手順

### 1. ランナーを登録する

巡回を動かしたいマシン（自宅PC / Mac / VPS など。常時起動でなくてOK）で:

1. GitHub の当リポジトリ → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. OS を選ぶと表示されるコマンドをそのまま実行（ダウンロード → `./config.sh` → 認証）
3. サービスとして常駐させる場合:

```bash
# Linux
sudo ./svc.sh install && sudo ./svc.sh start

# macOS
./svc.sh install && ./svc.sh start
```

常駐させない場合は、巡回したいときに `./run.sh` を実行しておくだけでも動きます
（実行中にスケジュールが来た分だけ巡回されます）。

### 2. 必要なもの

- **Python 3.10 以上**（`python3 --version` で確認）
- **git**
- venv が使えること（Debian/Ubuntu なら `sudo apt install python3-venv`）

※ venv が無い環境でも `pip install --user` に自動で切り替わります。

### 3. 切り替える

GitHub の当リポジトリ → **Settings** → **Secrets and variables** → **Actions** → **Variables** タブ
→ **New repository variable**

| Name | Value |
|---|---|
| `CRAWL_RUNNER` | `self-hosted` |

これだけで次回の巡回から自己ホストランナーが使われます。

### 4. 確認する

**Actions** タブ → 「Bean Tracker 巡回」→ **Run workflow** で手動実行し、ログを見ます。

```
✓ Kurasu — 42件
✓ Onibus Coffee — 31件
✓ Goodman Roaster — 12件
```

このように `✓` が増えていれば成功です。`429` が消えない場合は、そのIPも制限されている
可能性があるため、別回線（モバイル回線テザリング等）で試してください。

## 元に戻す

リポジトリ変数 `CRAWL_RUNNER` を**削除**すれば、GitHub の共有ランナーに戻ります。
ワークフローは `vars.CRAWL_RUNNER || 'ubuntu-latest'` と書いてあるため、
変数が無い間は従来どおり動き、**設定途中で巡回が止まることはありません**。

## 注意

- 自己ホストランナーは、そのマシンでリポジトリのコードを実行します。
  **公開リポジトリでは、外部からのPull Requestが自己ホストランナー上で実行されないよう**
  Settings → Actions → 「Fork pull request workflows」の設定を確認してください。
- ランナーが停止している間、スケジュール実行はキューに入ったままになります。
  長期間止める場合は `CRAWL_RUNNER` を削除して共有ランナーに戻してください。
