// A/Bテストの定義（ブラウザ・サーバー・テストで共通）。functions/_lib/experiments.js と同じ内容にする（テストで確かめている）。
//   paybar  … レポートの固定バーの文言。量で見せる（のこり7章・約〇字）か、中身で見せる（本当のあなた・恋愛の攻略法）か
//   autopay … 第2章が見えたところで購入案内を1回だけ自動で出すか、出さないか
//   calc    … 結果の直前に「何を計算しているか」の3行を見せるか（労働の錯覚。待ち時間は同じ）
// 段階（step）: exposure（未購入でレポートを見た）・cta（自分で購入案内を開いた）・checkout（決済画面へ進んだ）・paid（支払い完了。サーバーで数える）
//   calc だけは購入ではなく、結果のあとの動きで見る: result（結果を見た）・share（シェアした）・agree（「わかる〜！」）・detail（くわしい診断を始めた）
export const EXPERIMENTS = {
  paybar: ['amount', 'specific'],
  autopay: ['on', 'off'],
  calc: ['on', 'off'],
};
// サーバーが案を決める実験（端末ではくじを引かない）。
//   price … じぶん用の価格を週ごとに交互にする（functions/_lib/token.js の priceArm）。件数ではなく、表示1回あたりの売上でくらべる
export const SERVER_EXPERIMENTS = { price: ['base', 'alt'] };
export const ALL_EXPERIMENTS = { ...EXPERIMENTS, ...SERVER_EXPERIMENTS };
export const AB_STEPS = ['exposure', 'cta', 'checkout', 'paid', 'result', 'share', 'agree', 'detail'];
// 実験ごとに見る段階（最初が分母）。書いていない実験は購入の段階で見る
export const METRICS = { calc: ['result', 'share', 'agree', 'detail'] };
export const metricsOf = (name) => METRICS[name] || ['exposure', 'cta', 'checkout', 'paid'];

// 正規分布の上側確率（Abramowitz-Stegun 26.2.17）
function normalTail(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? p : 1 - p;
}
// 2つの割合の差の z 検定（両側の p 値）。どちらかが30未満のときは判断しない（null）
export function twoProportion(x1, n1, x2, n2) {
  if (n1 < 30 || n2 < 30) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null;
  const z = (x1 / n1 - x2 / n2) / se;
  return 2 * normalTail(Math.abs(z));
}

// 表示1回あたりの売上の差の z 検定（両側の p 値）。価格のテスト用（価格が上がると支払い率は下がるので、率ではなく売上でくらべる）。
// 1回の表示の売上は「平均単価 × 買ったかどうか」とみなす。どちらかの表示が30未満、または支払いが0件のときは判断しない（null）
export function revenueTest(rev1, paid1, n1, rev2, paid2, n2) {
  if (n1 < 30 || n2 < 30 || !paid1 || !paid2) return null;
  const v = (rev, paid, n) => {
    const p = paid / n;
    const a = rev / paid;
    return (a * a * p * (1 - p)) / n;
  };
  const se = Math.sqrt(v(rev1, paid1, n1) + v(rev2, paid2, n2));
  if (!se) return null;
  return 2 * normalTail(Math.abs((rev1 / n1 - rev2 / n2) / se));
}
