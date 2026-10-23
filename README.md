# SNSBUZZ

SNSでUGCとして拡散するWebコンテンツの調査と、その第1弾「愛されポンコツ診断（ポンコツ図鑑）」の試作です。

| 場所 | 中身 |
|---|---|
| `reports/` | 調査レポート（何を作るべきか） |
| `research_notes/` | レポートのもとになった調査メモ |
| `docs/design.md` | 診断の設計（軸、タイプ、質問、シェア設計、KPI、公開前のTODO） |
| `docs/competitor_check.md` | 日本の類似診断の競合チェック |
| `site/` | サイト本体（静的HTML＋JS、ビルドなしでも動く） |
| `functions/api/` | Cloudflare Pages Functions（診断数・シェア数の集計） |
| `scripts/` | ビルド、OGP画像生成、SNS素材の書き出し、スモークテスト |

## 動かし方

Node.js 20以上が必要です。

```sh
npm install
npm test           # 判定ロジックのテスト（全4^12通りの総当たりを含む）
npm run build      # site/ → dist/。タイプ別のシェア着地ページ dist/t/NN/ も作る
npm run serve      # http://localhost:8787 で dist/ を表示（集計APIなし）
```

集計APIも含めて手元で動かすときは、Cloudflare の wrangler を使います。

```sh
npx wrangler d1 execute ponkotsu-zukan --local --file=schema.sql
npm run build && npx wrangler pages dev --port 8788
```

### 画像まわり

Chromium を使います。`CHROMIUM_PATH` でパスを指定できます。

```sh
npm run og         # タイプ別OGP画像を site/og/ に書き出す（コミットする）
npm run cards      # SNS投稿用：タイプ紹介スライドとシェア画像の見本を cards/ に書き出す
npm run smoke      # スマホ幅で 診断→結果→シェア画像→図鑑→着地ページ を通しで操作し、JSエラーを確認
```

キャラや文言を変えたら、`npm run og` で OGP 画像を作り直してください。

## 公開手順（Cloudflare Pages + D1）

1. `site/assets/config.js` の `origin` を本番ドメインにし、`npm run og && npm run build` を実行する。
2. D1 を作り、出てきた ID を `wrangler.toml` の `database_id` に入れる。

   ```sh
   npx wrangler login
   npx wrangler d1 create ponkotsu-zukan
   npx wrangler d1 execute ponkotsu-zukan --remote --file=schema.sql
   ```

3. デプロイする。`functions/` も一緒に載ります。

   ```sh
   npx wrangler pages deploy
   ```

4. KPI を見るためのトークンを設定する。

   ```sh
   npx wrangler pages secret put KPI_TOKEN
   curl -H "Authorization: Bearer <KPI_TOKEN>" https://<ドメイン>/api/stats?all=1
   ```

静的配信と Functions は Cloudflare の無料枠で動きます。PV が増えても、サーバー代はほぼ増えない構成です。AI生成は使っていないので、1診断あたりの原価もかかりません。

## 公開前に人の手が必要なこと

詳しくは `docs/design.md` の「公開前に人がやること」を見てください。

- キャラを人の手で描いたイラストに差し替える（いまのSVGは仮）
- ラベルを投票で確定する
- 名前・ドメイン・商標を確認する
- 自社SNSアカウントを開設し、運用を続ける
