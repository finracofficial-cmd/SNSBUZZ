// A/Bテストの定義。site/assets/experiments.js と同じ内容にする（テストで確かめている）。
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
export const AB_STEPS = ['exposure', 'cta', 'checkout', 'paid', 'result', 'share', 'agree', 'detail'];
// 実験ごとに見る段階（最初が分母）。書いていない実験は購入の段階で見る
export const METRICS = { calc: ['result', 'share', 'agree', 'detail'] };
export const metricsOf = (name) => METRICS[name] || ['exposure', 'cta', 'checkout', 'paid'];
