# SNSBUZZ

SNSでUGCとして拡散するWebコンテンツの調査と、その第1弾「愛されポンコツ診断（ポンコツ図鑑）」の実装です。

- **かんたん診断**（12問・約1分・全部無料）で、20タイプ（うち隠し4タイプ）のどれかがわかります。
- **くわしい診断**（＋24問・約3分）を足すと、二つ名（240通り）・恋愛タイプ（8種）・10項目のステータスがわかります。
- くわしい診断のレポート（全8章）は、ふんわりした部分を無料で見せます。くわしい部分はモザイクで、完全版（390円・買い切り）で読めます。

## 中身

| 場所 | 中身 |
|---|---|
| `reports/` | 調査レポート（何を作るべきか） |
| `research_notes/` | 調査メモ。`v2_benchmarks/` は結果ページの作りとマネタイズ、`v3/` はチラ見せ・ペイウォール・2段階診断・友達クイズの調査 |
| `docs/design.md` | 診断の設計（12問＋24問・20タイプ・パラメータ・二つ名・レポートの章立て・拡散の仕組み・KPI・公開前のTODO） |
| `docs/monetization.md` | マネタイズ計画（無料と有料の分け方・完全版の購入の流れ・おうちの人の支払い・LINEスタンプ・B2B・広告・試算） |
| `docs/competitor_check.md` | 日本の類似診断の競合チェック |
| `content/` | タイプごとの文言（`types/NN.json`）、パラメータ（`params.json`）、恋愛タイプ（`love.json`）と執筆ガイド（`BRIEF.md`・`BRIEF_v3.md`） |
| `site/` | サイト本体（静的HTML＋ESモジュール。ビルドしなくても動く） |
| `functions/` | Cloudflare Pages Functions（集計・グループ診断・完全版の決済と配信・見本・おうちの人の支払いの受け取り） |
| `scripts/` | 文言の生成と検査、ビルド、OGP画像、SNS素材、スモークテスト |

## 動かし方

Node.js 20以上が必要です。

```sh
npm install
npm test           # 判定・相性・レア度・二つ名・結果コードと、API（決済・Webhook・返金・プレゼント・受け取り・グループ）のテスト
npm run build      # 文言を生成して site/ → dist/。タイプ別・おさそい・ペア・グループの着地ページも作る
npm run serve      # http://localhost:8787 で dist/ を表示（APIなし。グループ診断と完全版は使えない）
```

### API込みで手元で動かす

グループ診断や完全版（コードで開く）を試すときは、Cloudflare の wrangler を使います。

```sh
npx wrangler d1 execute ponkotsu-zukan --local --file=schema.sql
npm run build && npx wrangler pages dev --port 8799 \
  --binding PREMIUM_SECRET=dev-secret --binding PROMO_CODES=TEST2027 --binding KPI_TOKEN=dev
```

起動したまま、別のターミナルで通しの確認ができます。

```sh
node scripts/e2e-api.mjs   # 見本・コードで開く・Cookieからの復元・引き継ぎリンク・おうちの人の支払い・プレゼント・決済後の再試行・グループ
```

### 文言と画像

Chromium を使います。`CHROMIUM_PATH` でパスを指定できます。

```sh
npm run validate   # content/ の文字数・NGワード（占い・予言の語を含む）を検査
npm run content    # site/assets/types.js（無料部分と有料の文字数）と functions/_lib/premium.js（有料部分）を生成
npm run og         # OGP画像を site/og/ に書き出す（コミットする）
npm run cards      # SNS投稿用の画像を cards/ に書き出す（タイプ紹介スライドと結果カードの見本）
npm run smoke      # スマホ幅で かんたん診断→くわしい診断→レポート（モザイク）→シェア画像→おさそい→相性→わたしクイズ→図鑑 を通しで操作。
                   # JSエラー・有料文の漏れ・購入案内の自動表示が1回までか・4つの画面幅での横はみ出しを確認
```

## 公開手順（Cloudflare Pages + D1）

1. `site/assets/config.js` の `origin`（本番ドメイン）と `seller`（特定商取引法の表記）を埋めて、`npm run og && npm run build` を実行する。
2. D1 を作り、出てきた ID を `wrangler.toml` の `database_id` に入れる。

   ```sh
   npx wrangler login
   npx wrangler d1 create ponkotsu-zukan
   npx wrangler d1 execute ponkotsu-zukan --remote --file=schema.sql
   ```

   v3.1 でテーブルの形が変わりました（`purchases`・`rl` の追加、`groups` に管理キーの列）。公開前なので、手元の D1 は作り直してください（`rm -rf .wrangler/state` のあと上のコマンド）。

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
   | `STRIPE_PRICE_ID` | 390円（じぶん用）の価格ID | 販売するなら必須 |
   | `PREMIUM_PRICE` | 画面に出す、じぶん用の価格（既定 390）。Stripeの価格と同じにする | 任意 |
   | `STRIPE_PRICE_ID_DUO` | 590円（ふたり用・友達に1つプレゼント）の価格ID。設定したときだけ、ふたり用を出す | 任意 |
   | `PREMIUM_PRICE_DUO` | 画面に出す、ふたり用の価格（既定 590） | 任意 |
   | `STRIPE_WEBHOOK_SECRET` | Stripe の Webhook の署名シークレット。ブラウザが戻らなかった購入の受け取りと、返金の反映に使う | 販売するなら必須 |
   | `STRIPE_PAYMENT_METHODS` | 支払い方法（既定 `card`。Apple Pay・Google Pay をふくむ）。PayPay を足すなら `card,paypay` | 任意 |
   | `PROMO_CODES` | 完全版を開けるコード（カンマ区切り。`CODE:2027-03-31` で期限つき。キャンペーン・タイアップ用） | 任意 |

   `PREMIUM_SECRET`・`STRIPE_SECRET_KEY`・`STRIPE_PRICE_ID` の3つがそろうと、販売が始まります。そろっていない間は「準備中」と表示されます。

   Stripe のダッシュボードで Webhook を作ります。送り先は `https://<ドメイン>/api/stripe-webhook`、イベントは `checkout.session.completed`・`checkout.session.async_payment_succeeded`・`charge.refunded` です。署名シークレットを `STRIPE_WEBHOOK_SECRET` に入れます。

   購入者から「読めなくなった」と連絡があったときは、Stripe で支払いを確かめてから、引き継ぎリンクを作り直して送ります。

   ```sh
   PREMIUM_SECRET=<本番と同じ値> node scripts/issue-token.mjs cs_live_xxx https://<ドメイン>
   ```

4. デプロイする。`functions/` も一緒に載ります。

   ```sh
   npx wrangler pages deploy
   ```

5. KPI を見る。

   ```sh
   curl -H "Authorization: Bearer <KPI_TOKEN>" https://<ドメイン>/api/stats?all=1
   ```

### API

| パス | 中身 |
|---|---|
| `POST /api/event` | 診断の開始・完了・シェアなどを数える（回数だけ） |
| `GET /api/stats` | タイプ別の完了数（レア度用）。`?all=1` と `KPI_TOKEN` で全カウンタ |
| `POST /api/groups` ・ `GET/POST /api/groups/<id>` | グループ診断の作成・表示・参加 |
| `DELETE /api/groups/<id>` | グループから抜ける／作った人がメンバーを外す・グループを消す |
| `GET /api/premium/status` | 販売中かどうかと、プラン・価格・支払い方法 |
| `GET /api/premium` | 完全版の本文。購入トークン（ヘッダか Cookie）が必要。返金済み・終了したコードは 403 |
| `POST /api/checkout` | Stripe の価格が画面の価格と同じか確かめてから、Checkout の支払いページを作る |
| `GET /api/unlock` | 決済から戻ったブラウザに購入トークンを渡す（決済から24時間まで） |
| `POST /api/stripe-webhook` | Stripe の通知。購入と、おうちの人の支払いの受け取りを記録し、返金で無効にする |
| `GET /api/claim` | おうちの人の支払いが終わったら、子どもの端末（秘密の文字列を持つ端末だけ）にトークンを渡す |
| `GET /api/gift` ・ `POST /api/gift` | ふたり用のプレゼント券を出す／1回だけ受け取る |
| `GET /api/restore` | ブラウザのデータが消えたとき、Cookie から購入トークンを戻す |
| `POST /api/redeem` | キャンペーンのコードでトークンを出す |

静的配信と Functions・D1 は Cloudflare の無料枠でほぼ収まります。AI生成は使っていないので、利用者が増えても1診断あたりの原価はかかりません。

## 公開前に人の手が必要なこと

詳しくは `docs/design.md` と `docs/monetization.md` を見てください。

- キャラ20体を、人の手で描いたイラストに差し替える（いまのSVGは仮）
- Stripe（またはKOMOJU）の業種審査を確認する（「占い」は禁止業種。完全版はエンタメの心理テストとして作っている）
- 名前・ドメイン・商標を確認する
- 自社SNSアカウントを開設し、運用を続ける
