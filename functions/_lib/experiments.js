// A/Bテストの定義。site/assets/experiments.js と同じ内容にする（テストで確かめている）。
//   paybar  … レポートの固定バーの文言。量で見せる（のこり7章・約〇字）か、中身で見せる（本当のあなた・恋愛の攻略法）か
//   autopay … 第2章が見えたところで購入案内を1回だけ自動で出すか、出さないか
// 段階（step）: exposure（未購入でレポートを見た）・cta（自分で購入案内を開いた）・checkout（決済画面へ進んだ）・paid（支払い完了。サーバーで数える）
export const EXPERIMENTS = {
  paybar: ['amount', 'specific'],
  autopay: ['on', 'off'],
};
export const AB_STEPS = ['exposure', 'cta', 'checkout', 'paid'];
