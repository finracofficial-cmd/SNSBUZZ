// 文字だけの結果（Wordle のように、絵文字のバーで見せる）。LINE・X にそのまま貼れる。
// くわしい診断は二つ名とランクだけを入れ、パラメータの数値（完全版の中身）は入れない。
import { SITE } from './config.js';
import { TYPES, AXES, PARAMS, LOVE_TYPES, isHidden, typeNo } from './data.js';
import { rankOf, skillsOf, titleOf } from './logic.js';

// 寄っている側の強さ（50〜100%）を5マスで
const bar = (pct) => {
  const n = Math.max(1, Math.min(5, Math.round((pct - 50) / 10)));
  return '🟧'.repeat(n) + '⬜'.repeat(5 - n);
};

export function textResult(r, url) {
  const t = TYPES[r.index];
  const no = isHidden(r.index) ? `隠しタイプ${typeNo(r.index)}` : `No.${typeNo(r.index)}`;
  const lines = [`#${SITE.quizName}`, `【${r.nickname?.text || ''}${t.label}】${no}`, `${titleOf(r.purity)}・ポンコツ純度${r.purity}%`];
  AXES.forEach((a, k) => {
    const side = r.sums[k] >= 0 ? a.pos : a.neg;
    lines.push(`${bar(r.axisPct[k])} ${side}`);
  });
  if (r.params) {
    lines.push(PARAMS.map((p, k) => `${p.name.replace(/度$|力$|熱量$/, '')}${rankOf(r.params[k])}`).join(' '));
    lines.push(`恋愛は「${LOVE_TYPES[r.love].name}」`);
    const sk = skillsOf(r);
    if (sk) lines.push(`必殺技「${sk.skill.skill}」`);
  }
  lines.push('あなたは何タイプ？', url);
  return lines.join('\n');
}
