// サイト全体の設定。名前やドメインはここだけ変えれば全ページに反映される。
export const SITE = {
  name: 'ポンコツ図鑑',
  quizName: '愛されポンコツ診断',
  // 本番ドメインに置き換える（シェアURL・OGP・カード下部の表記に使う）
  origin: 'https://example.com',
  hashtag: 'ポンコツ図鑑',
  catchCopy: '性格タイプはもう知ってる。\nじゃあ、あなたの“愛すべきポンコツ”は？',
  disclaimer: 'エンタメ診断です。心理学的な検査ではありません。',
  // 完全版（有料）。実際の価格と販売可否はサーバー（/api/premium/status）が返す値を優先する
  premiumPrice: 390,
  // 広告（Google AdSense）。審査に通ったら client（ca-pub-…）と、場所ごとの広告ユニットのIDを入れる。空なら広告は出ない。
  // 10代が多いので、パーソナライズしない広告で出す。完全版を買った人には出さない
  ads: { client: '', slots: { result: '', type: '', zukan: '' } },
  // アフィリエイト（Amazon アソシエイト）。トラッキングIDを入れたときだけ「このタイプにおすすめ（PR）」を出す
  affiliate: { amazonTag: '' },
  // そのほかの収益の入口。URL を入れたときだけ出す（LINEスタンプ・グッズのお店・LINE公式アカウント・法人の問い合わせ先）
  links: { stamps: '', goods: '', lineOfficial: '', bizContact: '' },
  // 特定商取引法に基づく表記。販売を始める前に必ず埋める
  seller: {
    name: '（販売事業者名）',
    address: '（請求があれば遅滞なく開示します）',
    contact: '（メールアドレス）',
  },
};
