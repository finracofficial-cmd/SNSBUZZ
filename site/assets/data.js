// 診断の骨組み（軸・質問・隠しタイプの条件）。タイプごとの文言は content/types/*.json から
// scripts/gen-content.mjs が生成する types.js にある。
//
// タイプ番号 = E*8 + S*4 + P*2 + M（各軸で pos 側なら 1）。16〜19 は隠しタイプ。
// 1軸5問・選択肢の点数は ±1 / ±3 なので、軸の合計は必ず奇数になり引き分けが起きない。
export { TYPES } from './types.js';

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
// 「幻のしっかり者」：4軸すべての合計の絶対値を足しても、これ以下なら
export const BALANCED_MAX_TOTAL = 4;

// 各質問は1つの軸だけを動かす。v は pos 側なら正、neg 側なら負。
// tag 付きの選択肢を、同じ tag で3つとも選ぶと隠しタイプになる。
export const QUESTIONS = [
  {
    axis: 0,
    text: '待ちに待った休日。まず何する？',
    options: [
      { text: '昼まで寝る。布団から出ないのが正義', v: -3 },
      { text: 'とりあえずスマホを見てたら昼', v: -1, tag: 'phone' },
      { text: '朝から出かける予定を入れてある', v: 1 },
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
    text: '送ったメッセージに半日返信がない。',
    options: [
      { text: '何か悪いこと言ったかな…と送信履歴を読み返す', v: -3 },
      { text: 'ちょっと気になる', v: -1 },
      { text: '忙しいんだろうな', v: 1 },
      { text: '送ったこと自体を忘れてる', v: 3 },
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
    text: 'ひとりの時間と、だれかといる時間。',
    options: [
      { text: 'ひとりじゃないと充電できない', v: -3 },
      { text: 'ひとりが多めだとちょうどいい', v: -1 },
      { text: 'だれかといるほうが元気が出る', v: 1 },
      { text: 'ひとりだと逆に疲れる', v: 3 },
    ],
  },
  {
    axis: 2,
    text: 'テストや締切の前は？',
    options: [
      { text: '計画どおりコツコツ終わらせる', v: -3 },
      { text: '計画は立てる（守れるとは言ってない）', v: -1 },
      { text: '前日にエンジンがかかる', v: 1 },
      { text: '締切の存在をさっき知った', v: 3 },
    ],
  },
  {
    axis: 3,
    text: '人前でちょっとやらかした日の夜。',
    options: [
      { text: '寝る前に何度も思い出してじたばたする', v: -3 },
      { text: 'しばらく引きずる', v: -1 },
      { text: '寝たら忘れる', v: 1 },
      { text: 'そもそも、やらかしに気づいていない', v: 3 },
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
    text: '急に「今から遊ばない？」と誘われたら？',
    options: [
      { text: '心の準備ができてないので断る', v: -3 },
      { text: '相手によっては行く', v: -1 },
      { text: 'だいたい行く', v: 1 },
      { text: '誘われる前に自分から誘ってる', v: 3 },
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
    text: '「ちょっと手伝って」と頼まれたら？',
    options: [
      { text: '聞こえなかったことにしたい', v: -3 },
      { text: '頼まれた分だけやる', v: -1 },
      { text: 'ついでに他のこともやる', v: 1 },
      { text: '気づいたらリーダーになってる', v: 3 },
    ],
  },
  {
    axis: 1,
    text: 'お昼や休み時間は？',
    options: [
      { text: 'ひとりでゆっくりしたい', v: -3 },
      { text: '仲のいい1〜2人と過ごす', v: -1 },
      { text: 'いつものグループでわいわい', v: 1 },
      { text: '気づいたら知らない人とも話してる', v: 3 },
    ],
  },
  {
    axis: 2,
    text: 'お金の使い方は？',
    options: [
      { text: '毎月ちゃんと貯金してる', v: -3 },
      { text: '使う前に一応考える', v: -1 },
      { text: '気づいたら残高がない', v: 1, tag: 'money' },
      { text: '「なんとかなる」が口ぐせ', v: 3 },
    ],
  },
  {
    axis: 3,
    text: '嫌なことがあった日のなおし方は？',
    options: [
      { text: '原因を一晩じゅう考える', v: -3 },
      { text: '誰かに聞いてもらう', v: -1 },
      { text: 'おいしいものを食べて忘れる', v: 1, tag: 'food' },
      { text: '寝たらだいたいリセット', v: 3 },
    ],
  },
  {
    axis: 0,
    text: '部活やサークル、バイトでのあなたは？',
    options: [
      { text: '目立たず、静かにフェードアウトを狙う', v: -3 },
      { text: 'やることはやる。それ以上はやらない', v: -1 },
      { text: '頼まれると張り切っちゃう', v: 1 },
      { text: 'いつの間にか一番熱くなってる', v: 3 },
    ],
  },
  {
    axis: 1,
    text: 'グループトークの通知が100件たまってた。',
    options: [
      { text: 'そっと通知をオフにする', v: -3 },
      { text: 'さかのぼって読むだけ読む', v: -1 },
      { text: 'スタンプで参加しておく', v: 1 },
      { text: '100件のうち30件は自分の発言', v: 3 },
    ],
  },
  {
    axis: 2,
    text: '待ち合わせには？',
    options: [
      { text: '10分前には着いている', v: -3 },
      { text: '時間ぴったりに着く', v: -1 },
      { text: '2〜3分遅れがち', v: 1 },
      { text: '家を出る時間に起きる', v: 3 },
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

export const QUESTIONS_PER_AXIS = QUESTIONS.length / AXES.length;
export const AXIS_MAX = 3 * QUESTIONS_PER_AXIS;

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
