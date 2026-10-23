// 診断の骨組み（軸・質問・隠しタイプの条件・くわしい診断のパラメータ）。
// タイプやパラメータの文言は content/ から scripts/gen-content.mjs が生成する types.js にある。
//
// タイプ番号 = E*8 + S*4 + P*2 + M（各軸で pos 側なら 1）。16〜19 は隠しタイプ。
// タイプはかんたん診断（1軸3問・計12問）で決まる。選択肢の点数は ±1 / ±3 なので、
// 軸の合計は必ず奇数になり引き分けが起きない。くわしい診断はパラメータ24問を足す。
export { TYPES, PARAM_TEXT, LOVE_TYPES } from './types.js';

export const AXES = [
  { key: 'E', neg: '省エネ', pos: '全力' },
  { key: 'S', neg: 'ひとり好き', pos: '人たらし' },
  { key: 'P', neg: '計画派', pos: 'ノリ派' },
  { key: 'M', neg: '考えすぎ', pos: '秒で忘れる' },
];

export const BASE_COUNT = 16;
// 隠しタイプ。判定はこの順に見る（先に当たったものが優先）
export const HIDDEN = [
  { index: 19, kind: 'balanced', no: 'S4' },
  { index: 16, kind: 'tag', tag: 'phone', no: 'S1' },
  { index: 17, kind: 'tag', tag: 'money', no: 'S2' },
  { index: 18, kind: 'tag', tag: 'food', no: 'S3' },
];
export const isHidden = (index) => index >= BASE_COUNT;
// 「幻のしっかり者」：4軸すべての合計が ±1（真ん中）で、かつ ±3 の回答が4個以下の人。
// 合計だけだと約2%になり、ほかの隠しタイプより出やすくなるので、±3 の数でも絞っている
export const BALANCED = { total: 4, big: 4 };

// 各質問は1つの軸だけを動かす。v は pos 側なら正、neg 側なら負。
// tag 付きの選択肢を、同じ tag で3つとも選ぶと隠しタイプになる。
export const QUESTIONS = [
  {
    axis: 0,
    text: '待ちに待った休日。まず何する？',
    options: [
      { text: '昼まで寝る。布団から出ないのが正義', v: -3 },
      { text: 'とりあえずスマホを見てたら昼', v: -1, tag: 'phone' },
      { text: '午前中には起きて、何かしら動く', v: 1 },
      { text: 'やりたいことが多すぎて朝からフル稼働', v: 3 },
    ],
  },
  {
    axis: 1,
    text: '初対面の人ばかりの集まり。どうする？',
    options: [
      { text: '知ってる人のそばから離れない', v: -3 },
      { text: '話しかけられたら話す', v: -1 },
      { text: '近くの人に自分から話しかける', v: 1 },
      { text: '帰るころには全員と連絡先を交換してる', v: 3 },
    ],
  },
  {
    axis: 2,
    text: '旅行の準備は？',
    options: [
      { text: '分刻みのしおりを作る', v: -3 },
      { text: '行きたい所だけはリストにしておく', v: -1 },
      { text: '宿だけ取ればなんとかなる', v: 1 },
      { text: '前日に行き先を決める', v: 3 },
    ],
  },
  {
    axis: 3,
    text: '寝る前の頭の中は？',
    options: [
      { text: '明日のことも昔のことも、全部考える', v: -3 },
      { text: 'ちょっと考えごとをする', v: -1 },
      { text: 'スマホを見てたら寝落ちしてる', v: 1, tag: 'phone' },
      { text: '何も考えてない。秒で寝る', v: 3 },
    ],
  },
  {
    axis: 0,
    text: '好きなことが見つかったら？',
    options: [
      { text: '気が向いたときにゆるく楽しむ', v: -1 },
      { text: '動画を見て、やった気になって満足', v: -3, tag: 'phone' },
      { text: '調べまくって道具までそろえる', v: 1 },
      { text: '寝る時間をけずってでものめりこむ', v: 3 },
    ],
  },
  {
    axis: 1,
    text: 'ひとりの時間と、誰かといる時間、どっちが好き？',
    options: [
      { text: 'ひとりじゃないと充電できない', v: -3 },
      { text: 'ひとりが多めだとちょうどいい', v: -1 },
      { text: '誰かといるほうが元気が出る', v: 1 },
      { text: 'ひとりだと逆に疲れる', v: 3 },
    ],
  },
  {
    axis: 2,
    text: 'コンビニで新作スイーツを見つけた。',
    options: [
      { text: '予算外なので見送る', v: -3 },
      { text: 'レビューを見てから決める', v: -1 },
      { text: 'とりあえず買う。食べてから考える', v: 1, tag: 'food' },
      { text: '新作は全部買う。迷ったら両方', v: 3, tag: 'money' },
    ],
  },
  {
    axis: 3,
    text: '嫌なことがあった日、どうやって切りかえる？',
    options: [
      { text: '原因を一晩じゅう考える', v: -3 },
      { text: 'ちょっと引きずるけど、次の日には平気', v: -1 },
      { text: 'おいしいものを食べて忘れる', v: 1, tag: 'food' },
      { text: '寝たらだいたいリセット', v: 3 },
    ],
  },
  {
    axis: 0,
    text: '家に帰ってきた。まず何する？',
    options: [
      { text: '玄関で力尽きて座りこむ', v: -3 },
      { text: 'とりあえず冷蔵庫をあける', v: -1, tag: 'food' },
      { text: '着替えて、やることを片づける', v: 1 },
      { text: '着替えて、また出かける', v: 3 },
    ],
  },
  {
    axis: 1,
    text: '休み時間や休憩中、どう過ごす？',
    options: [
      { text: 'ひとりで好きなことをする', v: -3 },
      { text: '仲のいい1人とだけ話す', v: -1 },
      { text: '近くの人と話す', v: 1 },
      { text: '気づけば輪の真ん中にいる', v: 3 },
    ],
  },
  {
    axis: 2,
    text: 'お金の使い方は？',
    options: [
      { text: '毎月ちゃんと貯金してる', v: -3 },
      { text: '使う前に一応考える', v: -1 },
      { text: '気づいたらおこづかいが残りわずか', v: 1, tag: 'money' },
      { text: '「なんとかなる」で、あるだけ使う', v: 3 },
    ],
  },
  {
    axis: 3,
    text: '欲しかったものを買った次の日。',
    options: [
      { text: '本当に必要だったかな…と考えこむ', v: -3 },
      { text: 'ちょっとだけ後悔する', v: -1 },
      { text: '買ったことを忘れて、また同じのを買いそう', v: 1, tag: 'money' },
      { text: '満足して、もう次の欲しいものを探してる', v: 3 },
    ],
  },
];

export const AXIS_MAX = 9; // 1軸3問 × 最大3点

// ---------- くわしい診断のパラメータ（各4問・選択肢は 0〜3 点） ----------
// タイプはかんたん診断で決まり、くわしい診断は同じタイプを細かくする「続きの章」にする。
// 二つ名は、いちばん振り切れたパラメータの high / low から取る。
export const PARAMS = [
  { key: 'koi', name: '恋愛積極度', high: '恋に全力な', low: '恋はのんびり派の' },
  { key: 'yaki', name: 'ヤキモチ度', high: 'ヤキモチ焼きの', low: '心が広すぎる' },
  { key: 'samishi', name: 'さみしがり度', high: 'さみしがりの', low: 'ひとりでも平気な' },
  { key: 'mousou', name: '妄想力', high: '妄想がとまらない', low: '地に足がついた' },
  { key: 'oshi', name: '推し活熱量', high: '推しが燃料の', low: '自分推しの' },
  { key: 'tsukkomi', name: 'ツッコミ力', high: 'ツッコミが鋭い', low: '天然ボケの' },
];
export const PARAM_MAX = 12; // 1パラメータ4問 × 最大3点

// 3つの章（8問ずつ）。章を終えるたびに、ちょっとしたごほうび画面を出す
export const CHAPTERS = [
  { title: 'パート1　恋とヤキモチ', done: '恋愛のクセを読みとりました' },
  { title: 'パート2　さみしさと妄想', done: '心のクセを読みとりました' },
  { title: 'パート3　推しと笑い', done: 'すべてのパラメータがそろいました' },
];

export const PARAM_QUESTIONS = [
  {
    param: 0,
    chapter: 0,
    text: '気になる人ができたら？',
    options: [
      { text: '遠くから見ているだけで満足', v: 0 },
      { text: '共通の友達にさりげなく聞く', v: 1 },
      { text: '自分から話しかけに行く', v: 2 },
      { text: '気づいたら連絡先を聞いている', v: 3 },
    ],
  },
  {
    param: 1,
    chapter: 0,
    text: '好きな人が、ほかの人と楽しそうに話している。',
    options: [
      { text: '全然気にならない', v: 0 },
      { text: 'ちょっとだけ気になる', v: 1 },
      { text: 'あとで、誰だったのか聞く', v: 2 },
      { text: 'その場で会話に入りにいく', v: 3 },
    ],
  },
  {
    param: 0,
    chapter: 0,
    text: '遊びに誘うなら？',
    options: [
      { text: '誘われるのを待つ', v: 0 },
      { text: '大人数の予定にまぜて誘う', v: 1 },
      { text: '「ふたりで遊ぼう」と誘う', v: 2 },
      { text: '行きたい場所と日にちまで決めて誘う', v: 3 },
    ],
  },
  {
    param: 1,
    chapter: 0,
    text: '仲のいい友達が、新しい友達とばかり遊んでいる。',
    options: [
      { text: '友達が楽しいならうれしい', v: 0 },
      { text: '少しさみしいけど応援する', v: 1 },
      { text: 'ストーリーを見て、ちょっとモヤモヤ', v: 2 },
      { text: '「最近冷たくない？」と言っちゃう', v: 3 },
    ],
  },
  {
    param: 0,
    chapter: 0,
    text: '告白するなら？',
    options: [
      { text: 'されるのを待ちたい', v: 0 },
      { text: '相手の気持ちがわかってから', v: 1 },
      { text: 'いい雰囲気になったら言う', v: 2 },
      { text: '好きだと思ったら、その日に言う', v: 3 },
    ],
  },
  {
    param: 1,
    chapter: 0,
    text: '推しが、ほかのメンバーや共演者と仲良くしている。',
    options: [
      { text: '尊い。もっとやって', v: 0 },
      { text: 'ほほえましい', v: 1 },
      { text: 'ちょっと複雑', v: 2 },
      { text: '心がざわつく', v: 3 },
    ],
  },
  {
    param: 0,
    chapter: 0,
    text: '好きな人の誕生日が近い。',
    options: [
      { text: 'とくに何もしない', v: 0 },
      { text: 'おめでとうのメッセージだけ送る', v: 1 },
      { text: 'ちょっとしたプレゼントを渡す', v: 2 },
      { text: 'サプライズを全力で計画する', v: 3 },
    ],
  },
  {
    param: 1,
    chapter: 0,
    text: '仲のいい友達が、ほかの子と「おそろい」を持っていた。',
    options: [
      { text: 'とくに気にしない', v: 0 },
      { text: '「かわいいね」と言う', v: 1 },
      { text: 'ちょっとうらやましい', v: 2 },
      { text: '「今度おそろいにしよ」と言う', v: 3 },
    ],
  },
  {
    param: 2,
    chapter: 1,
    text: '休日に予定が何もない。',
    options: [
      { text: '最高。ひとりを満喫する', v: 0 },
      { text: 'のんびりできてうれしい', v: 1 },
      { text: '夕方になると誰かと話したくなる', v: 2 },
      { text: '朝から誰かに連絡している', v: 3 },
    ],
  },
  {
    param: 3,
    chapter: 1,
    text: '移動中や授業中、頭の中では？',
    options: [
      { text: '目の前のことに集中している', v: 0 },
      { text: '次の予定のことを考えている', v: 1 },
      { text: 'ありえない「もしも」を考えている', v: 2 },
      { text: '頭の中で、別の人生を生きている', v: 3 },
    ],
  },
  {
    param: 2,
    chapter: 1,
    text: 'ひとりでごはんを食べるのは？',
    options: [
      { text: 'むしろ好き', v: 0 },
      { text: '全然平気', v: 1 },
      { text: 'できれば誰かと食べたい', v: 2 },
      { text: 'ひとりのときは通話をつなぐ', v: 3 },
    ],
  },
  {
    param: 3,
    chapter: 1,
    text: '好きな人と目が合った。',
    options: [
      { text: 'たまたまだと思う', v: 0 },
      { text: 'ちょっとうれしい', v: 1 },
      { text: '何か意味があるかもと考える', v: 2 },
      { text: '頭の中で、ふたりの未来まで進む', v: 3 },
    ],
  },
  {
    param: 2,
    chapter: 1,
    text: 'メッセージのやりとりが終わりそうなとき。',
    options: [
      { text: '自分からさっと終わらせる', v: 0 },
      { text: '自然に終わるのを待つ', v: 1 },
      { text: 'スタンプでつなげておく', v: 2 },
      { text: '終わるとちょっとさみしい', v: 3 },
    ],
  },
  {
    param: 3,
    chapter: 1,
    text: '「もし1億円あったら」を考えたことは？',
    options: [
      { text: 'ない。現実的じゃない', v: 0 },
      { text: 'たまに考える', v: 1 },
      { text: '使い道のリストがある', v: 2 },
      { text: '毎日ちがう使い道を考えている', v: 3 },
    ],
  },
  {
    param: 2,
    chapter: 1,
    text: '家に帰って、誰もいないとき。',
    options: [
      { text: '静かで最高', v: 0 },
      { text: 'とくに何も思わない', v: 1 },
      { text: 'とりあえず動画や音楽をつける', v: 2 },
      { text: 'すぐ誰かに連絡する', v: 3 },
    ],
  },
  {
    param: 3,
    chapter: 1,
    text: '推しや好きなキャラとの「もしも」、考える？',
    options: [
      { text: 'とくに考えない', v: 0 },
      { text: 'たまに考える', v: 1 },
      { text: 'セリフまで考える', v: 2 },
      { text: '頭の中で連載している', v: 3 },
    ],
  },
  {
    param: 4,
    chapter: 2,
    text: '推しはいる？',
    options: [
      { text: 'とくにいない', v: 0 },
      { text: 'ゆるく好きな人がいる', v: 1 },
      { text: 'はっきり推しがいる', v: 2 },
      { text: '推しが毎日の原動力', v: 3 },
    ],
  },
  {
    param: 5,
    chapter: 2,
    text: '友達がボケた。',
    options: [
      { text: 'ボケだと気づかずに流す', v: 0 },
      { text: '笑ってあげる', v: 1 },
      { text: '軽くツッコむ', v: 2 },
      { text: '秒でツッコんで、さらに広げる', v: 3 },
    ],
  },
  {
    param: 4,
    chapter: 2,
    text: '推しのグッズは？',
    options: [
      { text: 'とくに買わない', v: 0 },
      { text: '気に入ったものだけ買う', v: 1 },
      { text: '新しいのが出たらだいたい買う', v: 2 },
      { text: '保存用・使う用・布教用をそろえる', v: 3 },
    ],
  },
  {
    param: 5,
    chapter: 2,
    text: 'ドラマや映画で、さすがに都合がよすぎる展開がきた。',
    options: [
      { text: '素直に感動する', v: 0 },
      { text: '気にせず楽しむ', v: 1 },
      { text: '心の中でツッコむ', v: 2 },
      { text: '声に出してツッコむ', v: 3 },
    ],
  },
  {
    param: 4,
    chapter: 2,
    text: '推しの誕生日は？',
    options: [
      { text: '知らない', v: 0 },
      { text: 'なんとなく覚えている', v: 1 },
      { text: 'SNSでお祝いする', v: 2 },
      { text: '自分の誕生日より準備する', v: 3 },
    ],
  },
  {
    param: 5,
    chapter: 2,
    text: '自分がやらかしたとき。',
    options: [
      { text: 'あまり気づかない', v: 0 },
      { text: '照れ笑いでごまかす', v: 1 },
      { text: '自分で自分にツッコむ', v: 2 },
      { text: '笑いに変えて、話のネタにする', v: 3 },
    ],
  },
  {
    param: 4,
    chapter: 2,
    text: '推しの話になると？',
    options: [
      { text: '聞く側にまわる', v: 0 },
      { text: '少しだけ話す', v: 1 },
      { text: '話が止まらなくなる', v: 2 },
      { text: '布教用の資料が出てくる', v: 3 },
    ],
  },
  {
    param: 5,
    chapter: 2,
    text: 'グループトークで、誰かがスタンプでボケてきた。',
    options: [
      { text: 'そっとスルー', v: 0 },
      { text: 'スタンプで返す', v: 1 },
      { text: 'ひとことツッコむ', v: 2 },
      { text: 'そこから大喜利が始まる', v: 3 },
    ],
  },
];

// 恋愛タイプ：恋愛積極度・ヤキモチ度・さみしがり度が「高い」（58%以上）かどうかの3ビットで8種類
export const LOVE_HIGH = 58;
export const loveIndexOf = (params) =>
  (params[0] >= LOVE_HIGH ? 4 : 0) + (params[1] >= LOVE_HIGH ? 2 : 0) + (params[2] >= LOVE_HIGH ? 1 : 0);

export function typeNo(index) {
  const h = HIDDEN.find((x) => x.index === index);
  return h ? h.no : String(index + 1).padStart(2, '0');
}

export function indexFromNo(no) {
  const h = HIDDEN.find((x) => x.no.toLowerCase() === String(no).toLowerCase());
  if (h) return h.index;
  const n = Number(no) - 1;
  return Number.isInteger(n) && n >= 0 && n < BASE_COUNT ? n : -1;
}
