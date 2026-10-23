# コードレビュー（v3・完全版の決済まわりを含む）

- 対象: `site/assets/*.js`（生成物の `types.js` は除く）、`functions/**/*.js`、`scripts/build.mjs`、`schema.sql`
- 方法: コードを通読。`npm test` は 20/20 通過。有料本文が静的ファイルに混ざっていないかを機械的に照合（下記）。UIの2件は同梱の Chromium で実際に再現を確認。
- 注意: レビュー中にも `premium.js`・`app.js`・`quiz.js`・`report.js`・`types.js` が書き換わっていた。行番号は 2026-10-23 10:22 UTC 時点のもの。

## 問題がなかったところ（確認済み）

- **XSS**: `innerHTML` に入れる値（ニックネーム・グループ名・URLやlocalStorageから来た結果コード）は、すべて `esc()` を通すか、正規表現で検証した値だけ。抜けは見つからなかった。サーバー側でも `<>` と制御文字を落としている。
- **D1のSQL**: すべてプレースホルダでバインドしている。インジェクションの余地はない。
- **有料本文の混入**: `PREMIUM`・`PARAM_DETAIL`・`LOVE_DETAIL` から142個の断片を取り出し、`site/` と `dist/` の全ファイルと照合したが、一致は0件。モザイクの下の文字は無料の文章から作ったダミーで、本物の有料文ではない。`types.js` に入っているのは予告（`deep` の先頭38字）と文字数だけ。
- **トークン**: HMAC-SHA256 で署名し、最後まで比べる比較で確かめている。受け取りID（rid）は `crypto.getRandomValues` で作った80ビット、グループIDも40ビット。どちらも推測はできない。
- **オープンリダイレクト**: なし。遷移先は Stripe が返すURLか、自分のサイト内のハッシュだけ。

## 指摘一覧

| ID | 重大度 | 場所 | 要点 |
|---|---|---|---|
| H1 | 高 | `functions/api/unlock.js:7-30`, `premium.js:298-309`, `app.js:103-107,145` | 完全版を渡すのは「/thanks/ に戻ってきたブラウザ」だけ。戻れなかったり失敗したりすると、支払い済みでも誰も受け取れない |
| H2 | 高 | `premium.js:17,60`, `token.js:16` | 購入の記録がブラウザのlocalStorageにしかない。iOSのITPで7日後に消えるうえ、サーバーの設定を誤ると全員のトークンを消してしまう。復元する手段もない |
| H3 | 高 | `functions/api/sample.js:11-24`, `premium.js:65-72` | 有料の「パラメータのくわしい解説」18文が、/api/sample から無料で全部取れる（実際に確認） |
| M1 | 中 | `token.js:11-24`, `unlock.js:16-19`, `redeem.js:19`, `premium.js:288-294` | トークンが無期限・無制限で、取り消せない。プレゼントは「1人分」と書いてあるのに何人でも使え、Xへの投稿ボタンもある。返金後やコード停止後も使える |
| M2 | 中 | `token.js:29-35`, `checkout.js:11-18` | 画面に出す価格（PREMIUM_PRICE）と実際の請求額（Stripe の Price）を、別々に設定している |
| M3 | 中 | `checkout.js:16-25`, `unlock.js:16` | 支払い方法を指定していない。コンビニ・振込が有効だと、支払いが終わっても受け取れない |
| M4 | 中 | `app.js:145`, `premium.js:298-309` | `/thanks/?sid=…` がアドレスバーに残る。そのURLを人に送ると、送った先で本人用とプレゼント用のトークンを取られる |
| M5 | 中 | `claim.js:11-13`, `unlock.js:24-26`, `premium.js:176-189` | おうちの人に払ってもらったトークンは、リンクを知っていれば誰でも7日間何度でも受け取れる |
| M6 | 中 | `event.js:19-36`, `http.js:16-27`, `stats.js:13` | 計測APIに回数制限がない（レア度を書き換えられる、D1の枠を使い切られる）。回数制限の行は消えずに増え続け、/api/stats は毎回テーブル全体を読む |
| M7 | 中 | `social.js:262`, `groups/[id].js:23-27,39`, `http.js:30` | グループに、くわしい診断の6パラメータ（恋愛積極度・ヤキモチ度など）まで保存し、メンバー全員に返している |
| M8 | 中 | `groups/[id].js:30-49`, `schema.sql` | 10代向けのグループに、荒らしへの対策、削除・退出の手段、保存期間を過ぎたデータの削除がない。教室のWi-Fiでは21人目から参加できない |
| M9 | 中 | `report.js:130-140,219-235`, `result.js:98`, `social.js:207-208`, `app.js:79-81`, `premium.js:192-207,211-235` | 読みこみを待つ画面が、そのあいだに移った別の画面を後から上書きする。古いコールバックで別のレポートに飛ぶこともある |
| M10 | 中 | `scripts/build.mjs:84-87` | バージョンなしのESモジュールを1時間キャッシュする。デプロイ直後に新旧のモジュールが混ざって画面が壊れる |
| M11 | 中 | `app.js:127,138`, `social.js:441`, `premium.js:259` | `%` が壊れたURLで `URIError` が出て、画面が真っ白になる（実際に確認） |
| L1 | 低 | `app.js:125`, `result.js:181-186`, `ui.js:91` | 図鑑でまだ出会っていない隠しタイプを押すと、「まだ秘密」が開いた直後に閉じる（実際に確認） |
| L2 | 低 | `quiz.js:110-113,123-148` | 選んでから0.16秒以内に「もどる」を押すと、答えが1つ前の質問に記録される |
| L3 | 低 | `quiz.js:174-181`, `app.js:116` | ブラウザの「戻る」で診断の途中経過が消える。結果から戻ると、診断が最初から始まる |
| L4 | 低 | `premium.js:142-151` | 「保護者の同意」のチェックは入れなくても買える。ボタンの文言と支払いのタイミングも合っていない |
| L5 | 低 | `token.js:26`, `config.js:13` | 特商法の表記が仮の文字のままでも、環境変数がそろえば販売が始まる |
| L6 | 低 | `premium.js:11-15` | 販売状況の取得に一度失敗すると、そのページでは閉じるまで「準備中」のまま |
| L7 | 低 | `report.js:136-137,219-233` | 購入済みでも読みこみに失敗すると未購入として表示し、購入シートを自動で出す |
| L8 | 低 | `premium.js:302,312-316` | プレゼント用のリンクは1回しか表示されない。消えたら出し直せない |
| L9 | 低 | `checkout.js:14,21,24`, `premium.js:153` | 決済をやめるとトップに戻される。おうちの人の購入はタイプ番号が「0」として記録される |
| L10 | 低 | `unlock.js:16,23` | 他の商品の支払いでも開ける。/thanks/ を再読みこみするたびに「支払い完了」の数が増える |
| L11 | 低 | `app.js:183`, `social.js:11-20` | /p/ から来た友達の名前を `cleanName` せずに保存している |
| L12 | 低 | `result.js:153-160`, `report.js:203-216`, `social.js:131-136`, `profile.js:16-31`, `card.js:292-293` | 画像づくりに失敗したときの処理と、連打を防ぐ仕組みがない |
| L13 | 低 | `scripts/build.mjs:84-87`, `stats.js:7` | セキュリティ関係のヘッダ（CSP など）がない。KPI_TOKEN の比較にかかる時間が一定でない |

---

## 高

### H1 完全版を渡すのが「戻ってきたブラウザ」だけ（Webhookがない）

- 場所: `functions/api/unlock.js:7-30`、`site/assets/premium.js:298-309`、`site/assets/app.js:103-107,145`
- 何が起きるか:
  1. トークンを作るのも、おうちの人の購入で `claims` に書きこむのも、`/thanks/?sid=` から `/api/unlock` が呼ばれたときだけ。支払いのあとにブラウザを閉じた、アプリ内ブラウザから戻れなかった、通信が切れた、といった場合は、**支払い済みなのに本人もお子さまも受け取れない**。お子さまの端末はいつまでも待ち続ける。
  2. `completePurchase` は失敗しても `returnHash` に移り、`returnHash` を消す（`premium.js:305-308`）。そのあと `location.replace('#/…')` でハッシュが付くので、再読みこみしても `app.js:145` の `!location.hash` の分岐に入らず、**再試行できない**。トーストの「再読みこみしてください」は効かない。
  3. おうちの人の端末では、失敗しても `#/buy/done` に移り、「お支払いが完了しました。お子さまのスマホで、完全版が自動的に開きます」と表示する（`app.js:103-107`）。実際には `claims` に書かれていないので、届かない。
- 直し方:
  - Stripe の Webhook（`checkout.session.completed` と `checkout.session.async_payment_succeeded`）を `functions/api/stripe-webhook.js` に作る。`Stripe-Signature` を検証してから、`purchases(id, plan, rid, created_at, refunded)` と `claims` に書く。`/api/unlock` は、この記録か Stripe を照会した結果を返すだけにする。
  - `completePurchase` で失敗したら画面を移らない。`/thanks/` にとどまって「もう一度確かめる」ボタンを出し、`sid` を `localStorage` の `pendingSid` に残しておく。次に開いたとき（`boot()`）にも再試行する。
  - `returnHash` を消すのは成功したときだけにする。`#/buy/done` を見せるのも成功したときだけにする。

### H2 購入の記録がlocalStorageにしかなく、消えたら戻せない

- 場所: `site/assets/premium.js:17`（保存先）、`premium.js:60`（401が返ると消す）、`functions/_lib/token.js:16`（秘密鍵がないと false）、表記は `app.js:96`
- 何が起きるか:
  1. iOS Safari の ITP は、**7日間そのサイトを操作しないと、スクリプトが書いたストレージ（localStorage）を消す**。10代の主な環境は iPhone なので、「1回だけ・買い切り」で買った人が1週間来なければ、完全版が読めなくなる。購入の記録はサーバーにないので、復元する手段もない。LINE や Instagram のアプリ内ブラウザで買った場合も、Safari で開き直すと読めない。
  2. `fetchPremium` は 401 が返ると `premiumToken` を消す（`premium.js:60`）。`verifyToken` は `PREMIUM_SECRET` がないときも false を返す。このため、プレビュー環境に秘密鍵を入れ忘れたり、漏れ対策で秘密鍵を変えたりすると（いまはこれが唯一の失効手段）、**それ以降に開いた購入者全員のトークンが消え、二度と戻らない**。
- 直し方:
  - `/api/unlock`・`/api/claim`・`/api/redeem` で、`Set-Cookie: pz_t=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=34560000; Path=/api/` も返す。サーバーが同じドメインから付けたCookieには、7日の上限がかからない。`/api/premium` はヘッダかCookieのどちらかで受け付ける。
  - 「購入を復元する」入口を作る。Stripe の `customer_details.email` を `purchases` に持ち、メールでリンクを送る。または、領収メールに載っているセッションIDやレシート番号を入れてもらう。
  - 401 が返っても消さない。秘密鍵がないときは `{error:'disabled'}` で 503 を返して区別し、ブラウザ側は「再試行」を表示するだけにする。
  - `inAppBrowser()` が true のときは、購入シートに「購入情報はこのブラウザに保存されます。Safari/Chromeで開いてから購入してね」と出す。

### H3 有料の「パラメータのくわしい解説」が /api/sample から全部無料で取れる

- 場所: `functions/api/sample.js:11-24`、`site/assets/premium.js:65-72`。購入シートの1つめの項目「パラメータ6項目の数値と、くわしい解説」（`premium.js:76`）が対象。
- 何が起きるか: `/api/sample?i=&p=` はトークンなしで `PARAM_DETAIL[k][level]` を返す。返すパラメータ k は、`p` の中でいちばん偏った桁で決まる。このため `p` を `060606` 系に変えるだけで、6項目×3段階＝**18文すべてが取れる**。実際に `onRequestGet` を呼び、18通りすべてが取れることを確認した。ブラウザでも、自分の `#/r/<コード>` の末尾6文字を書き換えれば見本が変わる。有料の本文は /api/premium だけが返す、という前提がここで崩れている。ステータスの数値も、URLのコード（`~37c928`）と無料のレーダーの形から読める。
- 直し方:
  - 見本は、有料文とは別に書いた無料の文章にする（`content/params.json` に `sample` を足す）か、`detail` の先頭40%ほどに切って返す。
  - あわせて、購入シートの1つめの項目の書き方を、実際に有料になっている範囲に合わせる。
  - 回数制限（`rateLimited`）もかける。

## 中

### M1 トークンが無期限・無制限で、取り消せない

- 場所: `functions/_lib/token.js:11-24`、`functions/api/unlock.js:16-19`、`functions/api/redeem.js:19`、`site/assets/premium.js:288-294`
- 何が起きるか:
  - プレゼント用のトークンは「1人分」（`premium.js:289`）と書いてあるのに、何人でも使える。しかも X・LINE への共有ボタンがあるので、Xに投稿されればそのまま無料で配られる。本人用の引き継ぎリンクも同じ。
  - 未成年の購入は「全額返金」を約束しているが、返金しても Checkout Session の `payment_status` は `paid` のままなので、トークンの再発行も今あるトークンの利用もできる（買って、読んで、返金を受けても読み続けられる）。
  - プロモコードのトークンは `promo-<コード>` で全員同じ文字列になる。`PROMO_CODES` からコードを消しても使い続けられる。`OSHI2027` のような推測しやすいコードを、IPv6 を変えながら総当たりすることもできる。
- 直し方:
  - D1 に `purchases(id, plan, refunded, gift_used_by, activations)` を作る。`/api/premium` で `refunded` を確かめ、端末数に上限（たとえば3）を設ける。
  - プレゼントは1回使ったら、端末ごとのランダムIDに紐づけて使用済みにする。
  - プロモトークンには期限（`v1.promo-X-<exp>.`）を入れ、検証のときに `PROMO_CODES` にまだ入っているかも確かめる。
  - unlock では `expand[]=payment_intent.latest_charge` を付けて、返金済みなら発行しない。
  - プレゼントの共有はコピーとOSの共有シートだけにし、X・LINEへの投稿ボタンは外す。

### M2 画面の価格と請求額を、別々に設定している

- 場所: `functions/_lib/token.js:29-35`（`PREMIUM_PRICE` は表示用）、`functions/api/checkout.js:11-18`（請求額は `STRIPE_PRICE_ID` の金額）
- 何が起きるか: 自社の最終確認画面（`premium.js:135,145`）、特商法の表記（`app.js:90`）、おうちの人への文面（`premium.js:180`）は、どれも `PREMIUM_PRICE` を表示する。Stripe の Price を変えたときに env を直し忘れると、**最終確認画面の金額と実際の請求額がずれる**。特商法12条の6の表示義務や、景品表示法の有利誤認に触れるおそれがある。
- 直し方: `status.js` で `GET /v1/prices/{id}` を呼び、`unit_amount`・`currency`・`tax_behavior` を返す（Cache API で5分キャッシュ）。または `checkout.js` で Price を取得し、`PREMIUM_PRICE` と違えば 503 を返して販売を止める。

### M3 支払い方法を指定していない（コンビニ・振込が有効なら受け取れない）

- 場所: `functions/api/checkout.js:16-25`、`unlock.js:16`
- 何が起きるか: `payment_method_types` を指定していないので、Stripe のダッシュボードで有効にした方法がすべて出る。日本のアカウントでコンビニ決済や銀行振込が有効だと、戻ってきた時点では `payment_status` が `unpaid` なので、/api/unlock は 402 を返す。あとで支払っても、Webhookがないので受け取れない（H1）。特商法の表記「支払時期：ご注文時に決済されます」（`app.js:93`）とも合わない。表記にある「PayPay」も、実際に有効かどうかはコードからは保証されない。
- 直し方: `'payment_method_types[0]': 'card'` を明示する（Apple Pay・Google Pay はカードに含まれる）。ほかの方法を使うなら Webhook で `async_payment_succeeded` を処理し、表記もそれに合わせる。

### M4 `/thanks/?sid=…` がアドレスバーに残り、そのURLを送ると漏れる

- 場所: `site/assets/app.js:145`、`premium.js:298-309`
- 何が起きるか: `location.replace(back)` はハッシュしか変えないので、購入後もずっと `/thanks/?sid=cs_…#/r/…` のまま使い続けることになる。結果を人に見せようとしてアドレスバーのURLを送ると、受け取った人はハッシュを消して開くだけで（または `/api/unlock?sid=` を直接呼んで）、**本人用とプレゼント用のトークンを両方取れる**。
- 直し方:
  - 成功したら `location.replace('/' + back)` でパスとクエリを消す。
  - `_headers` に `/thanks/*` 用の `Referrer-Policy: no-referrer` と `Cache-Control: no-store` を足す。
  - unlock では、一度発行したセッションに2回目以降はプレゼント用トークンを返さない（`purchases` に記録して判定する）。

### M5 おうちの人に払ってもらったトークンを、リンクを知っていれば誰でも何度でも受け取れる

- 場所: `functions/api/claim.js:11-13`、`unlock.js:24-26`、`premium.js:176-189`
- 何が起きるか: 子どもの端末が待ち受けに使う rid は、おうちの人に送るリンク（`/#/buy/<rid>`）にそのまま入っている。`claims` の行は受け取ったあとも消えない。このため、リンクがLINEのグループに転送されると、7日間は誰でも `/api/claim?rid=` でトークンを取れる。
- 直し方: 子どもの端末だけが持つ秘密 `s` を作り、リンクには `rid = base32(SHA-256(s))[:16]` を入れる。`/api/claim` は `s` を受け取ってハッシュで探し、`DELETE FROM claims WHERE rid=? RETURNING token` で1回だけ渡す。

### M6 計測APIに回数制限がない。回数制限の行も消えずにたまる

- 場所: `functions/api/event.js:19-36`、`functions/_lib/http.js:16-27`、`functions/api/stats.js:13`
- 何が起きるか:
  - `/api/event` には回数制限も Origin の確認もない。`done:N` を水増しすれば、結果ページの「レア度（診断した人の中で）」を好きな値にできる。1回の呼び出しでD1に3行書くので、無料枠の書き込み数を使い切られると、グループ機能や受け取りも止まる。
  - `rateLimited` は「IP×1分」ごとに `counters` に `rl:` の行を足し、その行を消さない。`stats.js:13` の `LIKE 'done:%'` は、大文字小文字を区別しない LIKE で BINARY の主キーを使えないので、`EXPLAIN QUERY PLAN` が `SCAN counters`（テーブル全体）になることを確認した。結果ページを開くたびに読む行数が増え続け、`/api/stats?all=1` も `rl:` の行で膨らむ。
  - IPv6 は1アドレスずつ数えるので、簡単にすり抜けられる。`RATE_SALT` を設定しないと塩は `'pz'` に固定され、IPv4 は総当たりで元のIPに戻せる。
- 直し方:
  - `event.js` にも `rateLimited(env, request, 'event', 60)` をかけ、`Origin` を確認する。
  - stats は `WHERE k >= 'done:' AND k < 'done;'` に変える（インデックスが使われることを確認済み）。
  - 回数制限は別テーブル `rl(k, n, minute)` に分け、Cron Trigger で古い行を消す。または Cloudflare の Rate Limiting ルールを使う。
  - IPv6 は /64 単位でまとめる。`RATE_SALT` を必須にする。

### M7 グループに、くわしい診断のパラメータまで保存して全員に返している

- 場所: `site/assets/social.js:262`（`code: mine.code`）、`functions/api/groups/[id].js:23-27,39`、`http.js:30`（`~6桁` を許可している）
- 何が起きるか: くわしい診断をした人の `mine.code` には、6パラメータ（恋愛積極度・ヤキモチ度・さみしがり度・妄想・推し活・ツッコミ）が入る。それがそのままD1に保存され、グループのリンクを知っている人なら誰でも API から読める。画面には出ていないが、「このサイトについて」の「ニックネームとタイプを表示します」という説明を超えている。クラスのグループで、未成年の恋愛関係の傾向が読めてしまう。
- 直し方: ブラウザは `quickCodeOf(mine.code)` を送る。サーバーはグループ用に `~6桁` を許さない正規表現を使う（または `~` 以降を切る）。いま保存されている行も、`UPDATE members SET code = substr(code, 1, length(code) - 7) WHERE code GLOB '*~*~??????'` で切り詰める（末尾の `~` と6文字を落とす）。

### M8 10代向けのグループに、荒らし対策・削除・退出・保存期間がない

- 場所: `functions/api/groups/[id].js:30-49`、`schema.sql`
- 何が起きるか:
  - 誰でも1分20件のペースで、偽のメンバーを足せる（3分ほどで50人の満員にできる）。
  - ニックネーム（10文字）に悪口を入れても止める仕組みがない。作成者が消すことも、本人が抜けることもできない。
  - 「90日で見られなくなる」は読むときに隠しているだけで、行はD1に残り続ける。
  - 回数制限が IP 単位の1分20件なので、教室の同じWi-Fiでいっせいに参加すると、21人目以降は「参加できませんでした」になる（`social.js:264` は 'rate' を区別していない）。
- 直し方:
  - 作成時に作成者用の秘密キーを返し、メンバーを消せるようにする。本人の `memberId` で退出できるようにする（DELETE）。
  - `content/` にあるNGワードの検査をニックネームにも使う。
  - Cron Trigger で、期限を過ぎた `groups`・`members`・`claims` を消す。
  - 回数制限は「グループ単位で1分60件」と「IP単位で緩め」を組み合わせ、'rate' のときは「少し待ってね」と出す。

### M9 読みこみを待つ画面が、移った先の画面を後から上書きする

- 場所: `report.js:130-140`（`await loadStats/fetchPremium/premiumStatus` のあとに描く）、`report.js:219-235`、`result.js:98`、`social.js:207-208`、`app.js:79-81`（`viewLegal`）、`premium.js:192-207`（`viewBuyFor`）、`premium.js:211-235`（`watchClaim`）、`quiz.js:174-181`、`social.js:401`
- 何が起きるか:
  - レポートを開いてすぐ「図鑑」を押すと、APIが返った時点で（最大4秒）レポートが図鑑の上に描かれる。URLは `#/zukan` のままなので、表示とURLが食い違う。
  - `#sample` の書きこみや、購入シートを自動で出す監視も、移った先の別のレポートに対して動く。
  - `watchClaim` は最初に登録したコールバックを使い続ける（`claimTimer` がある間は新しい登録を無視する）。そのため、ホームにいるときに受け取りが終わると、古い `viewReport(r)` に勝手に切り替わる。
  - 診断の完了や、わたしクイズの次の問題へ進む `setTimeout` も、別の画面に移ったあとで画面を奪う。
- 直し方: `ui.js` に `let navGen = 0; export const navToken = () => ++navGen; export const isCurrent = (t) => t === navGen;` を足す。`route()` の最初で `navToken()` を取り、`await` のあとと `setTimeout` の中で `if (!isCurrent(t)) return;` を入れる。`watchClaim` はコールバックを毎回差し替えるようにし、完了したら `route()` を呼ぶ。

### M10 バージョンなしのESモジュールを1時間キャッシュしている

- 場所: `scripts/build.mjs:84-87`（`/assets/*  Cache-Control: public, max-age=3600`）
- 何が起きるか: `app.js` が `./premium.js` などを、URLにバージョンを付けずに読みこんでいる。デプロイ直後は、新しいモジュールと古いモジュールが混ざる。たとえば今回の `report.js` は `types.js` の `premiumLen`・`PARAM_TEXT[].len` があることを前提にしている。古い `types.js` がキャッシュに残っていると、`lockedLength` で TypeError が出てレポートが真っ白になる。エクスポートの名前が合わなければ、アプリ全体が起動しない。
- 直し方: ビルドで各モジュールの中身のハッシュを取り、`import … from './x.js?v=<hash>'` と `index.html` の `<script src>` を書き換える。そうすれば、そのファイルには `immutable, max-age=31536000` を付けられる。手間をかけないなら、`/assets/*.js` を `Cache-Control: no-cache`（ETagで毎回確かめる）にする。

### M11 `%` が壊れたURLで画面が真っ白になる

- 場所: `site/assets/app.js:127,138`、`social.js:441`、`premium.js:259`
- 何が起きるか: `decodeURIComponent` の `URIError` をどこも捕まえていない。`route()` は async なので、例外は処理されないまま Promise の reject になり、何も描かれない。わたしクイズの「結果を送る」リンク（`#/qs/<名前>/<点数>`）はLINEなどに貼られるので、途中で切れると `%E3%81` のように壊れる。新しいタブで開くと `#app` が空のまま、ほかの画面から移った場合は前の画面がそのまま残ることを、Chromium で確認した。
- 直し方: `const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return ''; } };` を作って4か所で使う。あわせて、`route()` の中身を try/catch で囲み、失敗したら `viewHome()` に戻す。

## 低

### L1 図鑑の「まだ秘密」が開いた直後に閉じる

- 場所: `app.js:125`、`result.js:181-186`、`ui.js:91`
- 何が起きるか: `viewType` は `openModal` を開いて false を返す。それを受けて `viewZukan()` が呼ばれ、その中の `render()` が `closeModal()` を呼ぶ。このため、まだ出会っていない隠しタイプを押しても、何も起きないように見える。ハッシュは `#/t/s1` のまま残るので、同じシールをもう一度押しても hashchange が起きず、本当に何も起きない。Chromium で `modal.hidden === true` になることを確認した。
- 直し方: `if (index < 0) viewZukan(); else if (!viewType(index)) { viewZukan(); showLocked(index); history.replaceState(null, '', '#/zukan'); }` のように、先に図鑑を描いてからモーダルを開く。

### L2 選んでから0.16秒以内の「もどる」で、答えが1つ前の質問に入る

- 場所: `quiz.js:110-113`、`quiz.js:123-148`
- 何が起きるか: `choose()` が無効にするのは `.opt` だけで、`[data-back]` は押せるまま。選んだ直後に「もどる」を押すと、`pos` が1つ減ったあとで `setTimeout` が動き、`steps[pos]`（1つ前の質問）に今の選択肢の番号を書きこむ。
- 直し方: `const at = s.pos` を覚えておき、`setTimeout` の中で `if (session !== s || s.pos !== at) return;` とする。あわせて `[data-back]` も無効にする。

### L3 ブラウザの「戻る」で診断が最初からになる

- 場所: `quiz.js:174-181`、`app.js:116`
- 何が起きるか: 質問ごとには履歴を作っていないので、スマホのスワイプで戻ると診断から抜けて、答えが全部消える。結果ページから戻ると `#/q` に戻り、新しい診断が始まる。
- 直し方: 結果へは `location.replace('#/r/…')` で移る。質問中は `history.pushState` で1問ずつ履歴を積み、`popstate` で1問戻す。または、抜ける前に確認を出す。

### L4 購入確認画面のチェックとボタン

- 場所: `premium.js:142`（保護者の同意）、`premium.js:145`（ボタンの文言）、`premium.js:147-151`
- 何が起きるか:
  - 「18歳未満の方は、保護者の同意を得ています」は、チェックを入れなくても購入に進める。飾りになっているので、同意を確かめたことにならない。
  - ボタンは「390円を支払って購入する」だが、実際には次の Stripe の画面で支払いを確定する（表の「支払い時期：次の画面で…」とも食い違う）。
- 直し方:
  - 「18歳以上です」と「18歳未満で、保護者の同意があります」のどちらかを必ず選ぶ形にし、選ばないと進めないようにする。
  - ボタンは「お支払い画面へ進む（Stripe）」に変える。
  - Checkout に `custom_text[submit][message]` を付けて、「デジタルコンテンツのため購入後の返品不可（18歳未満は保護者の申し出で全額返金）・決済完了後すぐ閲覧可」を最後の画面にも出す。

### L5 特商法の表記が仮のままでも販売が始まる

- 場所: `functions/_lib/token.js:26`、`site/assets/config.js:13`
- 何が起きるか: `premiumEnabled` が見ているのは Stripe と秘密鍵の環境変数だけ。`seller` に `（販売事業者名）`・`（メールアドレス）` が入ったままでも、販売が始まる。
- 直し方: `build.mjs` で、`SITE.origin` に `example.com` が含まれていたり、`seller` に「（」で始まる値が残っていたりしたら、ビルドを失敗させる。またはサーバー側で `SELLER_READY=1` を必須にする。

### L6 一度の失敗を、閉じるまで使い続ける

- 場所: `premium.js:11-15`（`ui.js:75` の `loadStats` も同じ）
- 何が起きるか: 最初の `/api/premium/status` が4秒で時間切れになると、そのページを閉じるまで「準備中」のまま。おうちの人の購入ページでも同じで、売る機会を逃す。
- 直し方: 失敗したときは `statusPromise = null` に戻し、次に呼ばれたら取り直す。

### L7 購入済みなのに、購入シートを自動で出す

- 場所: `report.js:136-137`、`report.js:219-233`
- 何が起きるか: `hasPremium()` が true でも `fetchPremium` が失敗すると（電波が弱いなど）、未購入として表示し、自動の購入シートまで出す。二重に買ってしまう原因になる。
- 直し方: `hasPremium() && !prem` のときは、「購入済みです。読みこみに失敗しました［再試行］」を出し、モザイクと購入シートは出さない。

### L8 プレゼント用のリンクを出し直せない

- 場所: `premium.js:302`、`premium.js:312-316`
- 何が起きるか: `afterPurchase` は1回表示すると消える。モーダルを閉じたり、直後に別の画面が描かれたりすると（`render()` はモーダルを閉じる）、590円で買ったプレゼント用のリンクがなくなる。
- 直し方: `giftToken` を `pz:gift` として保存し、完全版を読めるようになったレポートに「プレゼント用リンクを表示」ボタンを置く。

### L9 決済をやめたときの戻り先と、記録されるタイプ番号

- 場所: `checkout.js:21`、`checkout.js:14,24`、`premium.js:153`
- 何が起きるか:
  - `cancel_url` がトップ（`/`）なので、読んでいたレポートに戻れない。
  - おうちの人の購入では `index: null` を送るが、`Number(null) === 0` なので、`metadata[type]` が「0」になる。KPI がタイプ01に偏る。
- 直し方:
  - `cancel_url` を `${origin}/thanks/?canceled=1` にし、`returnHash` へ戻す。
  - `Number.isInteger(body?.index)` を見て、数値で送られたときだけ記録する。

### L10 他の商品の支払いでも開ける。「支払い完了」の数が増える

- 場所: `unlock.js:16`、`unlock.js:23`
- 何が起きるか:
  - 見ているのは `payment_status === 'paid'` だけ。同じ Stripe アカウントで別の商品を売っていると、その Checkout Session でも完全版が開く。
  - `/thanks/?sid=` を開き直すたびに `premium:paid:*` が1つ増える。
- 直し方:
  - `session.metadata.plan` があることを確かめる（できれば `line_items` の price も確かめる）。
  - 数を足すのは、`purchases` への `INSERT OR IGNORE` で新しい行ができたときだけにする（`meta.changes`）。

### L11 /p/ から来た友達の名前を整えずに保存している

- 場所: `app.js:183`、`social.js:11-20`
- 何が起きるか: `addFriend(params.get('na') || '友達', …)` は名前を `cleanName` しないので、URLに入る長さのまま図鑑と相性ランキングに保存される。表示はエスケープしているので XSS にはならないが、ほかの入口と処理がそろっていない。
- 直し方: `addFriend` の中で `name = cleanName(name) || '友達'` とする。

### L12 画像づくりの失敗と連打

- 場所: `result.js:153-160`、`report.js:203-216`、`social.js:131-136`、`profile.js:16-31`、`card.js:292-293`、`ui.js:182-183`
- 何が起きるか:
  - try/catch がないので、`loadImage` が失敗するとトーストが出たまま何も起きない。
  - `toBlob` が null を返すと、`new File([null])` が「null」という中身のファイルを共有する。
  - 連打すると画像を2回作り、2回目の `navigator.share` が InvalidStateError になって、モーダルが重なる。
- 直し方: ボタンを `disabled` にしてから作り、try/catch で失敗を伝え（「画像を作れませんでした」）、`blob` が null かどうかを確かめる。

### L13 ヘッダとKPIトークンの比較

- 場所: `scripts/build.mjs:84-87`、`functions/api/stats.js:7`
- 何が起きるか: トークンを localStorage に置いているので、XSS が1つでもあれば盗まれる。それなのに CSP・`X-Content-Type-Options`・`Referrer-Policy`・`frame-ancestors` がない。`KPI_TOKEN` は普通の `!==` で比べているので、比較にかかる時間が一定でない。
- 直し方:
  - `_headers` に `/*` 用の次のヘッダを足す。
    - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
  - `KPI_TOKEN` は `token.js` の比較関数を流用して比べる。

## 優先順位（直す順）

1. H1・M3（支払ったのに受け取れない）→ Webhook と、失敗したときの再試行。
2. H2（買った物が消える）→ HttpOnly Cookie、復元の入口、401 で消さない。
3. H3（有料の本文が無料で取れる）→ /api/sample の見本を作り直す。
4. M1・M4・M5（トークンが漏れる・無制限に使える）→ `purchases` テーブルで、失効・1回限り・端末数の上限を管理する。
5. M2・L4・L5（表示と法令）→ 価格は Stripe から取る、同意を必須にする、表記が仮のままならビルドを止める。
6. M6〜M8（D1の運用と10代の安全）、M9〜M11（UIの安定性）。
