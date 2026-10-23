# SNSBUZZ

SNSでUGCとして拡散するWebコンテンツの調査と、その第1弾「愛されポンコツ診断（ポンコツ図鑑）」の実装です。

## 中身

| 場所 | 中身 |
|---|---|
| `reports/` | 調査レポート（何を作るべきか） |
| `research_notes/` | 調査メモ。`v2_benchmarks/` は成功例の結果ページの作りと、マネタイズの調査 |
| `docs/design.md` | 診断の設計（軸・20タイプ・20問・拡散の仕組み・KPI・公開前のTODO） |
| `docs/monetization.md` | マネタイズ計画（完全版・LINEスタンプ・B2B・広告・試算） |
| `docs/competitor_check.md` | 日本の類似診断の競合チェック |
| `content/` | タイプごとの文言（`types/NN.json`）と執筆ガイド（`BRIEF.md`） |
| `site/` | サイト本体（静的HTML＋ESモジュール。ビルドしなくても動く） |
| `functions/` | Cloudflare Pages Functions（集計・グループ診断・完全版の決済と配信） |
| `scripts/` | 文言の生成と検査、ビルド、OGP画像、SNS素材、スモークテスト |

## 動かし方

Node.js 20以上が必要です。

```sh
npm install
npm test           # 判定・相性・レア度のテスト
npm run build      # 文言を生成して site/ → dist/。タイプ別・おさそい・ペア・グループの着地ページも作る
npm run serve      # http://localhost:8787 で dist/ を表示（APIなし。グループ診断と完全版は使えない）
```

### API込みで手元で動かす

グループ診断や完全版（コードで開く）を試すときは、Cloudflare の wrangler を使います。

```sh
npx wrangler d1 execute ponkotsu-zukan --local --file=schema.sql
npm run build && npx wrangler pages dev --port 8788 \
  --binding PREMIUM_SECRET=dev-secret --binding PROMO_CODES=TEST2027 --binding KPI_TOKEN=dev
```

### 文言と画像

Chromium を使います。`CHROMIUM_PATH` でパスを指定できます。

```sh
npm run validate   # content/types/*.json の文字数・NGワードを検査
npm run content    # site/assets/types.js（無料部分）と functions/_lib/premium.js（有料部分）を生成
npm run og         # OGP画像を site/og/ に書き出す（コミットする）
npm run cards      # SNS投稿用の画像を cards/ に書き出す（タイプ紹介スライドと結果カードの見本）
npm run smoke      # スマホ幅で 診断→結果→シェア画像→おさそい→ふたりの相性→図鑑 を通しで操作し、JSエラーを確認
```

## 公開手順（Cloudflare Pages + D1）

1. `site/assets/config.js` の `origin`（本番ドメイン）と `seller`（特定商取引法の表記）を埋めて、`npm run og && npm run build` を実行する。
2. D1 を作り、出てきた ID を `wrangler.toml` の `database_id` に入れる。

   ```sh
   npx wrangler login
   npx wrangler d1 create ponkotsu-zukan
   npx wrangler d1 execute ponkotsu-zukan --remote --file=schema.sql
   ```

3. 環境変数（シークレット）を設定する。

   ```sh
   npx wrangler pages secret put <名前>
   ```

   | 名前 | 用途 | 必須 |
   |---|---|---|
   | `KPI_TOKEN` | `/api/stats?all=1` で全カウンタを見るためのトークン | 推奨 |
   | `RATE_SALT` | 回数制限に使うIPのハッシュ用の塩 | 推奨 |
   | `PREMIUM_SECRET` | 完全版の購入トークンの署名鍵（長いランダム文字列） | 完全版を出すなら必須 |
   | `STRIPE_SECRET_KEY` | Stripe のシークレットキー | 販売するなら必須 |
   | `STRIPE_PRICE_ID` | 390円の価格ID | 販売するなら必須 |
   | `PREMIUM_PRICE` | 画面に出す価格（既定 390） | 任意 |
   | `PROMO_CODES` | 完全版を開けるコード（カンマ区切り。キャンペーン・タイアップ用） | 任意 |

   `PREMIUM_SECRET`・`STRIPE_SECRET_KEY`・`STRIPE_PRICE_ID` の3つがそろうと、販売が始まります。そろっていない間は「準備中」と表示されます。

4. デプロイする。`functions/` も一緒に載ります。

   ```sh
   npx wrangler pages deploy
   ```

5. KPI を見る。

   ```sh
   curl -H "Authorization: Bearer <KPI_TOKEN>" https://<ドメイン>/api/stats?all=1
   ```

静的配信と Functions・D1 は Cloudflare の無料枠でほぼ収まります。AI生成は使っていないので、利用者が増えても1診断あたりの原価はかかりません。

## 公開前に人の手が必要なこと

詳しくは `docs/design.md` と `docs/monetization.md` を見てください。

- キャラ20体を、人の手で描いたイラストに差し替える（いまのSVGは仮）
- Stripe（またはKOMOJU）の業種審査を確認する（「占い」は禁止業種。完全版はエンタメの心理テストとして作っている）
- 名前・ドメイン・商標を確認する
- 自社SNSアカウントを開設し、運用を続ける
