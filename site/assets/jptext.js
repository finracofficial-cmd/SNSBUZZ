// 日本語の文節の切れ目（DOM を使わないので、画像づくり・テストからも使う）。
// 日本語の改行を、文節の切れ目だけにする（「連絡／先」のような単語の途中で折り返さない）。
// Intl.Segmenter で単語に分けてから、ひらがな（助詞・送りがな）や閉じかっこは前の語にくっつけ、
// 漢字・カタカナ・数字が続くところ（「連絡先」「3日」）も切らない。
// 画面では切れ目に <wbr> を入れて CSS で word-break: keep-all にし、画像（canvas）では折り返しの単位に使う
const jpSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
const HIRA = /[\u3041-\u309f]/;
const CJK = /[\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff0-9０-９A-Za-zＡ-Ｚａ-ｚ]/;
const OPENING = '「『（(“';
const NO_START = '。、，．・ー」』）)！？!?〜…ぁぃぅぇぉっゃゅょァィゥェォッャュョ%％';
const SENTENCE_END = '、。！？!?';
export function phrases(text) {
  const t = String(text ?? '');
  if (!jpSegmenter) return [t];
  const out = [];
  for (const { segment } of jpSegmenter.segment(t)) {
    const prev = out[out.length - 1];
    if (prev === undefined) {
      out.push(segment);
      continue;
    }
    const a = prev[prev.length - 1];
    const b = segment[0];
    const ok = SENTENCE_END.includes(a)
      ? !NO_START.includes(b)
      : !OPENING.includes(a) && !NO_START.includes(b) && !HIRA.test(b) && !(CJK.test(a) && CJK.test(b));
    if (ok) out.push(segment);
    else out[out.length - 1] = prev + segment;
  }
  return out;
}
