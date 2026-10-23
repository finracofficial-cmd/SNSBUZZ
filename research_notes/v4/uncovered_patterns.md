# 未導入の「勝ちパターン」調査と実装仕様（v4）

- 調査日: 2026-10-23
- 対象: 「愛されポンコツ診断」（静的サイト＋Cloudflare Pages Functions＋D1、ログインなし、10代〜20代前半、スマホ、TikTok／Instagram／X／LINEから流入）
- 範囲: 2023〜2026年の性格・タイプ診断と、シェアで広がるWebコンテンツ。日本を先に、次に韓国・中国・米国
- 方法
  - Web検索・ページ取得 約70回
  - 既存の提案や実装と重ならないよう、`research_notes/v2_benchmarks`・`v3`・`reports` を読んだ
  - 既存の実装を確かめるため、`site/assets/*.js`・`functions/api/*.js`・`functions/_lib/experiments.js` を読んだ（編集はしていない）
- 本文を取得できなかったページ
  - LoveType16、診断メーカー: 403
  - BuzzFeedの個別クイズ: 406
  - 16TEST: プロキシ502
  - ktestone: JSで描画するため、取得したHTMLに中身がない
  - これらは検索結果の要約か既存ノートで補った

**表記**

| 表記 | 意味 |
|---|---|
| 【事実】 | 出典URLと日付つき。日付はページに書かれた公開日・更新日。書かれていないものは「日付不明」とし、取得日を添えた |
| 【二次】 | ベンダー・ブログ・解説サイトの数字や説明。参考として扱う |
| 【検索要約】 | 検索エンジンの要約だけで確かめたもの。本文は見ていない |
| 【既存ノート】 | `research_notes/` 内の過去の調査（出典URLはそちらにある） |
| 【コード確認】 | このリポジトリのコードを読んで確かめた、いまの実装 |
| 【推論】 | 調査者の解釈・提案・計算 |

---

## 既存実装の確認（提案が重ならないように）【コード確認】

- **結果ページ**（`result.js`）にあるもの
  - 9:16の画像保存、6枚カルーセル（TikTok・インスタ用）、成分表、プロフ帳
  - LINE・X・リンクのシェア、アプリ内ブラウザの案内
- **ロック画面の壁紙**（1170×2532）は、完全版の特典としてすでにある（`card.js` 814行、`report.js` 203行）。このため壁紙は提案から外した
- **A/Bテストの仕組み**はすでにある（`paybar`・`autopay`。段階は exposure→cta→checkout→paid。`functions/_lib/experiments.js`）
- **日別のカウンター**はすでにある（`day:{JST日付}:{k}`、`functions/api/event.js`）。LPに実数を出すときに流用できる
- **ふつうのシェアURL**は `/t/{no}/?s={shareId}`（`result.js` 18行）
  - 着地先はタイプ解説ページ。シェアした人の結果や相性は引き継がない
  - 相性は、別に作る「おさそいリンク」でしか出ない
- **ストーリー用カード**（1080×1920、`card.js`）の文字の位置
  - サイト名: y=160
  - 「あなたは何タイプ？」: y=1774
  - ドメインとハッシュタグ: y=1822
  - どれも、インスタのストーリーでUIが重なる上下の帯に入っている（2章）
- **引き継ぎ**: 有料の「引き継ぎリンク」はある。無料の結果・図鑑・わたしクイズ成績表を別のブラウザへ移す手段はない（`premium.js`、`app.js`）
- **まだないもの**
  - 時間帯・週・季節で変わる要素
  - QRコード
  - テキストだけのシェア形式
  - LPの利用者数表示・見本カード・FAQ

---

## 0. 上位10の推奨（期待効果÷工数の順）

- 工数: S＝1〜3人日、M＝4〜10人日、L＝それ以上【推論】
- 期待効果と順位は【推論】。「根拠の強さ」は、下の出典の質（一次か、対照実験か）で付けた

| 順位 | 施策 | 主に動く指標 | 工数 | 根拠の強さ |
|---|---|---|---|---|
| 1 | ふつうのシェアリンクを「相性のおさそい」にする | 紹介で来た人の開始率、K係数 | S〜M | 中（実例＋推論） |
| 2 | ストーリーカードの安全域を直し、リンクスタンプ・お題スタンプの3ステップ案内を付ける | シェア→来訪率 | S | 中 |
| 3 | LPの1画面目に、実数カウンター・「わかる率」・その場で答えられる1問目を置く | LPの開始率 | S | 中 |
| 4 | 無料データの「どこでも続きリンク」を作り、LINEのKeepメモに保存させる | 再訪率、図鑑の継続 | S | 中（仕様は事実） |
| 5 | 絵文字バーで結果を伝える「テキスト結果」（Wordle型） | LINEでのシェア率 | S | 中 |
| 6 | 時間帯で変わる「いまの二つ名」（Spotify daylist型） | 再訪、再シェア | S | 中 |
| 7 | 画像に検索ワードを入れ、結果の1画面目をスクショ前提で作る | TikTok・X経由の流入 | S | 中 |
| 8 | 週替わり「今週のポンコツお題」（1問×タイプ別の割合） | 週ごとの再訪、運営SNSのネタ | M | 低〜中 |
| 9 | コンビニで刷れる・買えるタイプ別シール | 収益（Stripeを通らない）、再訪 | M | 市場の根拠は中、購入率は不明 |
| 10 | 結果の直前に「計算中」演出（労働の錯覚）を入れてA/B | 完全版の購入率 | S | 学術は中、この文脈では低 |

### 1位　ふつうのシェアリンクを「相性のおさそい」にする

**作るもの**
- `shareUrl()` を `/t/{no}/?s={shareId}&f={quickCode}` にする
  - `quickCode` は `quickCodeOf(encodeResult(r))`。中身はタイプ番号と4軸の合計だけで、くわしい診断のパラメータは入れない
- ニックネーム `&n=` は、「LINEで送る」と「おさそい」の経路だけに付ける
  - X、画像、リンクコピーのような公開されうる経路には付けない
- 着地したとき（`/t/{no}/` と `#/`）
  - `f` を `decodeResult` で確かめる
  - 有効なら `store.set('invite', {code, name: n || '', via: 'share'})` で保存する
- タイプ解説ページの最上部に帯を出す
  - 文言:「このリンクを送ってくれた友達（{タイプ名}）との相性も、診断するとわかる（12問・約1分）」
  - 開始ボタンを付ける。3位の「その場で答える1問目」と組み合わせる
- 結果ページは、いまの `invitePairBox` をそのまま使う
  - 名前が空なら「シェアしてくれた友達」と出す
- 相性の下に「相性を送り返す（LINE）」を置く。リンクは既存の `#/pair/...`
- 計測: `event.js` の `ALLOWED` に次を足す
  - `ref:f`（f付きで着地した）
  - `pair:auto`（相性が自動で出た）
  - `share:pairback`（送り返した）
- A/B: `experiments` に `sharef: ['on','off']` を足し、shareIdの末尾で半分に分ける

**なぜ**
- 悪口診断は、診断コードを友達と交換する相性診断と、友達ごとの相性ランキングを持っている【既存ノート `v2_benchmarks/result_anatomy.md` 3-3】
- 韓国の방구석연구소（banggooso）は「友達が参加したらアプリで知らせる」と案内している【事実】
  - UI文言: "If your friend join, we'll notify you through the app"
  - 出典: banggooso.com に埋め込まれた多言語データ（取得 2026-10-23。同サイトの個人情報方針は2025-04-01適用）
- 紹介元に合わせたLPは +10〜20% という見込みがある。ただしベンダーの予測で、対照実験ではない【二次】[OptiMonk（2026）](https://www.optimonk.com/affiliate-marketing-conversion-rate)
- いまは、ふつうのシェアで来た人はタイプ解説しか見ない。「相性がわかる」という2つ目の動機を使っていない【コード確認】
- 【推論】ふつうのシェアは、わざわざ作るおさそいリンクよりずっと多い。それを全部おさそいにすると、K係数のうち「来訪→開始」が上がる

**動く指標**
- 紹介で来た人の開始率（ref→start）と完了率
- 相性の自動表示数、送り返し率
- K係数 ＝ 完了者1人あたりのシェア数 × シェア1件あたりの来訪 × 開始率 × 完了率【推論】

**リスク**
- 名前を公開の投稿に載せない。`n` は1対1とグループ向けの経路だけにし、8文字以内・NGワードのチェックを通す
- 隠しタイプの人のリンクで来ると、そのタイプが見える。図鑑の「友達経由で解放」と同じ扱いなので、問題は小さい【推論】
- コードは回答そのものではなく合計値で、個人を特定する情報ではない【コード確認】

**工数** S〜M

### 2位　ストーリーカードの安全域を直し、リンク・お題スタンプの案内を付ける

**作るもの**
- 1080×1920のカードで、文字とCTAを y=270〜1580 に収める
  - サイト名（いまy=160）を y≥270 へ下げる
  - 「あなたは何タイプ？」（いまy=1774）とドメイン（いまy=1822）を y≤1580 へ上げる
  - y=1380〜1540 に「リンクスタンプ置き場」を作る。幅600×高さ160の点線枠に、薄く「ここにリンク」と書く
- 「画像を保存してストーリーに投稿」を押したときの流れ
  1. `navigator.clipboard.writeText(url)` でURLをコピーする（`?ch=igs` 付き）
  2. いまの `shareImageBlob` で画像を渡す
  3. 3コマの案内シートを出す
     - ①インスタで画像を選ぶ
     - ②スタンプ→「リンク」→長押しで貼りつけ（URLはコピー済み）
     - ③「お題」スタンプで「#わたしのポンコツ」を作ると、見た友達が続けて投稿できる
- 案内は初回だけ自動で出す。2回目からは「やり方」リンクにする
- 計測: `ch=igs` の来訪、`share:igs-guide`

**なぜ**
- インスタのリンクスタンプは、2021-10-27から全ユーザーに開放された【事実】[Search Engine Land（2021-10）](https://searchengineland.com/instagram-opens-stories-link-sticker-to-all-users-375591)
- 日本語UIの「お題」スタンプ（英語名 Add Yours）【事実】[appllio（2021-11-02）](https://appllio.com/instagram-story-topic-sticker)
  - 見た人が「お題に参加」を押すと、リレーのように投稿がつながる
  - 参加者の一覧も見られる
- Add Yoursは2021年10月に日本とインドネシアで先行テストされた【既存ノート v3】
- 2023-12-15には、GIF・文字・画像を固定できる「Add Yoursテンプレート」が全世界で公開された【事実】[TechCrunch（2023-12-15）](https://techcrunch.com/2023/12/15/instagram-add-yours-template-story-sticker/)
- ストーリーの安全域【二次】
  - 通常のストーリーは、上下それぞれ約250pxを避けるのが実務の目安。公式の値はない
  - Metaの広告仕様は上14%（約269px）・下35%
  - 出典: [inro（2026）](https://www.inro.social/blog/instagram-story-size)、[socialync](https://www.socialync.io/tools/safe-zones/instagram-stories)
- 日本の10〜20代女性のインスタ投稿の38.1%がストーリーズ【既存ノート v2】
- 高校生の約9割がインスタで鍵アカウントを持つ【事実】
  - 調査: Studyplus、2024年7月、高校生1,401人
  - 出典: [リセマム（2024-10-24）](https://resemom.jp/article/2024/10/24/79283.html)
- 16歳未満のすべての利用者と、新しく登録する18歳未満のアカウントは、既定で非公開になる（2026-05-08のティーンアカウント刷新）【事実】[INTERNET Watch（2026-05-08）](https://internet.watch.impress.co.jp/docs/news/2106189.html)
- 【推論】10代のストーリーは「友達だけが見る場所」になっている。リンクスタンプが貼ってあれば、見た友達がそのまま来られる
- Spotify daylistは、Instagramストーリーズでの流行から広がった【事実】[YPulse（2024-01-24）](https://www.ypulse.com/newsfeed/2024/01/24/spotifys-personalized-daylists-are-going-viral/)
  - Spotifyによると、daylistの検索が1週間で20,000%増えた

**動く指標**
- ストーリーシェア1件あたりの来訪数
- お題スタンプ経由の来訪（`ch=igs`）

**リスク**
- お題スタンプは、公開アカウントだと参加者一覧が他人にも見える。案内に「鍵アカ・親しい友達だけでもOK」と書く
- Metaの判断で、リンクスタンプを使えないアカウントがある【事実】（Search Engine Land、同上）

**工数** S

### 3位　LPの1画面目（実数カウンター＋「わかる率」＋1問目をその場で）

**作るもの**（375×667の画面で、スクロールなしに見える範囲）
1. タイトルと1行のキャッチ（いまのまま）
2. 実数カウンターを1行で:「きょう {n}人・これまで {N}人が診断」
   - `GET /api/stats?lp=1` が `{today, total, agree, agreeN, since}` を返す
   - `today` は `day:{JST日付}:start`、`total` は `start` の値。キャッシュは60秒（いまの `stats.js` と同じ）
   - 出すのは today≥100 かつ total≥1,000 のときだけ
   - 上2けたで切り捨てて「1.2万+」のように出す。下に小さく「{since}からの集計」
3. 「わかる率」:「結果に『わかる〜！』と答えた人 {p}%」
   - 結果ページの成分表の下に、1タップの質問「この結果、どう？」を置く。答えは「わかる〜！」「ちょっとちがう」の2つ
   - `agree:yes`・`agree:no` を数える。1端末1回（localStorage）
   - 回答が300件（agreeN≥300）たまるまでは出さない
   - 「当たる」「正確」は使わない（占いに見える。Stripeの禁止業種）
4. 1問目をその場で答えられるようにする
   - かんたん診断のQ1と選択肢を、カードで出す
   - 押すと、Q1の答えを入れた状態で `startQuiz('quick')` を始め、Q2から進む
   - 上に「全12問・約1分・登録なし」と書く
5. その下に置くもの
   - 結果カードの見本3枚（横スワイプ）
   - FAQ 4問（占いなの？／何分かかる？／データはどうなる？／有料なのはどこ？）
   - いまの「できること」
- A/B: `lp: ['now','v4']`。LP表示→Q1回答→完了の段階で見る

**なぜ**
- 16Personalities 日本語トップ【事実】[16personalities.com/ja](https://www.16personalities.com/ja)（取得 2026-10-23）
  - 見出し「やっと自分のことを理解してもらえました」、説明1行、ボタン「テストを受ける」
  - その下に数字が4つだけ:「15万+ 本日の診断回数」「2億+ アメリカで受けられたテスト」「15.88億+ 累計診断回数」「91.2% 正確性の評価」
  - 91.2%は、2023年5月時点の第三者のプロフィールにも同じ数字がある【二次】[craft.co](https://craft.co/16personalities)
- 방구석연구소のUI文言に「Participants | {{number}} people」「Out of total ... participants」「Real-time Ranking」「See all types」がある【事実】banggooso.com（取得 2026-10-23）
- 悪口診断のトップ【事実】[waruguchi16.jp](https://waruguchi16.jp/)（取得 2026-10-23）
  - 見出し→「診断をはじめる」→「全20問・約2分」「診断は無料」→説明→16タイプ一覧→FAQ3問
  - 利用者数の表示はない
- Duolingoは、登録画面を数ステップ後ろに回してDAUが約20%増えたと担当者が話している。自己申告で、方法は公開されていない【二次】[First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)（日付不明）
- 最初を簡単な1択にした3段のフォームで、質の高い問い合わせが13%増えた（ベンダーの事例）【二次】[Reform](https://www.reform.app/play/multi-step-forms-benefits-3)（日付不明）
- モバイルの表示が0.1秒速くなると、小売サイトのCVRが8.4%、旅行サイトが10.1%上がった（Google委託・Deloitte）【事実】[web.dev（2020）](https://web.dev/case-studies/milliseconds-make-millions)
- 【推論】いまのLPは、ボタン2つと説明が中心。「いま何人が遊んでいるか」と「つい答えたくなる1問目」が1画面目にない

**動く指標** LPの開始率（LP表示→Q1回答）、完了率

**リスク**
- 景品表示法とダークパターン
  - 数字は実数だけにする。自動で増える演出、水増し、「残りわずか」はしない
  - 消費者庁の中間取りまとめ案（2026-08-24）は「自動生成の社会的証明」を類型に挙げている【既存ノート `v3/paywall_patterns.md` 4-3】
- 「わかる率」は答えた人の中での割合なので、「回答した人のうち」と注記する

**工数** S

### 4位　無料データの「どこでも続きリンク」とLINEのKeepメモ

**作るもの**
- 「マイリンク」`/#/me/{payload}` を作る。payload は JSON を base64url にしたもので、中身は次の3つ
  - `mine.code`（くわしい結果があればそのコード）
  - 図鑑の解放状況（20ビットのビットマスク）
  - わたしクイズの回答人数（人数だけ。友達の名前は入れない）
- 結果ページと図鑑に「LINEのKeepメモに保存」ボタンを置く
  - `https://line.me/R/share?text=` に「ポンコツ診断のマイリンク（あとで見る用）\n{url}」を入れる
  - LINEの送り先選択で、Keepメモを選べる
- `/#/me/` を開いたら、端末に保存されたデータと合体する
  - 図鑑は和集合、`mine` は新しい方
- 同じシートに、「ホーム画面に追加」の案内も1行入れる

**なぜ**
- iOSのアプリ内ブラウザ（WKWebView）のlocalStorageは、Safariに引き継がれない。Appleの回答は「意図した動作」【事実】[Apple Developer Forums](https://developer.apple.com/forums/thread/765680)（取得 2026-10-23）
- 主要なアプリ内ブラウザは、Cookieやサイトのデータを共有しない【事実】[Fingerprint docs](https://docs.fingerprint.com/docs/identifying-in-app-browsers-for-ios)（取得 2026-10-23）
- 流入の中心は、TikTok・Instagram・X・LINEのアプリ内ブラウザ【既存ノート】
  - 【推論】TikTokの中で集めた図鑑やクイズの成績表は、LINEから開き直すと見えない
- LINE URLスキーム `line.me/R/share?text=` は送り先の選択画面を開き、Keepメモにも送れる【事実】[LINE Developers](https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/)（取得 2026-10-23）

**動く指標** 7日以内の再訪率、図鑑の平均収集数、`#/me` の開封数

**リスク**
- マイリンクを他人が開くと、結果が見える。名前は入れず、「人に送らないでね」と書く

**工数** S

### 5位　絵文字バーの「テキスト結果」（Wordle型）

**作るもの**
- 「テキストでコピー（LINE用）」ボタン。1行は全角20字以内

```
#愛されポンコツ診断
わたし「既読スルー職人」No.07
ポンコツ純度 82%
しっかり 🟥🟥🟥⬜⬜
ノリ　　 🟦🟦🟦🟦⬜
（4軸ぶん）
あなたは？👇
{url}
```

- くわしい診断は、6パラメータのS〜Dを5段のバーで出す
  - 数値は出さない（完全版の価値を守るため）
- わたしクイズ用:「{名前}クイズ 5/6 ✅✅❌✅✅✅ 何問わかる？」
- `line.me/R/share?text=` と `navigator.share({text})` の両方で送れるようにする

**なぜ**
- Wordleの利用者は、2021-11-01の90人から2022-01-02の30万人超へ増えた【事実】[Wikipedia「Wordle」](https://en.wikipedia.org/wiki/Wordle)（取得 2026-10-23）
  - 12月に、ネタバレのない絵文字グリッドをコピーできる共有機能を入れた【事実】[Know Your Meme](https://knowyourmeme.com/memes/subcultures/wordle)
- 【推論】LINEグループでは、画像より文字の方が送りやすい。トーク一覧にも出る。画像の保存と添付という2つの手間もない

**動く指標** `share:text` の回数、LINE経由の来訪

**リスク**
- 機種によって絵文字の幅がずれる。🟥🟦🟪⬜ 以外は使わない
- 個人情報は入れない

**工数** S

### 6位　時間帯で変わる「いまの二つ名」（Spotify daylist型）

**作るもの**
- 二つ名の「形容」の部分を、日本時間の時間帯や曜日で差し替えた「いまの二つ名」を、結果ページとトップに出す
  - 時間帯（5つ）
    - 5〜9時「寝ぐせのままの」
    - 9〜15時「授業中うわの空の」
    - 15〜18時「寄り道したい」
    - 18〜23時「通知待ちの」
    - 23〜5時「そろそろ寝たほうがいい」
  - 曜日（7つ）: 月曜「休み明けの」、金曜「花金の」など
  - 時間帯と曜日のどちらを使うかは、日付から決定的に決める
  - 例:「通知待ちの既読スルー職人」
- 9:16のカード:「10/23 21:40のわたし」と「次に変わるのは23:00」。時刻は本当のものだけを出す
- タイプの判定ロジックは変えない（言葉の差し替えだけ）

**なぜ**
- Spotify daylistは2023年9月に始まった。1日に何度も変わる、説明的なタイトルが特徴【事実】[Digital Music News（2024-01-19）](https://www.digitalmusicnews.com/2024/01/19/spotify-daylist-is-blowing-up-too-bad-the-creator-was-laid-off/)
- Instagramストーリーズで流行し、Spotifyによると検索が1週間で20,000%増えた【事実】YPulse（2024-01-24、2位と同じ出典）
- 「Instagramの利用者は、daylistを新しい星座のように扱った」【事実】[TechRadar](https://www.techradar.com/audio/audio-streaming/spotify-daylists-have-taken-over-my-instagram-stories-and-theyre-coming-for-yours-too)（日付不明）
- 2024-09に、Spotifyが使えるすべての市場（180超）へ広げた【事実】[Axios（2024-09-04）](https://www.axios.com/2024/09/04/spotify-daylist-feature-globally-viral)
- 【推論】未来を言い当てる「占い」ではなく、「いまの自分」に名前を付ける形。時間が変われば別の言葉になるので、もう一度開いて撮る理由になる

**動く指標** 同じ端末の再訪回数、「いまの二つ名」カードのシェア数

**リスク**
- 「運勢」「ラッキー」「今日の◯◯」のような占いの言葉は使わない（Stripeの禁止業種）【既存ノート v2】
- 深夜の言葉は、寝ることをうながす向きにする。深夜の再訪をあおるカウントダウンや通知はしない（10代の睡眠への配慮）

**工数** S

### 7位　画像に検索ワードを入れ、結果の1画面目をスクショ前提で作る

**作るもの**
- すべてのシェア画像の下部（安全域の中）に、検索窓のような帯「🔍 愛されポンコツ診断」を入れる
  - 対象: ストーリー、成分表、プロフ帳、カルーセルの最後の1枚
- 結果ページの1画面目（390×844）に、サイト名・タイプ名・キャラ・純度が全部入るように詰める
  - 右上に小さく「スクショOK」と出す
- `<title>` と H1 に「愛されポンコツ診断」をそのまま入れる。運営のTikTok・Instagramのプロフィールにも同じ言葉を使う

**なぜ**
- 中国のSBTI（2026年4月）には、組み込みのシェア機能がなかった。それでも結果のスクショ投稿で広がり、4月9日のWeChat指数で「sbti」が4,085万に達した【事実】[TechNode（2026-04-10）](https://technode.com/2026/04/10/how-sbti-turned-mbti-into-chinas-latest-viral-meme/)
- TikTokは、投稿のキャプションやコメントに書いたURLをタップできない【二次】[Colorado State University](https://social.colostate.edu/best-practices/how-to-add-a-link-to-a-tiktok-post-and-why-its-not-like-other-platforms/)（日付不明）
- X
  - 2023年10月に、リンクカードから見出しが消えた【事実】[GIGAZINE（2023-10-05）](https://gigazine.net/gsc_news/en/20231005-x-start-remove-link-headline)
  - 2024年初めに、画像の上の小さな見出しとして戻った【事実】[NewscastStudio（2024-01-04）](https://www.newscaststudio.com/2024/01/04/x-headlines-restored/)
  - Nieman Labが18媒体を分析し、リンク付きの投稿は反応が低いと結論した【事実】[GIGAZINE（2026-04-10）](https://gigazine.net/gsc_news/en/20260410-x-post-with-link-low-engagement-with-link)
- 高校生は、推し活やデートスポットの情報集めでTikTokが上位【事実】
  - 調査: 僕と私と、2023年12月、15〜27歳1,154人
  - 出典: [コマースピック（2024-02-01）](https://www.commercepick.com/?p=46572)

**動く指標**
- サイト名での検索流入（Search Console）
- 参照元なし（direct）の来訪の増えた分

**リスク** 小さい

**工数** S

### 8位　週替わり「今週のポンコツお題」

**作るもの**
- `site/content/weekly.json` に、半年分のお題を先に用意する
  - 例: `[{week:'2026-W44', q:'テスト前日の夜、なにしてる？', choices:['一夜漬け','あきらめて寝る','部屋の片づけ','友達と通話']}]`
- トップと結果ページに「今週のお題」カードを置く
  - 1タップで答えると `POST /api/poll {week, choice}` を送る。タイプは端末の `mine` から取る
  - D1の `counters` に `poll:{week}:{type}:{choice}` で数える
- 答えたあとに「既読スルー職人の◯%が『一夜漬け』（全体は◯%）」と出す
  - タイプ別の割合は、そのタイプの回答が30件以上のときだけ出す。それより少ないと「集計中」
- 先週の結果ページ `#/w/{week}` と9:16カードを作る。切り替えは月曜0時（日本時間）
- 1端末1票（localStorage）。IPの回数制限は既存の `rl` 表を使う

**なぜ**
- 방구석연구소の機能【事実】banggooso.com（取得 2026-10-23）
  - 投票・ランキングのテンプレート（候補3〜50、質問3〜10）
  - 「Real-time Ranking」と、タイプ別の参加者一覧
- 16Personalitiesは「Personality Atlas」（国別のタイプ分布）を持っている【事実】[country-profiles](https://www.16personalities.com/country-profiles)（トップページのリンク、取得 2026-10-23）
- Duolingoは公式ブログで、上位◯%の表示で共有率が上がったと書いている【既存ノート v2】
- 2026年上半期の若者の変化は「見る価値」から「参加する価値」へ【既存ノート v3（Youth Now!）】
- 【推論】毎週かわる1問は、もう一度来る理由になる。タイプ別の割合は、運営のTikTokのネタ（「◯◯タイプの62%が…」）にもなる

**動く指標** 週ごとの再訪率（W1リテンション）、お題カードのシェア数

**リスク**
- 「クラスで一番◯◯なのは誰？」のような、他人を選ぶ質問は作らない（NGLとGasの教訓）【既存ノート v3】
- 体型・成績・家庭・恋愛の圧力になる質問は避ける。自由記述はなし

**工数** M

### 9位　コンビニで刷れる・買えるタイプ別シール

**作るもの**
- **段階1（無料配布、S）**
  - 毎月1枚、20タイプのミニシールと季節の二つ名ラベルのシート（L判）をネットワークプリントに登録する
  - サイトに予約番号とQRコードを出す。印刷代はユーザーが店で払う
  - 目安はシール紙L判200円・2L判300円
- **段階2（販売、M）**: コンビニプリント販売の事業者と組む
  - サムライソードの型: シールL判250円、全国約63,000店、IPホルダーを収益シェアで募集【事実】
  - FANBOXプリントの型: ブロマイドL判300円・2L判500円、クリエイターに30%、販売は30日間。シールの記載はない【事実】
- 各シートの端に、小さくQRコード（`/?ch=print`）を入れる

**なぜ**
- 10代女子の2026年上半期トレンド（モノ部門）1位はシール帳 44.9%【既存ノート v3（マイナビティーンズ、2026-06-10）】
- ニフティキッズの調査では、シール帳を持つ中学生の67.1%がシール交換をする【事実】
  - 調査: 2025年末〜2026年1月、2,484人
  - 出典: [nippon.com（2026-03-06）](https://www.nippon.com/ja/japan-data/h02721/)
- コンビニのシール紙印刷の価格
  - シール紙はL判200円・2L判300円【二次】[app-liv](https://app-liv.jp/446583/)（日付不明、検索要約）
  - コンビニでのシール紙印刷は「200円程度から」【二次】[公募ガイド（2024-03-07）](https://koubo.jp/article/25711)
- サムライソードが運営するTVアニメのコンビニプリント（2026-08-28〜09-28）【事実】[ORICON NEWS（PR TIMES配信、2026-08-28）](https://www.oricon.co.jp/pressrelease/2962558/)
  - シール250円、ブロマイド200円
  - 約63,000店のマルチコピー機で、QRコードで印刷する
  - IPホルダーをシェア型で募集している
- FANBOXプリント（シャープ×pixivFANBOX）【事実】[電撃オンライン（2024-09）](https://dengekionline.com/article/202409/16733)
- SHIBUYA109 lab.のトレンド予測2026に「BeReal.ノート」（撮った写真をアルバムにまとめる）がある【事実】[Web担当者Forum（2025-12-16）](https://webtan.impress.co.jp/n/2025/12/16/51868)
- 【推論】
  - 10代がカードなしで、お小遣いの現金で払える
  - Stripeの審査や「占い」の判定とは関係がない
  - シール帳での交換を通じて、友達の手元にキャラとQRが渡る

**動く指標** 印刷数（事業者のレポート）、`ch=print` の来訪、月ごとの再訪

**リスク**
- 段階2では、販売者は事業者になる（特商法の表示も事業者）。分配率や最低条件は確かめられていない
- シール集めは小学生が中心の文化で、「ハマっている」は小学生77.5%に対し中学生47.8%にとどまる【事実】ニフティ調査（2025-12-23〜2026-01-26、2,484人）、[マイナビニュース（2026-02-27）](https://news.mynavi.jp/article/20260227-4170250/)
- 名前や二つ名を入れた1人ずつの印刷は、販売型のコンテンツプリントでは難しい（決まった絵柄を売る仕組み）。1人ずつの印刷は、段階1の無料ネップリで扱う

**工数** M

### 10位　結果の直前の「計算中」演出（労働の錯覚）

**作るもの**
- くわしい診断の最後の回答のあとに、2.0秒の画面を出す。次の3行を順にチェックしていく
  - 「36問の答えから10項目のステータスを計算中」
  - 「二つ名240通りから照合中」
  - 「隠しタイプの条件をチェック中」
- 本当にしている計算だけを書く。「AIが分析」などは書かない
- 2回目以降と `prefers-reduced-motion` のときは飛ばす
- A/B: `calc: ['on','off']`

**なぜ**
- Buell & Norton（2011）"The Labor Illusion: How Operational Transparency Increases Perceived Value"、*Management Science* 57(9): 1564–1579【事実（二次の要約で確認）】
  - 作業を見せると、待ち時間が長くても、利用者はサービスの価値を高く感じる
  - 出典: [INFORMSの引用一覧](https://pubsonline.informs.org/doi/references/10.1287/msom.2020.0899)、[要約](https://agilebrandguide.com/wiki/terms/labor-illusion/)
- 【推論】結果の直前は、価値を一番感じる瞬間。完全版の案内はその直後に出る

**動く指標**
- レポート表示→購入案内のクリック→決済（既存のab段階）
- ガード指標として、演出の途中で離脱した率

**リスク**
- 待たせすぎると離脱する。2.5秒以内にする
- 嘘の工程は書かない（ダークパターンになる）

**工数** S

### 次点（11位以下）

- **6秒の「結果発表」動画（MP4）を書き出す**（M）
  - TikTokのカルーセルは、動画より反応が81%多い。一方で、シェアは約3分の1少ない【事実】Fanpage Karma（2章）
  - iOS Safari 14.3からは、MediaRecorderでMP4（H.264）を記録できる【事実】WebKit（2章）
- **カルーセルの2枚目を、それだけで意味が通る1枚にする**（S）
  - Instagramは、素通りされたカルーセルを2枚目から出し直すとされる【二次】（2章）
- **インスタのフィード用に3:4（1080×1440）版を足す**（S）
  - 2025年からプロフィールのグリッドが3:4になった【二次】（2章）
- **印刷できる「ポンコツプロフ帳」（A4・L判、QRつき）**（S〜M）
  - 卒業（2〜3月）と新学期（4月）に合わせる（5章）
- **グループ診断のリンクをLINEの「アナウンス」で固定する案内**（S）（5章）
- **二つ名ごとのOGP画像（240通り）**（M）（2章）

---

## 1. LP・1画面目のパターン

### 1-1. 事実（サービス別）

| サービス | 1画面目 | 利用者数などの数字 | 見本・一覧 | FAQ | 1問目まで | 出典 |
|---|---|---|---|---|---|---|
| 16Personalities（日本語） | 引用の見出し「やっと自分のことを理解してもらえました」、説明「たった10分で…」、ボタン「テストを受ける」 | 「15万+ 本日の診断回数」「2億+ アメリカで受けられたテスト」「15.88億+ 累計診断回数」「91.2% 正確性の評価」 | トップにはない（タイプページは別） | フッターのリンクだけ | ボタン1回（テストページはJS描画で未確認） | 【事実】[16personalities.com/ja](https://www.16personalities.com/ja)（取得 2026-10-23） |
| 悪口診断 | 見出し「悪口で暴く、16の害獣タイプ」、ボタン「診断をはじめる」 | なし | 16タイプの一覧（コードつき）、結果に入るもの（キャッチコピー・悪口解説・相性） | 3問（当たる？→「刺さるかどうかで判断して」／ひどすぎ→「全タイプ平等に」／友達と→シェアを勧める） | ボタン1回で `/quiz`（「全20問・約2分」） | 【事実】[waruguchi16.jp](https://waruguchi16.jp/)（取得 2026-10-23） |
| 방구석연구소（banggooso） | 「오늘도 만나서 반가워!」「추천 콘텐츠를 즐겨봐」。ログインやアプリへの誘導がある | 「Participants \| {{number}} people」「Real-time Ranking」「Out of total ... participants」 | 「See all types」、投票・ランキングのテンプレート | あり（リンク） | コンテンツごと | 【事実】banggooso.com（取得 2026-10-23） |
| 16TEST | 無料の16TESTは92問・約5分。有料の16TEST+は約180問の追加分析 | — | — | — | — | 【検索要約】[App Store](https://apps.apple.com/jp/app/id1489474014) |
| SBTI（中国） | 31問、自嘲的な27タイプ。シェア機能は組み込まれておらず、スクショで拡散 | WeChat指数で「sbti」が4,085万（2026-04-09） | — | — | — | 【事実】TechNode（2026-04-10）、【検索要約】[星島頭條](https://www.stheadline.com/zh-hans/lifetips/3560918/MBTI已经过时内地搞笑版人格测试SBTI爆红-27种自嘲式人格-背后藏暖心理由) |
| BuzzFeed | 一覧に「Trending」「Top Quizzes Ever」とカテゴリのタブ。タイトルに問数（「These 5 Questions」「15 Flower Choices」） | コメント数 | — | — | 個別ページは取得できず | 【事実】[buzzfeed.com/quizzes](https://www.buzzfeed.com/quizzes)（取得 2026-10-23） |
| BuzzFeedのスポンサードクイズ | — | 始めた人の96%が最後まで解く | — | — | — | 【検索要約】[Digiday](https://digiday.com/media/buzzfeed-quizes/)（日付不明） |
| いまの「愛されポンコツ診断」 | タイトル、キャッチ、キャラの行列、ボタン2つ（かんたん・くわしい）、補足、バッジ3つ | なし | 隠しタイプのシルエット | なし | ボタン1回でQ1 | 【コード確認】`app.js` viewHome |

- 「ドラゴン診断」は、名前で検索しても該当する診断サイトを特定できなかった（9章）

### 1-2. 解釈【推論】

- 上位サイトのLPは、どれも短い（見出し・1行・ボタン）。違いは**数字があるかどうか**と、**いまの盛り上がりを見せるかどうか**
  - 16Pは「本日の診断回数」で「いまも人が受けている」ことを見せている
  - 方구석연구소は参加者数とリアルタイムランキング
- 「正確性の評価91.2%」のような**利用者の評価の割合**は、日本では「当たる」と読まれやすい。占いと見られないよう、「わかる率」（共感）として出すのがよい
- FAQは「当たるの？」への答え方が大事。悪口診断の「刺さるかどうか」は、占いと距離を置く答え方の手本になる
- LP上でQ1に答えさせる効果を直接測った公開データは見つからなかった（6章）。このため0位の3位はA/Bで確かめる前提にした

### 1-3. LPの仕様のまとめ（0章の3位の補足）

- FAQの文案【推論】
  - Q「占いなの？」→ A「ちがいます。12問の答えから、あなたのポンコツなところと愛されポイントをタイプに分けるエンタメの心理テストです」
  - Q「何分かかる？」→ A「かんたん診断は12問・約1分。くわしい診断は＋24問・約3分」
  - Q「データは？」→ A「名前や回答は集めていません。数えているのは診断したタイプとボタンが押された回数だけ」（いまの「このサイトについて」と合わせる）
  - Q「お金はかかる？」→ A「診断と結果は無料。くわしい解説の完全版だけ{price}円（買い切り）」
- 見本カードは、本物の結果カードを縮小して3枚。タイプは毎回ランダムにして、「自分はどれだろう」と思わせる

---

## 2. シェア画像のフォーマット（2025〜2026年）

### 2-1. サイズと安全域（事実と二次）

| 置き場所 | 推奨サイズ | 注意すること | 出典 |
|---|---|---|---|
| Instagramストーリー | 1080×1920（9:16） | 通常のストーリーは上下約250pxを避けるのが実務の目安（公式値なし）。広告仕様は上14%（約269px）・下35% | 【二次】[inro（2026）](https://www.inro.social/blog/instagram-story-size)、[socialync](https://www.socialync.io/tools/safe-zones/instagram-stories) |
| Instagramフィード | 1080×1440（3:4）。グリッドでも切れない | グリッドは2025-01-19に3:4へ。2025-05-28から3:4の写真をそのまま投稿できる。APIの公開範囲は今も4:5〜1.91:1 | 【二次】[Engadget（テスト報道）](https://www.engadget.com/social-media/instagrams-experimental-profile-grid-has-rectangular-images-instead-of-squares-160007086.html)、[Neal Schaffer](https://nealschaffer.com/instagram-post-size/) |
| TikTokフォトモード | 1080×1920（9:16）。1投稿で最大35枚 | 最少枚数は解説によって2枚か4枚で食い違う。1枚あたりの上限は20MBとする解説が多い | 【二次】[Buffer](https://buffer.com/resources/tiktok-carousel/)、[postfa.st](https://postfa.st/sizes/tiktok/carousel) |
| X（リンクカード） | 1200×630前後（`summary_large_image`） | 2023年10月に見出しが消え、2024年初めに画像の上の小さな見出しとして戻った。大事な文字は画像の中央に置く | 【事実】GIGAZINE（2023-10-05）、NewscastStudio（2024-01-04） |
| LINE（リンクのプレビュー） | 1200×630が一般的な推奨（LINE公式の仕様ではない） | 古いプレビューは「Page Poker」で消せる（ブログ情報、2022年） | 【二次】[toolsbase](https://toolsbase.dev/ja/developer/ogp-generator)、[israynotarray（2022-03-04）](https://israynotarray.com/en/misc/2022/03/04/clear-line-link-preview-cache-with-page-poker/) |

- いまのストーリーカードは、サイト名（y=160）とCTA・ドメイン（y=1774・1822）が上下の帯に入っている【コード確認】。0章の2位で直す

### 2-2. 2025〜2026年の形式ごとの数字

- **TikTokのカルーセルと動画**【事実】[Fanpage Karma](https://www.fanpagekarma.com/insights/carousel-vs-video-performance-tiktok-instagram/)
  - 対象: 2025-01-01〜05-31の約70万投稿。公開日は書かれていない
  - カルーセルは動画に比べて、リーチが約3%多く、反応率が81%高く、いいねが約82%多い
  - ただし、シェアは約3分の1少ない
- **Instagramのカルーセルとリール**【事実】（同上）
  - カルーセルは、リーチが13%多く、反応率が1.5倍
  - シェアはほぼ同じ
  - 1枚目で手を止めさせ、2枚目はそれだけで意味が通るように作るよう勧めている
- **カルーセルの「2枚目からの再表示」**【二次】[Planoly](https://planoly.com/blog/instagram-carousels-are-making-a-comeback)
  - 素通りされたカルーセルを、Instagramが2枚目から出し直すことがあるとされる（Mosseri氏の発言として紹介）
  - Instagramの公式の文書では確かめられなかった
- **「お題」スタンプとテンプレート**【事実】2023-12-15にAdd Yoursテンプレートが全世界で公開（0章の2位）
- **Spotify daylist**【事実】ストーリーズの流行から広がり、検索が1週間で20,000%増（0章の6位）
- **Web Share API**【事実】Googleのサンタトラッカーでは、Web Shareを使えた人のシェアが約20%多かった。方法の詳細は書かれていない [web.dev](https://web.dev/web-share)（取得 2026-10-23）
  - 当サービスは `navigator.share` をすでに使っている【コード確認】

### 2-3. いまの6枚カルーセルへの小さな改善【推論】

- 2枚目を「二つ名＋キャラ」にして、それだけで「何の診断か」と「自分も知りたい」が伝わるようにする
- 6枚目（最後）に、検索窓風の帯「🔍 愛されポンコツ診断」を入れる（0章の7位）
- インスタのフィード用に、3:4（1080×1440）で同じ6枚を出す選択肢を足す。9:16のままだとフィードで上下が切れる
- 動画の書き出し（次点）
  - canvasの `captureStream()` を `MediaRecorder` で録画すれば、端末の中だけでMP4を作れる
  - WebKitは、iOS Safari 14.3でMediaRecorderを既定で有効にし、MP4（H.264/AAC）に対応した【事実】[WebKit blog](https://webkit.org/blog/11353/mediarecorder-api/)
  - 2025年3月に、iOS 18.4ベータでmp4の録画の不具合が報告されている【事実】[WebKit Bugzilla 290002](https://bugs.webkit.org/show_bug.cgi?id=290002)
  - `MediaRecorder.isTypeSupported()` で確かめ、使えない端末では画像に戻す

---

## 3. 占いなしで再訪を生むしくみ

### 3-1. 事実

- **時間で変わる自己ラベル**: Spotify daylist（0章の6位）
- **ネタバレのない結果の共有**: Wordle（0章の5位）
- **友達の参加を知らせる**: 방구석연구소は、アプリの通知で知らせる【事実】（0章の1位）
- **Webのプッシュ通知の制約**: iOS・iPadOS 16.4のWebプッシュは、ホーム画面に追加したWebアプリだけ。ユーザーの操作をきっかけにしないと許可を求められない【事実】[WebKit（2023-02-16）](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
  - 【推論】ログインなし・アプリ内ブラウザ中心の当サービスでは、通知は再訪の手段にならない
- **アプリ内ブラウザの保存領域は別**（0章の4位）
- **韓国のシリーズ化**: 韓国の診断サイトは2週間に1本ペースで新作を出す。푸망（Poomang）は新年版のやり直しを用意する【既存ノート v2】
- **2026年の若者**
  - SHIBUYA109 lab.のトレンド予測2026
    - モノ・コト部門のキーワードは「アテンション・デトックス」
    - 「BeReal.ノート」（写真をアルバムにまとめる）
    - yope（友達の中だけで画像やメッセージを共有するSNSアプリ）
    - 15〜24歳の女性401人、2025年10〜11月
    - 【事実】[Web担当者Forum（2025-12-16）](https://webtan.impress.co.jp/n/2025/12/16/51868)

### 3-2. 当サービス向けの再訪の設計【推論】

| しかけ | 間隔 | 戻ってくる理由 | 0章の順位 |
|---|---|---|---|
| いまの二つ名 | 数時間 | 時間帯で言葉が変わる | 6位 |
| 今週のお題 | 1週間 | 新しい1問と、先週の結果発表 | 8位 |
| 季節のシール（ネップリ） | 1か月 | 新しいシートが出る | 9位 |
| どこでも続きリンク | 随時 | データが消えない、別のアプリからでも続きができる | 4位 |
| わたしクイズの成績表 | 友達しだい | 友達が答えると届く（既存） | — |

- 通知に頼らない。そのかわり「次に変わる時刻」「来週の月曜」のような**本当の予定**を、画面とシェア画像に書く
- 季節の版（新学期・夏休み・ハロウィン・年末）は、v3で提案ずみ。ここでは「季節のシール」と「いまの二つ名の季節の言葉」に組みこむ

---

## 4. 10代が買う「追加の商品」

### 4-1. 事実

| 商品 | 価格・条件 | 出典 |
|---|---|---|
| ロック画面の壁紙 | 当サービスはすでに完全版の特典にしている | 【コード確認】 |
| コンビニプリントのシール（IP公式） | L判シール250円、ブロマイド200円、約63,000店、1か月の期間販売。IPホルダーを収益シェアで募集 | 【事実】ORICON NEWS（2026-08-28） |
| FANBOXプリント | ブロマイドL判300円・2L判500円、A4普通紙300円・光沢紙500円。クリエイターに30%。審査あり、二次創作とAI生成は不可 | 【事実】電撃オンライン（2024-09） |
| ネットワークプリントのシール紙 | L判200円・2L判300円（目安）。印刷代はユーザー負担 | 【二次】[app-liv](https://app-liv.jp/446583/)（日付不明）、[公募ガイド（2024-03-07）](https://koubo.jp/article/25711) |
| コンビニで刷れるプロフィールシート「プロフィーちゃん」 | ブラウザで作り、全国約58,000店のコンビニで印刷。2026-02-06に発表。価格の記載なし | 【事実】[PR TIMES（2026-02-06）](https://prtimes.jp/main/html/rd/p/000000224.000027316.html) |
| LINEスタンプ | 10〜20代のスタンプ利用者の76.8%が有料スタンプを買ったことがある（10代478人・20代502人）。10代の17.7%は無料スタンプだけ。**2017年の調査で古い** | 【事実】テスティー調査、[ECのミカタ（2017-03-09）](https://ecnomikata.com/pr/13854/) |
| 恋愛の相性の深掘り | ラブタイプ診断は個人980円、相性1,480円 | 【既存ノート v2】 |

### 4-2. 解釈【推論】

- 10代向けの商品は、**払い方**で選ぶのがよい
  - いまの完全版（Stripe・PayPay・保護者リンク）は、カードもPayPayもない子には届かない
  - コンビニの現金払い（シール・ブロマイド）は、その子にも届く。販売者が事業者なので、Stripeの業種審査とも関係がない
- 何を買うかは、「持ち歩いて見せられるもの」が強い。シール帳の交換、スマホケースに入れるブロマイド、プリ帳のような使い方をする
- 「1人ずつの名前入り」は、コンビニの販売型の仕組みでは作れない。タイプ別（20種）×季節で、絵柄を固定して出す
- 公開されたデータでは、診断の追加商品の購入率は見つからなかった（9章）。段階1の無料配布で印刷数を見てから、段階2に進む

---

## 5. LINEと学校生活のループ

### 5-1. 事実

- **LINEの位置づけ**
  - 小中学生の調査（NTTドコモ モバイル社会研究所、2024年11月、1,300組）で、利用率はLINEがいちばん高く、TikTok、Instagramの順。中学生女子のSNS利用率は96%【事実】[Web担当者Forum（2025-04-24）](https://webtan.impress.co.jp/n/2025/04/24/49040)
  - 高校生がいちばん使うSNSは、LINE 39.8%・Instagram 32.9%・X 20.1%（Studyplus、2024年7月、1,401人）【事実】リセマム（2024-10-24）
- **LINEでできること**
  - `https://line.me/R/share?text=` で、送り先（友だち・グループ・Keepメモ）を選ぶ画面が開く。テキストはUTF-8でパーセントエンコードする【事実】LINE Developers（取得 2026-10-23）
  - トークの「アナウンス」機能で、メッセージを上に固定できる。1つのトークルームで最大5件、基本的に通知は行かない【二次】[iPhone Mania](https://iphone-mania.jp/manual/howtoappli-592847/)（日付不明）
- **オープンチャットの年齢の制限**
  - 18歳未満と年齢確認をしていない人は、オープンチャットの検索などが使えない。知らない人とのトラブルを防ぐため【二次】[楽天モバイル（2026）](https://network.mobile.rakuten.co.jp/sumakatsu/contents/articles/2026/00500/)
  - 保護者がオープンチャットの年齢制限を求める署名活動もある【二次】[Change.org](https://www.change.org/p/lineオープンチャットに年齢制限を-子どもたちの安全を守ってください)
- **学校生活**
  - 高校生の81%がMBTIを「よいこと」と受け止めている（ニッセイ基礎研究所の2025年のレターが朝日新聞の調査を引用）【検索要約】[ニッセイ基礎研究所](https://www.nli-research.co.jp/files/topics/82088_ext_18_0.pdf?site=nli)
  - 初対面でタイプを打ち明け合う使われ方が紹介されている【検索要約】[東洋経済オンライン](https://toyokeizai.net/articles/-/935044)
  - コンビニで刷れるプロフィールシート「プロフィーちゃん」は、卒業・卒園の思い出づくりキャンペーンを2026-02-02〜03-31に実施【事実】PR TIMES（2026-02-06）

### 5-2. 当サービス向けの仕様【推論】

- **LINEグループ向け（0章の5位と次点）**
  - グループ診断を作った直後に「LINEグループに送ったら、長押し→アナウンスで固定しておくと、あとから入った人も参加できるよ」と1行出す
  - グループ診断の結果がそろったら、テキスト結果（絵文字バー）で「ベストペア」「役割」を送れるようにする（画像なしでも伝わる）
- **オープンチャットへの宣伝はしない**
  - LINEは18歳未満の検索を制限しており、知らない人との接触を防ぐ方針
  - 運営が10代の多いオープンチャットに宣伝を流すのは、方針に反し、安全面の問題も大きい
- **学校の暦に合わせる（季節版）**
  - 4月（新学期・クラス替え）: プロフ帳カードに「新しいクラス用」の枠。グループ診断の入力例は「2年3組」ではなく「なかよし4人」にする（本名・学校名を書かせない。v3 copy review B8）
  - 2〜3月（卒業）: 印刷できる「ポンコツプロフ帳」A4・L判。友達に手渡しする紙。右下に「わたしのタイプは？」のQR
  - 9〜11月（文化祭・修学旅行）: グループ診断の役割名を、行事向けの言葉に差し替える（判定は同じ）
- **アプリ内ブラウザ対策**: どこでも続きリンク（0章の4位）をLINEのKeepメモへ

---

## 6. クイズのファネルの数字とA/B

### 6-1. 公開されている数字

| 項目 | 数字 | 種類・注意 | 出典 |
|---|---|---|---|
| 開始→完了 | 65%（全体）。コーチング・講座59.1%、EC55.5%、サービス業47.3% | Interactの自社集計。対照実験ではない | 【事実】[Interact（2026-09-08更新）](https://tryinteract.com/blog/quiz-conversion-rate-report/) |
| 開始→リード | 40.1% | 同上 | 同上 |
| 問数と完了 | 6問までは完了率が保たれ、それを超えると下がりはじめる | Interactのデータの言いかえ。数値なし | 【二次】[Kinetic（2026-04-30）](https://www.usekinetic.com/blog/quiz-funnel) |
| 問数と完了（幅） | 3〜7問 65〜85%、8〜15問 45〜65%、16問以上 25〜45%。性格診断は60〜80% | 方法の説明がほとんどない | 【二次】[Outgrow（2025-06-25）](https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates) |
| 流入元と完了 | メール70〜85%、Google検索55〜70%、SNS45〜60%、広告35〜50% | 同上 | 同上 |
| 開始率 | 40〜60%（流入元による） | 同上 | 同上 |
| 進捗バー | 完了率+12〜18%（数字の根拠は不明）。v3のメタ分析（進捗バーだけでは効かない）と食い違う | 低い信頼度 | 同上。【既存ノート v3】 |
| 読みこみ時間 | 1秒遅れるごとに完了が約7%下がる | 根拠不明 | 同上 |
| 問数と購入 | 1〜5問 9.8%、9〜12問 11.0% | 商品おすすめクイズの集計。期間・件数なし | 【二次】[RevenueHunt（2024-06-06、2026年に更新）](https://revenuehunt.com/product-quiz-metrics-what-to-track-to-convert-better/) |
| BuzzFeedのスポンサードクイズ | 始めた人の96%が完了 | 日付不明 | 【検索要約】Digiday |
| 登録を後ろに回す | DAU約20%増（Duolingo） | 自己申告 | 【二次】First Round Review |
| 最初を簡単な1択に | 質の高い問い合わせ+13% | ベンダーの事例 | 【二次】Reform |
| 1問ずつのフォーム | 問い合わせの成約率が0.96%→8.1% | 自社の発表 | 【二次】[Venture Harbour](https://ventureharbour.com/cro-case-studies/)（日付不明） |
| 表示速度 | 0.1秒速いと小売CVR+8.4%、旅行+10.1% | Google委託の調査 | 【事実】web.dev（2020） |
| ネイティブのシェア | Web Shareで約20%多くシェア | 方法の詳細なし | 【事実】web.dev（取得 2026-10-23） |
| 社会的証明の数字 | GoodUIは「Social Counts」の型で18件のA/Bを集めているが、結果は会員限定 | 結果は見られない | 【事実】[GoodUI Pattern #7](https://goodui.org/patterns/7)（取得 2026-10-23） |
| 作業を見せる | 待ち時間があっても価値を高く感じる | 学術（Management Science, 2011） | 【事実（二次要約）】0章の10位 |

### 6-2. 当サービスへの当てはめ【推論】

- かんたん診断の12問は、ベンダーの区分では「中くらい」。性格診断でSNSから来る人が多いので、完了率の目安は45〜80%と幅が広い。**自社の数字で見るしかない**
- 対照実験の根拠があるのは、次の2つだけ
  - 表示速度（Deloitte）
  - 作業を見せる効果（Buell & Norton）
- それ以外（LPの1問目、カウンター、問数）はベンダーの観察。必ずA/Bで確かめる
- A/Bの必要な人数（有意水準5%・検出力80%、両側）の目安
  - LPの開始率が50%前後で、5ポイント（相対10%）の差を見たいとき: 各群約1,600人
  - シェア率が10%前後で、2ポイントの差を見たいとき: 各群約3,500人
  - 購入率が3%前後で、1ポイントの差を見たいとき: 各群約5,000人
  - （計算: n ≈ 2×(1.96+0.84)²×p(1−p)/差²）

---

## 7. 計測（新しく足すイベントとKPI）【推論】

- `functions/api/event.js` の `ALLOWED` に足すもの
  - `ref`: `f`（相性おさそい付き）、`igs`（ストーリー）、`print`（シール・プロフ帳のQR）、`me`（マイリンク）
  - `share`: `text`、`igs-guide`、`pairback`、`now-nick`（いまの二つ名）、`poll`
  - `lp`: `q1`（LPで1問目に答えた）
  - `agree`: `yes`、`no`
  - `poll`: `vote`
- `experiments.js` に足すA/B: `sharef`、`lp`、`calc`
- 週に1回見るKPI
  - LP開始率 ＝ `day:*:lp:q1`（または `start`）÷ LPの表示
  - 完了率 ＝ `done` ÷ `start`
  - シェア率 ＝ `share` ÷ `done`（経路別）
  - 紹介で来た人の開始率 ＝ ref経由の `start` ÷ `ref`
  - K係数 ＝ シェア率 × シェア1件あたりの来訪 × 開始率 × 完了率
  - W1再訪率 ＝ マイリンクの開封と `poll:vote` の重複（端末のlocalStorageに初回の週を持たせて数える）
  - 購入率 ＝ 既存のab段階

---

## 8. やらないこと（リスク）

- **シェアしないと結果が見られない作り（シェア強制）**
  - 中国のWeChatは、2016年の「外部リンク内容管理規範」で、「シェアしないと次へ進めない・答えがわからない」を誘導シェアとして禁止した。2021年の改訂でも、過度なマーケティングや誘導シェアを防ぐと明記している【検索要約】[IT之家](https://www.ithome.com/0/217/760.htm)、[36氪](https://www.36kr.com/p/1724606627841)
  - 【推論】日本では法律の禁止ではない。それでも、10代に「広めないと見られない」という圧力をかけることになり、ブランドを損なう
- **オープンチャットへの宣伝**（5章）
- **数字の水増し**（0章の3位のリスク）
- **他人を選ぶ投票**（「クラスで一番◯◯なのは誰？」）。いじめに使われうる【既存ノート v3（NGL・Gas）】
- **Webのプッシュ通知を前提にした再訪**: iOSではホーム画面に追加したWebアプリしか使えない（3章）
- **占いの言葉**: 「運勢」「ラッキー」「当たる」「鑑定」。Stripe Japanの禁止業種「サイキックサービス・占い師」に見えないようにする【既存ノート v2・v3】

---

## 9. 確かめられなかったこと（Gaps）

- **LP上にQ1を置く効果**: 直接比べたA/Bの公開データは見つからなかった。GoodUIのフォームの型（Easiest Fields First など）は会員限定で、結果が見られない
- **社会的証明の数字の効果**: GoodUIは18件のテストを集めているが、効果量は会員限定
- **BuzzFeedのクイズ画面**: 406で取得できず。1問目がすぐ出るか、結果のあとに「みんなの結果」を出すかは確かめていない
- **LoveType16・診断メーカー・16TESTのトップ**: 403や502で取得できず。v2の情報（6問・18問のルート、累計1億回）以上の確認はできていない
- **ktestone（케이테스트）のトップ**: JSで描画され、参加者数の表示などは確かめられなかった
- **「ドラゴン診断」**: 名前で検索しても、該当する診断サイトを特定できなかった
- **2026年9〜10月の日本で話題の診断**: 検索では特定の新しい診断を見つけられなかった
- **インスタのストーリー安全域の公式値**: Metaの公式は広告の値だけ。通常の投稿の250pxは実務の目安
- **TikTokフォトモードの公式仕様**: 公式の文書は見つからず、解説サイトの値（最大35枚、1080×1920）
- **Xのリンクカードの見出しの正確な位置**: 「画像の上」とする報道だけで、画面での位置は確かめていない
- **LINEのリンクプレビューの切り抜き方**: 公式の仕様が見つからなかった
- **Instagramの「2枚目からの再表示」**: Mosseri氏の発言として紹介されているが、公式の文書は見つからなかった
- **10代が診断の追加商品（壁紙・シール・PDF）を買う率**: 公開データは見つからなかった
- **コンビニプリント事業者の契約条件**: サムライソードの分配率や最低条件は公開されていない
- **LINEスタンプの購入率**: 見つかった数字（テスティー）は2017年の調査で、2025〜2026年の10代の数字は見つからなかった
- **中国のMBTI・SBTI関連グッズの販売数**: グッズ市場全体（谷子）の伸びの報道はあるが、性格診断のグッズ単独の数字は見つからなかった
- **オープンチャットの18歳未満の制限の範囲**: LINE公式のヘルプページは取得できず、解説記事で確かめた
- **Galesic & Bosnjak（2009）**（予告した所要時間が参加率に与える影響）: 論文の本文を取得できず、今回は根拠に使っていない
- **daylistのInstagramテンプレート**: 「ストーリーズの流行」という報道はあるが、テンプレートの仕組み（Add Yoursかどうか）は確かめていない

---

## 付録: 主な出典（日付つき）

**LP・競合**
- 16Personalities 日本語トップ（取得 2026-10-23）: https://www.16personalities.com/ja
- craft.co 16Personalities（2023-05時点の91.2%）: https://craft.co/16personalities
- 悪口診断トップ（取得 2026-10-23）: https://waruguchi16.jp/
- 방구석연구소（banggooso）トップの埋め込みデータ（取得 2026-10-23）: https://www.banggooso.com/
- BuzzFeed クイズ一覧（取得 2026-10-23）: https://www.buzzfeed.com/quizzes
- TechNode「SBTI」（2026-04-10）: https://technode.com/2026/04/10/how-sbti-turned-mbti-into-chinas-latest-viral-meme/

**シェアの形式・プラットフォーム**
- Instagramリンクスタンプの全開放（2021-10）: https://searchengineland.com/instagram-opens-stories-link-sticker-to-all-users-375591
- 「お題」スタンプ（appllio、2021-11-02）: https://appllio.com/instagram-story-topic-sticker
- Add Yoursテンプレート（TechCrunch、2023-12-15）: https://techcrunch.com/2023/12/15/instagram-add-yours-template-story-sticker/
- ストーリーの安全域（inro、2026）: https://www.inro.social/blog/instagram-story-size
- ストーリーの安全域（socialync）: https://www.socialync.io/tools/safe-zones/instagram-stories
- 3:4グリッド（Engadget）: https://www.engadget.com/social-media/instagrams-experimental-profile-grid-has-rectangular-images-instead-of-squares-160007086.html
- 3:4グリッド（Neal Schaffer）: https://nealschaffer.com/instagram-post-size/
- TikTokカルーセルの仕様（Buffer）: https://buffer.com/resources/tiktok-carousel/
- TikTokカルーセルの仕様（postfa.st）: https://postfa.st/sizes/tiktok/carousel
- カルーセルと動画（Fanpage Karma、2025年1〜5月のデータ）: https://www.fanpagekarma.com/insights/carousel-vs-video-performance-tiktok-instagram/
- 2枚目の再表示（Planoly）: https://planoly.com/blog/instagram-carousels-are-making-a-comeback
- Xの見出し削除（GIGAZINE、2023-10-05）: https://gigazine.net/gsc_news/en/20231005-x-start-remove-link-headline
- Xの見出しの復活（NewscastStudio、2024-01-04）: https://www.newscaststudio.com/2024/01/04/x-headlines-restored/
- Xのリンク付き投稿の反応（GIGAZINE、2026-04-10）: https://gigazine.net/gsc_news/en/20260410-x-post-with-link-low-engagement-with-link
- TikTokのキャプションのリンク（Colorado State University）: https://social.colostate.edu/best-practices/how-to-add-a-link-to-a-tiktok-post-and-why-its-not-like-other-platforms/
- Web Share API（web.dev）: https://web.dev/web-share
- MediaRecorder（WebKit）: https://webkit.org/blog/11353/mediarecorder-api/
- iOS 18.4ベータのMediaRecorderの不具合（WebKit Bugzilla）: https://bugs.webkit.org/show_bug.cgi?id=290002

**再訪・行動のヒット例**
- Wordle（Wikipedia）: https://en.wikipedia.org/wiki/Wordle
- Wordle（Know Your Meme）: https://knowyourmeme.com/memes/subcultures/wordle
- Spotify daylist（YPulse、2024-01-24）: https://www.ypulse.com/newsfeed/2024/01/24/spotifys-personalized-daylists-are-going-viral/
- Spotify daylist（Digital Music News、2024-01-19）: https://www.digitalmusicnews.com/2024/01/19/spotify-daylist-is-blowing-up-too-bad-the-creator-was-laid-off/
- Spotify daylist（Axios、2024-09-04）: https://www.axios.com/2024/09/04/spotify-daylist-feature-globally-viral
- Spotify daylist（TechRadar）: https://www.techradar.com/audio/audio-streaming/spotify-daylists-have-taken-over-my-instagram-stories-and-theyre-coming-for-yours-too
- iOSのWebプッシュ（WebKit、2023-02-16）: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- アプリ内ブラウザのlocalStorage（Apple Developer Forums）: https://developer.apple.com/forums/thread/765680
- アプリ内ブラウザの保存領域（Fingerprint docs）: https://docs.fingerprint.com/docs/identifying-in-app-browsers-for-ios

**日本の10代・LINE**
- Studyplus 高校生のSNS（リセマム、2024-10-24）: https://resemom.jp/article/2024/10/24/79283.html
- ティーンアカウントの刷新（INTERNET Watch、2026-05-08）: https://internet.watch.impress.co.jp/docs/news/2106189.html
- モバイル社会研究所 小中学生のSNS（Web担当者Forum、2025-04-24）: https://webtan.impress.co.jp/n/2025/04/24/49040
- 僕と私と TikTok調査（コマースピック、2024-02-01）: https://www.commercepick.com/?p=46572
- SHIBUYA109 lab. トレンド予測2026（Web担当者Forum、2025-12-16）: https://webtan.impress.co.jp/n/2025/12/16/51868
- LINE URLスキーム（LINE Developers）: https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/
- LINEのアナウンス機能（iPhone Mania）: https://iphone-mania.jp/manual/howtoappli-592847/
- オープンチャットの年齢制限（楽天モバイル、2026）: https://network.mobile.rakuten.co.jp/sumakatsu/contents/articles/2026/00500/
- LINEのPage Poker（ブログ、2022-03-04）: https://israynotarray.com/en/misc/2022/03/04/clear-line-link-preview-cache-with-page-poker/

**マネタイズ（シール・印刷）**
- ニフティキッズ「シール」調査（nippon.com、2026-03-06）: https://www.nippon.com/ja/japan-data/h02721/
- ニフティ調査のハマり率（マイナビニュース、2026-02-27）: https://news.mynavi.jp/article/20260227-4170250/
- サムライソードのコンビニプリント（ORICON NEWS、2026-08-28）: https://www.oricon.co.jp/pressrelease/2962558/
- FANBOXプリント（電撃オンライン、2024-09）: https://dengekionline.com/article/202409/16733
- プロフィーちゃん（PR TIMES、2026-02-06）: https://prtimes.jp/main/html/rd/p/000000224.000027316.html
- コンビニでシールを作る（公募ガイド、2024-03-07）: https://koubo.jp/article/25711
- ネットワークプリントの料金（app-liv、日付不明）: https://app-liv.jp/446583/
- LINEスタンプの購入経験（ECのミカタ、2017-03-09）: https://ecnomikata.com/pr/13854/

**ファネルの数字**
- Interact（2026-09-08更新）: https://tryinteract.com/blog/quiz-conversion-rate-report/
- Outgrow（2025-06-25）: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates
- RevenueHunt（2024-06-06、2026年に更新）: https://revenuehunt.com/product-quiz-metrics-what-to-track-to-convert-better/
- Kinetic（2026-04-30）: https://www.usekinetic.com/blog/quiz-funnel
- Duolingo（First Round Review）: https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker
- Reform: https://www.reform.app/play/multi-step-forms-benefits-3
- Venture Harbour: https://ventureharbour.com/cro-case-studies/
- Milliseconds make millions（web.dev、2020）: https://web.dev/case-studies/milliseconds-make-millions
- GoodUI Pattern #7: https://goodui.org/patterns/7
- 労働の錯覚（INFORMSの引用一覧）: https://pubsonline.informs.org/doi/references/10.1287/msom.2020.0899
- 労働の錯覚（要約）: https://agilebrandguide.com/wiki/terms/labor-illusion/
- OptiMonk（紹介元に合わせたLP）: https://www.optimonk.com/affiliate-marketing-conversion-rate

**リスク**
- WeChatの誘導シェア禁止（IT之家）: https://www.ithome.com/0/217/760.htm
- WeChatの誘導シェア禁止（36氪）: https://www.36kr.com/p/1724606627841
- 消費者庁のダークパターンの方針: 【既存ノート `v3/paywall_patterns.md` 4-3】
