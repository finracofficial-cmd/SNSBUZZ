# 日本でバズったWeb系UGCコンテンツ（診断／ジェネレーター／占い／Webツール）事例カタログ — 「80億分の1」重点調査（調査日: 2026-10-23）

## Q1. 「80億分の1」とは何か（誰が・いつ・何を入力し何が出るか・どう共有され・どこで広がり・規模・なぜ広がったか・派生／模倣）

### Takeaway
「80億分の1」（1 in 8 Billion, https://1in8b.life/ja/）は「診断」ではなく、国連・WHO・世界銀行などの実統計で「世界のどこかにランダムに生まれ、1年ずつ一生を生きる」無料ブラウザ人生シミュレーター。韓国系の個人開発者（仮名 Jin Hwi-eus／진휘어스、運営名義 Jin's Earth、カナダ・オンタリオ州住所）がClaudeと約4時間で作り2026年10月5日に公開。Threads発→韓国コミュニティ/X/カカオトーク→日本では10月13日頃からXで「#80億分の1」として爆発し、堀江貴文・堀井雄二・伊集院光らの言及で拡大、10日足らずで追随作品が多数登場した。「80億分の1」という名前の"レア度診断"（例: あなたは80億人中1人の〇〇）は見つからなかった。

### Cited Findings
**正体・開発者・公開日**
- 韓国の個人開発者が公開した、172カ国の統計に基づきランダムに生まれて人生を疑似体験する無料ブラウザシミュレーター。運営名義はカナダの住所 — [coki](https://coki.jp/article/column/95340/)
- 開発者は仮名「Jin Hwi-eus（진휘어스）」。国民日報（韓国）の取材に個人情報非公開を条件に応じた。公開は10月5日 — [AUTOMATON](https://automaton-media.com/articles/newsjp/20261013-473180/), [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- 運営名「Jin's Earth」、住所はカナダ・オンタリオ州。「ひとりでつくり、毎日直している」 — [coki](https://coki.jp/article/column/95340/)
- 公式サイトは、AI（AnthropicのClaude）と一緒に作ったと説明。Claudeがコードとイベント文を書き、運営者が内容を決めた。最初の指示から公開まで約4時間 — [aquallc（公式サイト記述を引用）](https://www.aquallc.jp/one-in-8-billion-claude/), [ASCII/Yahoo!ニュース](https://news.yahoo.co.jp/articles/970729d80a39b101a1ec819073ed96e53a13c3ac)
- 経緯: 公開するつもりはなかったが、制作過程をThreadsに投稿したところ、コメントでテストリンクを求められ、その日のうちにドメインを買って公開した — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- 公開日の食い違い: 日本・韓国の主要報道は10月5日。韓国の別まとめ（재경일보系の要約）は「2026年10月7日公開」としている — [재경일보](https://news.jkn.co.kr/post/1016843)（10/5説が多数派）

**仕組み（入力→結果）**
- 選べるのは世界（過去／現在／未来／どの世界でも）、生まれ方（「今生まれる赤ちゃん」＝年間出生数ベース、または「今生きている80億人」＝人口比ベース）、人生の長さ（再生速度）。国・親・家計は選べない — [AUTOMATON](https://automaton-media.com/articles/newsjp/20261013-473180/)
- 進路、重い病気、結婚、出産などは選べる。小さな選択（ペットをねだる、お金がなくても治療を受けるか等）もある。健康・幸福・知識・人間関係の4指標が変動する — [AUTOMATON](https://automaton-media.com/articles/newsjp/20261013-473180/)
- 同じ瞬間に生まれた4人の人生が並行して進み、比べられる — [ASCII/Yahoo!ニュース](https://news.yahoo.co.jp/articles/970729d80a39b101a1ec819073ed96e53a13c3ac)
- 1回のプレイは約30〜90分（その国の平均寿命まで） — [coki](https://coki.jp/article/column/95340/), [公式サイト](https://1in8b.life/ja/)
- 5・15・30・50・70歳で実際の他プレイヤーの人生と比べ、感想を書く時間がある。最大16倍速 — [재경일보](https://news.jkn.co.kr/post/1016843)
- 公式ページには、ライフマップ、出生年別の生存曲線、同じ秒に生まれた他プレイヤーとの比較、「先生モード」（投稿・決済オフ）がある。v0.8.16 beta、15歳以上向け — [公式サイト](https://1in8b.life/ja/)
- 対応国数は141カ国（国民日報取材時、J-CAST）→172カ国（公式・後続報道）に拡大 — [J-CAST](https://www.j-cast.com/2026/10/14518461.html?p=all), [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- 対応言語は「9言語」との記述と、公式サイトの13言語リンク（日・英・韓・繁中・簡中・越・仏・タイ・西・独・葡・露・トルコ）がある。時期差の可能性 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/); [公式サイト](https://1in8b.life/ja/)
- 設計方針: 生まれる国は選べない。スコアやランキングはない。当初、暴力や子どもの死は現実の頻度で入れ、自殺は除外 — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- v0.6.36 beta（10月11日）で、自殺が統計通り発生するよう実装された（選択肢としては出ない）。発生時は「いのちSOS」等の相談先を表示。開発者はXの返信を受けて、含めないと「そうした人生を除外してしまう」と考え方を変えた — [AUTOMATON](https://automaton-media.com/articles/newsjp/20261014-473477/)

**共有の設計**
- 一生を終えると結果カードが出る（一言コメント可）。X／Threadsへのシェア、画像保存、テキストとリンクのコピーに対応 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- 公式ページには、共有用の「誕生カード」、終わった人生のシェアカード、直近10件の記録とカードを開ける「もう一度見る」、ろうそくを灯してメッセージを残せる追悼（メモリアル）機能がある — [公式サイト](https://1in8b.life/ja/), [coki](https://coki.jp/article/column/95340/)
- X上の投稿は「〇〇（国）に生まれて〇歳まで生きた」という型。毎回違うため拡散しやすい — [リアルサウンド/Yahoo!ニュース](https://news.yahoo.co.jp/articles/5199bab7af536c39c753a6d21546753825bc4266)
- 配信・動画化は公式に許可されている（視聴者参加型を促す） — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)

**拡散経路とプラットフォーム**
- 韓国: Threadsにだけ投稿 → オンラインコミュニティ、X、カカオトークへ拡散 — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- 10月7日には、1日の訪問数が前日のほぼ7倍に。「ベータのリンク1つが4日でここまで広がるとは思わなかった」 — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- 韓国ではハングルの日の連休（10月9日前後）に有名ストリーマーが配信（Chzzk）。視聴者と選択肢を選ぶ形式 — [게임플](https://www.gameple.co.kr/news/articleView.html?idxno=216666), [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- 国民日報の報道は10月10日。日本では10月13日頃からXで拡散 — [ASCII/Yahoo!ニュース](https://news.yahoo.co.jp/articles/970729d80a39b101a1ec819073ed96e53a13c3ac)
- 10月13日、堀江貴文氏がXで「すごいサイト」と紹介（インドの農家の女性に生まれ73歳でCOPDで死亡した自分の結果を添付）。八代市長・小野泰輔氏が引用（ブラジルの中流家庭に生まれた結果）し、「日本に生まれることもたまたまとも言えるし、逆に奇跡と言えるかもしれません」 — [J-CAST](https://www.j-cast.com/2026/10/14518461.html?p=all)
- 10月15日に堀江氏がYouTubeで取り上げ、10月16日に堀井雄二氏がXに結果を投稿 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/), [Game*Spark](https://www.gamespark.jp/article/2026/10/19/173793.html)
- 伊集院光がTBSラジオ「深夜の馬鹿力」（10月19日深夜）で、ゲームマーケット会場の待機列で「徹夜でやった」と話す人を見て知り、2回プレイして2回ともインド生まれだったと話した。「必勝法もなければ勝ち負けもなくて」 — [Sirabee](https://sirabee.com/2026/10/21/20163592554/)
- 主な共有先はX — [リアルサウンド/Yahoo!ニュース](https://news.yahoo.co.jp/articles/5199bab7af536c39c753a6d21546753825bc4266)

**規模（報告値。独立検証なし）**
- 執筆時点で公式サイトで8万4千人超が同時プレイ中、公開から約10日で同時接続8万人超。体験談の投稿は数百万ビュー超 — [coki](https://coki.jp/article/column/95340/)
- 国民日報の取材時点で、始めた人生の約58%が最後まで遊ばれていた — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- 総プレイ数、ユニークユーザー数、ハッシュタグ投稿数、TikTok再生数は、どの記事にもなかった — [J-CAST](https://www.j-cast.com/2026/10/14518461.html?p=all), [AUTOMATON](https://automaton-media.com/articles/newsjp/20261013-473180/)

**収益化**
- 無料。ログイン不要、広告なし。唯一の有料要素は「思い出パス」（480円の買い切り、終えた人生をデジタルの記念品にする、30日以内返金可）。ゲーム内販売はゼロと公式が記載 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- 国民日報は収益化に触れていない。公式ページのキャプチャにも思い出パスの記載がなかった（時期差の可能性） — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369), [公式サイト](https://1in8b.life/ja/)

**なぜ広がったか（各メディアの分析）**
- 統計を1年ずつ生きることで数字が自分ごとになる／毎回違う人生でリプレイが起きる／カードで共有しやすい／無料・ログイン不要・広告なしで敷居が低い／著名人の投稿／配信許可 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- 開発者の意図: 「“児童死亡率3％”といった数字が自分の子どもにも起こり得る現実として実感できるようになる」 — [AUTOMATON](https://automaton-media.com/articles/newsjp/20261013-473180/)
- 人生ゲームとの比較: 人生ゲームは資産最多の人が勝つが、80億分の1には明確なゴールも勝者もなく、幼くして病死することもある。日本人には子どもの頃から「人生をゲームにする」習慣がある — [リアルサウンド/Yahoo!ニュース](https://news.yahoo.co.jp/articles/5199bab7af536c39c753a6d21546753825bc4266)
- ユーザーの声: 「死んだときに泣いてしまった」「幸せってなんだろうと考えさせられる」 — [ASCII/Yahoo!ニュース](https://news.yahoo.co.jp/articles/970729d80a39b101a1ec819073ed96e53a13c3ac)。韓国では「韓国に生まれたのは祝福だ」という感想が多い — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)
- 生成AIで非開発者でも作って共有できる／ランダムな結末が語れる物語になる／配信と相性が良い／ファン文化（好きな世界観で別の人生を生きる） — [게임플](https://www.gameple.co.kr/news/articleView.html?idxno=216666)

**派生・模倣（公開から10日以内に多数）**
- 『1.2億分の1』（https://1in120m.uxwxu.com/）: 日本版。都道府県別の出生統計で生まれる場所が決まる。1920〜2050年の時代、約10分〜1時間のプレイ長を選べる。「図鑑をシェアする」機能がある。本家とは無関係の個人制作 — [Game*Spark](https://www.gamespark.jp/article/2026/10/19/173793.html), [1.2億分の1公式](https://1in120m.uxwxu.com/)。10月14日公開 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- 『5万人のゲームクリエイター人生』（https://game-creator-life.mucky-totoro.workers.dev/）: 時代ごとにUIが変わり、初代PlayStation発売など業界史が学べる — [Game*Spark](https://www.gamespark.jp/article/2026/10/19/173793.html)
- 『人間に生まれる確率』（https://yoshitakeapp.com/games/next-life-gacha/）: 地球上の全動物種からランダムに生まれる。人間は約1011億分の1、線虫が約86%。哺乳類モードでは人間は16分の1 — [Game*Spark](https://www.gamespark.jp/article/2026/10/19/173793.html)
- 韓国の派生: 『랜덤입사게임』（会社員約2200万人の一人として働く）、『벤치에서 발롱까지』（サッカー選手人生）、『도시의 한 사람으로 태어나』（Project Moonのファンゲーム、10日公開。反響で有料サーバーに移行）、『도시 2033』 — [게임플](https://www.gameple.co.kr/news/articleView.html?idxno=216666)

### Inferences
- 「80億分の1」は"レア度診断"ではなく"確率ガチャ×物語"型。共有されるのは「自分は〇〇に生まれて〇歳で死んだ」という固有の物語で、他人と被らない結果（=80億分の1）が投稿動機になっている。"レア度"をタイトル（数字）で表現し、中身は統計に裏付けられたランダム生成という構造。
- 拡散順はThreads（開発者のビルド公開）→韓国コミュニティ・配信→日本のX（著名人の引用）→YouTube・ラジオ。少なくとも報道上、TikTok／Instagramは主戦場ではなかった。プレイが30〜90分と長く、静止カードで共有する設計だからと推測される。
- 公開からわずか数日でのAI製の模倣作（1.2億分の1は9日後）は、「AIで数時間で作れる」形式は堀がない、ということを示す。差別化は、データの信頼性、運営による毎日の改善、倫理的な設計判断（自殺エンドなど）、共有カードの完成度で起きている。
- 正確な影響力の比較材料は、同時接続8万超（coki）と完走率58%（国民日報）くらいしかない。コアな没入体験としては異例の高さと見られる。

### Gaps
- 公式の累計プレイ数・UU・国別比率、「#80億分の1」の投稿数、TikTok／Instagramでの再生数・投稿数は、どの一次情報にもなかった。同時接続8万4千人はcokiの記述のみで裏付けがない。
- 思い出パス（480円）の売上や導入日は不明（aquallcのみの記述）。
- 開発者の実際の国籍・居住地（韓国出身／カナダ住所）は報道間で表現が揺れている。
- TikTokのdiscoverページ（#80億分の1）は取得できず、TikTokでの画面録画投稿の規模は未確認。
- 「80億分の1」を冠したレア度・パーセンタイル型の診断サービス（類似名の別物）は、検索した範囲では見つからなかった。

## Q2. 2025〜2026年に日本でバズった、その他のWeb診断／ジェネレーター／ツール（実在確認と全体像）

### Takeaway
2025〜2026年の日本でトレンド調査にまで名前が出た「診断」は、事実上LoveType16（ラブタイプ診断）だけ（digdig 2025下半期・モノ部門1位）。ほかはAI画像生成の"お題"系（ジブリ風、Nano Bananaのフィギュア化、カリカチュア、チャッピー自撮り）が最大級の波だった。一方、Makko診断ポータルの上位診断や匿名の性格診断サイト（ピーク月1,900万PV）のように、ランキングには載らなくても桁の大きいPVを出す"ロングテール診断"も厚い。高校生・Z世代のトレンド調査（Simeji、αZ総研、渋谷トレンドリサーチ）には診断・Webツールがほとんど出てこない。

### Cited Findings
**トレンド調査での扱い（何が「流行」として認知されたか）**
- digdig「Z世代・α世代が選ぶ2025下半期トレンドランキング」（Instagram投票、2025年11月11〜12日、有効回答38,180）: 「バズったモノ」1位はLoveType 16。2位が麻辣湯、3位がドバイチョコ。アプリ部門は1位ChatGPT、2位Meitu、3位BeReal。コメントは「診断コンテンツは引き続き人気、AIツールの日常化」 — [PR TIMES（digdig）](https://prtimes.jp/main/html/rd/p/000000033.000120535.html)
- TikTokトレンド大賞2025: 大賞は『呪術廻戦』。ホットワード部門は「平成リバイバル」、ハッシュタグ部門は「大人の学び直し」 — [モデルプレス/Yahoo!ニュース](https://news.yahoo.co.jp/articles/ceaebc6e9e6e83aa0486ff1a64c59fb271726c01)
- Simeji 2026年上半期トレンドランキング（2026年6月3〜7日、6,664人、0〜29歳）: 診断・ジェネレーター・Webツールは載っていない。モノ部門には「平成女児シール帳・シール交換」が4位、言葉部門には「チャッピー構文」がある — [PR TIMES（Simeji）](https://prtimes.jp/main/html/rd/p/000000970.000006410.html)
- αZ総研 2026年上半期（239名）: 診断・Webツールは載っていない。言葉では「〇〇すぎて滅」など"自分の言葉を入れて投稿できる型"が多いと解説。ChatGPTを真似たネタ動画「それめっちゃ正解」が流行 — [PR TIMES（αZ総研）](https://prtimes.jp/main/html/rd/p/000000116.000020799.html)
- 渋谷トレンドリサーチ（高校生200人）2026年夏号・秋号: 診断・占い・AIアプリ・ジェネレーターは0件。SNS系では2秒動画日記アプリ「setlog」が秋号で物事部門1位（33.9%） — [夏号](https://shibuya-trendresearch.jp/monthlytrendsurvey/4480/), [秋号](https://shibuya-trendresearch.jp/monthlytrendsurvey/4622/)
- WEGOスタッフ調査（2026年上半期ネクスト予想）に「MBTIより恋愛診断みたいなのが流行っている」という声。TikTokでは「MBTIの次に流行る」系の投稿として、キャラクターコード診断や「わたしのトリセツ診断」が紹介されている（TikTokページ断片） — [WEGO](https://labo.wego.jp/firsthalfof2026-nexttrend/), [TikTok discover](https://www.tiktok.com/discover/mbti%E8%A8%BA%E6%96%AD%E3%81%AE%E6%AC%A1%E3%81%AB%E6%B5%81%E8%A1%8C%E3%82%8B)

**実在確認できたバズ事例（2025〜2026）**（詳細はQ3）
1. 80億分の1（2026年10月、人生シミュ）— Q1参照
2. LoveType16／ラブタイプ診断（恋愛16タイプ、2024〜2026年に継続ヒット）— [PR TIMES（ラブキャラ）](https://prtimes.jp/main/html/rd/p/000000034.000172366.html)
3. モテタイプ診断16（ラブキャラ×ABEMA、2026年2月）— [PR TIMES](https://prtimes.jp/main/html/rd/p/000000022.000172366.html)
4. キャラクターコード診断（韓国発、顔写真＋質問、2025年夏）— [istep](https://istep.click/news_blog/4707)
5. Makko診断ポータル上位（サイコパス診断ほか、2026年上半期）— [STRAIGHT PRESS](https://straightpress.jp/company_news/detail?pr=000000021.000143217)
6. 匿名の性格診断サイト（2026年2月公開、ピーク月1,900万PV、売却案件）— [ラッコM&A](https://rakkoma.com/project/detail/23364)
7. 自己肯定感診断（2026年6月、ペアトレカ）— [Trepo](https://trepo.jp/life-style/338957/)
8. ChatGPT「ジブリ風」画像（2025年3月）— [coki](https://coki.jp/article/column/50447/)
9. Nano Banana（Gemini 2.5 Flash Image）による「フィギュア化」（2025年9月）— [WEEL](https://weel.co.jp/media/innovator/nanobanana-figure/)
10. ChatGPTカリカチュア（2026年初頭、主に海外）— [bloomeria](https://bloomeria.jp/blog/chatgpt-caricature-trend-guide), [Free Press Journal](https://www.freepressjournal.in/amp/tech/chatgpt-caricature-trend-goes-viral-on-social-media-heres-how-to-create-your-own-ai-portrait)
11. 「チャッピー自撮り」（2026年5月、ChatGPTに自分の姿を描かせる）— [hashout](https://hashout.jp/?p=1411)
12. Spotifyまとめ（Wrapped）2025 — [GIZMODO](https://www.gizmodo.jp/2026/02/spotify_mau_7-5.html)
13. 80億分の1の派生群（1.2億分の1など、2026年10月）— Q1参照

**先行事例（2023〜2024）**
- EPIK「AIイヤーブック（卒アル風）」（2023年秋）: 日本では9月29日のタレントMattのInstagram投稿が火付け役。運営元SNOWによると、公開後に利用が30倍に — [ORICON](https://www.oricon.co.jp/special/72662/), [Korea Times](https://www.koreatimes.co.kr/lifestyle/trends/20231006/epiks-ai-yearbook-feature-goes-viral-takes-users-back-to-90s)
- 16タイプ（MBTI系）診断: K-POPアイドルが自分のタイプを公表したことで、中高生の間で大流行したと書籍の紹介文にある — [検索結果（書籍紹介）](https://www.audible.com/pd/16-Audiobook/B0F6YRLHMJ)。2023年頃からZ世代中心に定番化したとする解説もある — [WEGO](https://labo.wego.jp/mbti-16personalities-lovetype16/)
- ラブタイプ診断は2024年時点で「累計200万人以上」との記述がある（出典不明のまとめ記事、信頼度低） — [jbc-ltd](https://www.jbc-ltd.com/column/2025/11/28/lovetype16/)

**未確認・見つからなかった候補**
- 前世診断、脳内メーカー型の復活、平成女児ジェネレーター、名前・誕生日系、LINEやInstagramのデータを使うツール: 2025〜2026年に日本で「バズった」と報じた一次情報は見つからなかった（平成女児はグッズ・シールの流行として報道されている — [MarkeZine](https://markezine.jp/article/detail/50371)）。
- AI顔診断（動物顔・骨格など）: 顔診断アプリFaceCheckerが「TikTok・Instagram・YouTubeで話題」と自称しているのみで、報道は見つからなかった — [App Store](https://apps.apple.com/jp/app/%E9%A1%94%E3%82%B9%E3%82%B3%E3%82%A2-ai%E9%A1%94%E8%A8%BA%E6%96%AD-%E4%BC%BC%E3%81%A6%E3%82%8B%E8%8A%B8%E8%83%BD%E4%BA%BA-facechecker/id1487951129)
- ねとらぼ: 2025年7月、「診断しませんか？」という案内のX投稿が、意外な対象で700万表示・10万いいね超になった記事がある（検索スニペットのみ。対象の詳細は未確認） — [ねとらぼ](https://nlab.itmedia.co.jp/cont/articles/3454324/2/)

### Inferences
- トレンド調査への出方は、「診断というジャンル」が日常的なインフラになったことを示す。個別の診断が"流行物"として名前を残すには、LoveType16のように「キャラIP化＋継続運用＋グッズ・コラボ」が必要と見られる。
- 2025〜2026年の最大級の波（ジブリ風、フィギュア化、カリカチュア、チャッピー自撮り）は、どれも「汎用AIへのプロンプト＝お題」が流行の単位で、専用Webサイトを要しなかった。Web診断の作り手から見ると、AI画像トレンドは「競合」でもあり、「結果画像をAIで個別生成する」という手段のヒントでもある。
- 2026年10月の80億分の1は、「性格分類」ではなく「確率×シミュレーション×物語」が新しい勝ち筋として立ち上がった事例。派生作品が即日出る状況から見て、少なくとも2026年秋時点の"今"のフォーマットはこれと推測される。

### Gaps
- TikTok Japan「上半期トレンド大賞2026」の内容は今回確認できなかった。
- マイナビティーンズラボ、SHIBUYA109 lab.の2025〜2026年調査に診断系が載っているかは未確認。
- 推し活系診断、動物・キャラ診断（ディズニー系など）は、TikTokでの投稿の存在は見えた — [TikTok discover](https://www.tiktok.com/discover/%E6%81%8B%E6%84%9B-%E3%82%AD%E3%83%A3%E3%83%A9-%E8%A8%BA%E6%96%AD?lang=ja-JP) — が、具体的なサービス名や規模は特定できなかった。
- ChatGPTジブリ風の「2025年3月にChatGPTが4,600万DL（App Store 1,300万＋Google Play 3,300万）」という数字は、検索要約に出ただけで出典ページを確認できていない（未検証）。

## Q3. 事例別の詳細（公開日・作り手・仕組み・共有設計・プラットフォーム・規模・寿命・収益化）

### Takeaway
規模・持続性・収益化の面で最も参考になるのは、(a) LoveType16（累計1億回診断・5,000万UU、16キャラのIP化でプライズ・カフェ・書籍・AIチャットに展開）、(b) 匿名の性格診断サイト（公開4カ月目で月1,900万PV、月200万円弱のAdSense収入、その後4カ月で約98%減（10月見込み約40万PV）の典型的なスパイク型）、(c) 80億分の1（AI製・広告なし・480円の思い出パスのみ）の3つ。

### Cited Findings
**A. LoveType16／ラブタイプ診断（株式会社ラブキャラ）**
- 運営: 株式会社ラブキャラ（代表 平山英司、資本金500万円、2025年10月設立、渋谷区） — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000034.000172366.html)
- 仕組み: 無料、恋愛タイプを16キャラに分類。ボス猫、隠れベイビー、主役体質、ツンデレヤンキー、憧れの先輩、カリスマバランサー、パーフェクトカメレオン、キャプテンライオン、ロマンスマジシャン、ちゃっかりうさぎ、恋愛モンスター、忠犬ハチ公、不思議生命体、敏腕マネージャー、デビル天使、最後の恋人。友人や恋人と結果を見せ合う使われ方 — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000034.000172366.html)。公式サイトは16／64タイプに対応 — [lovecharacter64.jp](https://lovecharacter64.jp/)
- 規模: 累計診断1億回、累計5,000万UU、公式LINE 50万人、台湾版600万UU、韓国版150万UU（いずれも自社発表） — [ASCII（PR）](https://ascii.jp/elem/000/004/424/4424265/), [inside-games（PR）](https://www.inside-games.jp/release/prtimes/20260808/301114.html)
- SNSでの使われ方: 恋愛観や推しアイドルとの相性を語る材料として結果がSNSに共有された — [PR TIMES（digdig）](https://prtimes.jp/main/html/rd/p/000000033.000120535.html)
- タイプ別の比率は公式に公表されておらず、SNSの「多い順ランキング」は非公式 — [yagish](https://portal.yagish.jp/know-how/lovetype-list/)
- 収益化・IP展開:
  - LINEで24時間相談できる恋愛AI「ラブチャッピー」（2026年8月1日開始、初日に4万ユーザー） — [ASCII（PR）](https://ascii.jp/elem/000/004/424/4424265/)
  - 講談社「夏電書2026」と「#私のラブマンガ診断」フェア（2026年8月） — [inside-games](https://www.inside-games.jp/release/prtimes/20260808/301114.html)
  - ナムコ限定プライズのぬいぐるみ16種（2026年9月26日〜、バンダイナムコアミューズメントと） — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000034.000172366.html)
  - SHIBUYA109コラボカフェ（10月23日〜11月2日）、ポップアップ（10月28日〜11月3日）、集英社から書籍（10月26日） — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000034.000172366.html)
- 寿命: 2024年時点で「累計200万人」という記述（信頼度低） — [jbc-ltd](https://www.jbc-ltd.com/column/2025/11/28/lovetype16/)。2025年下半期のトレンド1位 — [digdig](https://prtimes.jp/main/html/rd/p/000000033.000120535.html)。2026年秋も継続展開中。数年単位で持続する型。
- 公開年・創作者・ラブキャラ設立（2025年10月）以前の運営体制は確認できなかった。「韓国発」と書くまとめ記事もあれば、digdigは「日本発」と記述しており、食い違いがある — [lifestyle.assist-all](https://lifestyle.assist-all.co.jp/?p=71701); [digdig](https://prtimes.jp/main/html/rd/p/000000033.000120535.html)

**B. モテタイプ診断16（ラブキャラ×ABEMA）**
- 2026年2月5日公開。恋愛が始まる前の「最初の一手」で16タイプに分類。ABEMAの恋愛リアリティ番組『ラブパワーキングダム2』と公式コラボで、出演者16人の診断結果を公開。結果はシェア用カードで出て、出演者とタイプを照合できる。300万PV超、アクティブユーザー130万人超（「公開から約2カ月」） — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000022.000172366.html)

**C. キャラクターコード診断（Character Code, https://charactercode.ai/ja/）**
- 韓国発。正面の顔写真（横顔は任意）＋性格・話し方の20〜30問＋性別を入力すると、「NIMT」のような4文字コードで16タイプ（4軸）に分類。おすすめのメイク・ファッションも出る。2025年夏にTikTokとXで流行。YouTubeに約1時間の解説動画も。友人と比べやすい点が人気の理由 — [istep](https://istep.click/news_blog/4707)（二次情報のブログ。数値なし）

**D. Makko診断ポータル 2026年上半期ランキング（株式会社ギミックプラス、ユーザー投稿型の診断プラットフォーム）**
- 1位【サイコパス診断】約203万表示／約96万人、2位 SM診断 約124万／約70万、3位【精神年齢診断】約116万／約65万、4位 スケベ診断 約91万／約56万、5位 モテ度診断 約85万／約47万、6位 メンヘラ診断 約80万／約49万、7位【陰キャ陽キャ診断】約79万／約48万、8位 シン・サイコパス診断 約70万／約37万、9位 何デレ診断 約68万／約40万、10位 好きなタイプ診断 約66万／約45万。作成者は「にぎやかしぃ」「船長」「HARU」 — [STRAIGHT PRESS](https://straightpress.jp/company_news/detail?pr=000000021.000143217)
- 運営による分析: 普段は確かめにくい内面（サイコパス・精神年齢・メンヘラ）、比べて楽しむ（SM・モテ度・好きなタイプ）、少し刺激のあるテーマが上位。同じテーマでも切り口を変えると（シン・サイコパス）別の体験として成立する — [STRAIGHT PRESS](https://straightpress.jp/company_news/detail?pr=000000021.000143217)

**E. 匿名の性格診断サイト（ラッコM&Aの売却案件、2026年10月21日掲載）**
- 2026年2月公開。質問に答えてタイプを判定し、タイプごとにオリジナルキャラと解説。2人の結果を組み合わせる相性診断、韓国語版あり。利用者は10〜20代女性が中心。診断結果のスクショをSNSに投稿する口コミが主な流入元 — [ラッコM&A](https://rakkoma.com/project/detail/23364)
- 規模: 診断完了累計400万回以上。ピークは6月の月1,900万PV（1日200万PV）、9月85万PV、10月は約40万PV見込み — [ラッコM&A](https://rakkoma.com/project/detail/23364)
- 収益: 広告のみで5月12.9万円（i-mobile）、6月198.9万円、7月149.1万円、8月54.4万円、9月58.4万円（AdSense）。5〜9月合計473.7万円。希望売却価格1,280万円（税込） — [ラッコM&A](https://rakkoma.com/project/detail/23364)
- コストと技術: Next.js、Vercel、Supabase、OpenAI API、Cloudflare Workers／R2、microCMS。ピーク月のインフラ費は約7万円。開発ツールにClaude Code（月1.6〜3.7万円） — [ラッコM&A](https://rakkoma.com/project/detail/23364)

**F. 自己肯定感診断（https://type.love-yourself.jp/）**
- 2026年6月1日19時公開。精神科医が監修し、美容外科医の写真集『Love Yourself』プロジェクトから生まれた。20問で16キャラ（「ぴえんぴえんアイドル」「チー牛エリート」「こじらせ顔面国宝」「シゴデキ平成ギャル」など）。「ペアトレカ」は自分と相手のタイプと名前を入れると、相性スコア・ペア名・一言が入ったトレカ風カードを作る。相性ランキングとSNSシェアもある。規模の数値はない — [Trepo](https://trepo.jp/life-style/338957/)

**G. ふたりのトリセツ（16タイプの相性診断）**
- 2026年1〜8月で診断ログ1万4,000件超、ユニーク6,245人。最も多いタイプはENFPで、相性確認の用途が中心（小規模な参考値） — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000007.000175516.html)

**H. AI画像生成のお題系**
- ChatGPTジブリ風: 2025年3月26日に新しい画像生成機能が公開され、「ジブリ風」がSNSで急拡散。サム・アルトマンがプロフィール画像をジブリ風に、ホワイトハウスもジブリ調の画像を投稿。宮崎駿の2016年の発言や著作権をめぐる批判も起きた — [coki](https://coki.jp/article/column/50447/)
- Nano Bananaフィギュア化: 「Gemini 2.5 Flash Image」は2025年8月27日リリース。2025年9月にプロンプトの共有をきっかけに、写真1枚を台座付きの3Dフィギュア風にする投稿がブームに。Google Japanも9月16日に投稿。実在の玩具メーカーが注意喚起したとの報道もある — [WEEL](https://weel.co.jp/media/innovator/nanobanana-figure/)
- ChatGPTカリカチュア: 2026年初頭（2月）にInstagram・TikTok・Facebookで広がり、「2026年最初の大きなAIトレンド」と報道。日本での規模データはない — [Free Press Journal](https://www.freepressjournal.in/amp/tech/chatgpt-caricature-trend-goes-viral-on-social-media-heres-how-to-create-your-own-ai-portrait), [bloomeria](https://bloomeria.jp/blog/chatgpt-caricature-trend-guide)
- チャッピー自撮り: 2026年5月初旬、「あなたの姿を想像して自撮り風の画像を送って」と頼む遊びがXで流行。予想外の黄色い猫の画像が返ってきた投稿が6万いいね超。5月24日のテレビ特集で再燃。会話履歴によって人ごとに結果が違うのが肝。数万件の投稿、数千万インプレッション。関連記事の見出しには「2648万表示」 — [hashout](https://hashout.jp/?p=1411)
- Sora 2（2025年10月）: 招待制で日本も対象。「カメオ」で自分や友人を動画に登場させられる — [GameBusiness.jp](https://www.gamebusiness.jp/article/2025/10/01/25164.html)。日本での流行規模を示すデータはない。後にサービス終了と報じられたとの記述もある（未検証） — [検索結果ai-market](https://ai-market.jp/services/sora-application/)

**I. Spotifyまとめ（Wrapped）2025**
- 「史上最大規模」で、3億人以上が参加し、56言語で6億3,000万回のSNSシェア（全世界の数字） — [GIZMODO](https://www.gizmodo.jp/2026/02/spotify_mau_7-5.html)

**J. 先行事例: EPIK AIイヤーブック（2023年）**
- 自撮り8〜12枚から最大60枚を生成する有料機能（日本報道では500円／800円）。9月29日のMattの投稿の後、ゆきぽよ、木下優樹菜らも投稿。推しの写真で作るファンも。利用回数30倍。顔の不自然さや無断コラージュへの指摘も — [ORICON](https://www.oricon.co.jp/special/72662/), [Korea Times](https://www.koreatimes.co.kr/lifestyle/trends/20231006/epiks-ai-yearbook-feature-goes-viral-takes-users-back-to-90s), [NBC](https://www.nbcsandiego.com/news/business/money-report/everybodys-posting-ai-generated-yearbook-pictures-with-this-new-viral-app/3321448/?amp=1)

### Inferences
- 寿命の典型: 匿名の性格診断サイトは、ピーク（6月1,900万PV）から4カ月で約40万PVへ、約98%減。単発型の診断の寿命は「1〜2カ月のピーク＋長い尾」と見るのが妥当。持続させているのはLoveType16のように、①キャラIP、②派生診断（モテタイプ・64タイプ・海外版）、③メディアコラボ（ABEMA、講談社）、④物販・リアルイベント、⑤LINEの会員基盤で回遊させるもの。
- 広告収益の目安: 月1,900万PVで月200万円弱（AdSense）。おおよそRPM 100円/1,000PV前後と推定される（月によるブレ大）。バズ1回の広告収入は数百万円規模に留まり、事業として大きくするにはIP化・物販・送客が必要。
- 結果の設計は2種類に集約される: (1) 16タイプ×キャラ名（LoveType、キャラクターコード、自己肯定感、匿名サイト）、(2) パーセント／スコア（Makkoの「〇〇度は何%」）。80億分の1は (3) 毎回違う固有の物語、という第3の型。

### Gaps
- LoveType16の初公開日、原作者、2025年10月以前の運営体制（譲渡か新設か）は確認できなかった。
- 匿名の性格診断サイトのサービス名は伏せられている。
- キャラクターコード診断の運営主体と利用者数は確認できなかった。
- AI画像お題系の、日本に限ったハッシュタグ投稿数・関連DL数は未確認。

## Q4. 大ヒットに共通するパターン

### Takeaway
共通項は、①結果が「自分だけのもの」に感じられる（タイプ×キャラ／%スコア／ランダムな人生物語／AIの個別生成）、②1画像で文脈が伝わる共有カード、③他者と比べる・2人の相性という"会話のきっかけ"、④無料・ログインなし・スマホで数分（80億分の1は例外的に長いが倍速で調整）、⑤著名人・番組・配信による"引用"の連鎖、⑥少し刺激的または感情に刺さるテーマ。2026年はさらに「AIで数時間で作れる→数日で模倣が出る」ため、速さと運営で勝負する時代になっている。

### Cited Findings
- 固有の結果がリプレイと投稿を生む: 80億分の1は毎回違う結果で、それが更なるプレイの動機になる — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)。「〇〇に生まれて〇歳まで生きた」形式の投稿が広がる — [リアルサウンド](https://news.yahoo.co.jp/articles/5199bab7af536c39c753a6d21546753825bc4266)
- AIの個別化が「自分だけの結果」を作る: チャッピー自撮りは会話履歴で人ごとに結果が変わる — [hashout](https://hashout.jp/?p=1411)
- 比較・相性: LoveType16は推しや恋人との相性で語られる — [digdig](https://prtimes.jp/main/html/rd/p/000000033.000120535.html)。自己肯定感診断はペアトレカ — [Trepo](https://trepo.jp/life-style/338957/)。匿名サイトは2人の相性診断を持つ — [ラッコM&A](https://rakkoma.com/project/detail/23364)。80億分の1は「同じ秒に生まれた4人」と比べる — [ASCII](https://news.yahoo.co.jp/articles/970729d80a39b101a1ec819073ed96e53a13c3ac)。キャラクターコードは友人同士で比較 — [istep](https://istep.click/news_blog/4707)
- 刺激的・内面的なテーマ: Makko上位はサイコパス、SM、精神年齢、スケベ、メンヘラ — [STRAIGHT PRESS](https://straightpress.jp/company_news/detail?pr=000000021.000143217)
- 敷居の低さ: 無料・ログイン不要・広告なし — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)。インストール不要でブラウザで動く — [게임플](https://www.gameple.co.kr/news/articleView.html?idxno=216666)
- 著名人・メディアの引用: 堀江貴文、八代市長 — [J-CAST](https://www.j-cast.com/2026/10/14518461.html?p=all)。伊集院光 — [Sirabee](https://sirabee.com/2026/10/21/20163592554/)。ABEMA出演者の結果公開 — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000022.000172366.html)。EPIKはMatt — [ORICON](https://www.oricon.co.jp/special/72662/)。ジブリ風はサム・アルトマンやホワイトハウス — [coki](https://coki.jp/article/column/50447/)
- 配信との相性: 韓国では配信者が視聴者と選択肢を選んだ — [게임플](https://www.gameple.co.kr/news/articleView.html?idxno=216666)。公式が配信・動画化を許可 — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)
- AIで速く作れる→即座に模倣される: 本家は約4時間 — [国民日報](https://www.kmib.co.kr/article/view.asp?arcid=9000021369)。1.2億分の1は9日後（10月14日） — [aquallc](https://www.aquallc.jp/one-in-8-billion-claude/)。匿名の診断サイトもClaude Code製 — [ラッコM&A](https://rakkoma.com/project/detail/23364)
- X側の仕組み: 全員が同じ文面で投稿するとスパム扱いされ、検索に出にくくなる事例があり、投稿者ごとに違う言葉を添えることが推奨されている — [Unique Vision](https://www.uniquevision.co.jp/beluga-portal/solution/solution-x-trend202603/)
- 「自分の言葉を入れて投稿できる型」がZ世代の流行語で目立つ（〇〇すぎて滅など） — [αZ総研](https://prtimes.jp/main/html/rd/p/000000116.000020799.html)
- 平成ノスタルジー: TikTokトレンド大賞2025のホットワードは「平成リバイバル」 — [モデルプレス](https://news.yahoo.co.jp/articles/ceaebc6e9e6e83aa0486ff1a64c59fb271726c01)。Simeji 2026年上半期に「平成女児シール帳」 — [Simeji](https://prtimes.jp/main/html/rd/p/000000970.000006410.html)。自己肯定感診断のキャラ名にも「シゴデキ平成ギャル」 — [Trepo](https://trepo.jp/life-style/338957/)

### Inferences
- 結果カードには、毎回違うテキスト（国名・年齢・タイプ名・%）を入れ、テンプレ固定文を避けるとよい。Xのスパム判定を避けつつ、"自分の言葉"として投稿される（Unique Visionの指摘、αZ総研の「自分の言葉を入れる型」と整合）。
- 「80億分の1」型の"レア度"は、タイトルの数字で約束し、中身は統計や確率で裏付ける。単に「あなたは上位3%」と言うより、「なぜそうなったか」の物語が付くと泣ける／語れる投稿になる。
- 2人の相性（ペアカード、推しとの相性、同じ秒に生まれた他人との比較）は、ほぼすべてのヒットに入っている。DMやリプで相手を巻き込む＝拡散係数を上げる装置と考えられる。
- 単発のバズは1〜2カ月で減衰する前提で、ピークの間にLINE登録、派生診断、物販などの受け皿を用意しておくことが、LoveType16と匿名サイトの差に見える。
- プラットフォーム別（推測）: Xは結果カードと著名人の引用（80億分の1、チャッピー自撮り）、TikTok／Instagramはキャラ診断の結果紹介や、顔写真を使うAI系（キャラクターコード、EPIK、フィギュア化）が中心で、ビジュアルが強いものほどTikTok／Instagram向き。

### Gaps
- TikTok／Instagramでの診断系の投稿数・再生数を定量的に比べた一次データは見つからなかった（Spotify Wrappedの全世界シェア数を除く）。
- 「パーセンタイル／レア度」表示がシェア率をどれだけ上げるかを示すA/Bテストや開発者の振り返り（note、Qiita、Zenn）は、今回の調査では見つからなかった。
- 有名人の利用がどれだけ流入を生んだか（投稿前後のPV推移）を示す公開データはない。
