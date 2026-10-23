// 仮キャラクターのSVG。公開前に人の手で描いたイラストへ差し替える前提のプレースホルダー。
// パーツ（体・耳・目・口・小物）の組み合わせで17体を描き分けている。
import { TYPES } from './data.js';

const LOOKS = [
  { shape: 'round', ears: 'squirrel', eyes: 'worried', mouth: 'wavy', back: ['squirrelTail'], belly: true, front: ['pray'] },
  { shape: 'round', ears: 'round', eyes: 'panda', mouth: 'smile', body: '#F7F6F1', ink: '#3A3A44', patches: true, front: ['stopwatch'] },
  { shape: 'tall', ears: 'longDroop', eyes: 'teary', mouth: 'wavy', front: [] },
  { shape: 'round', ears: 'cat', eyes: 'sleepy', mouth: 'cat', front: ['blanket', 'nightcap'] },
  { shape: 'round', ears: 'floppy', eyes: 'happy', mouth: 'smile', front: ['sweat'] },
  { shape: 'round', ears: 'fox', eyes: 'smug', mouth: 'cat', belly: true, front: ['sparkle'] },
  { shape: 'round', ears: 'round', eyes: 'dot', mouth: 'flat', belly: true, front: ['phone'] },
  { shape: 'tall', ears: 'none', eyes: 'happy', mouth: 'smile', back: ['squidFin', 'tentacles'], front: ['note'] },
  { shape: 'wide', ears: 'none', eyes: 'sparkle', mouth: 'open', back: ['dorsalFin', 'fishTail'], front: ['lightstick', 'hearts'] },
  { shape: 'wide', ears: 'none', eyes: 'happy', mouth: 'smile', shell: true, front: ['flag'] },
  { shape: 'tall', ears: 'tuft', eyes: 'owl', mouth: 'beak', belly: true, front: ['moon'] },
  { shape: 'tall', ears: 'none', eyes: 'sparkle', mouth: 'beak', belly: true, bellyColor: '#FFFFFF', front: ['bag'] },
  { shape: 'round', ears: 'crest', eyes: 'dot', mouth: 'beak', front: ['megaphone'] },
  { shape: 'wide', ears: 'none', eyes: 'happy', mouth: 'open', back: ['dorsalFin'], belly: true, front: ['calendar'] },
  { shape: 'round', ears: 'roundSmall', eyes: 'swirl', mouth: 'wavy', belly: true, back: ['wheel'], front: ['sweat'] },
  { shape: 'round', ears: 'none', eyes: 'happy', mouth: 'open', back: ['tentacles'], front: ['hearts'] },
  { shape: 'screen', ears: 'none', eyes: 'pixel', mouth: 'pixel', front: ['signal'] },
  { shape: 'round', ears: 'pig', eyes: 'teary', mouth: 'snout', front: ['coinSlot', 'emptyCoins'] },
  { shape: 'wide', ears: 'none', eyes: 'sparkle', mouth: 'whiskers', belly: true, front: ['flippers', 'onigiri'] },
  { shape: 'wide', ears: 'none', eyes: 'dot', mouth: 'smile', back: ['snakeTail'], belly: true, bellyColor: '#F3E9C6', front: ['mystery'] },
];

const hex = (c) => c.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
const mix = (c, to, t) => {
  const [r, g, b] = hex(c);
  const [r2, g2, b2] = hex(to);
  const m = (a, z) => Math.round(a + (z - a) * t).toString(16).padStart(2, '0');
  return `#${m(r, r2)}${m(g, g2)}${m(b, b2)}`;
};
export const shade = (c, t) => mix(c, '#000000', t);
export const tint = (c, t) => mix(c, '#FFFFFF', t);

const INK = '#3B2F33';

function bodyPath(shape) {
  switch (shape) {
    case 'tall':
      return '<ellipse cx="100" cy="116" rx="54" ry="64"/>';
    case 'wide':
      return '<ellipse cx="100" cy="122" rx="72" ry="54"/>';
    case 'screen':
      return '<rect x="50" y="42" width="100" height="140" rx="22"/>';
    default:
      return '<ellipse cx="100" cy="118" rx="64" ry="60"/>';
  }
}

function ears(kind, fill, inner, stroke) {
  const s = `stroke="${stroke}" stroke-width="4" stroke-linejoin="round"`;
  switch (kind) {
    case 'round':
      return `<circle cx="52" cy="66" r="19" fill="${fill}" ${s}/><circle cx="148" cy="66" r="19" fill="${fill}" ${s}/>
        <circle cx="52" cy="66" r="9" fill="${inner}"/><circle cx="148" cy="66" r="9" fill="${inner}"/>`;
    case 'roundSmall':
      return `<circle cx="58" cy="68" r="14" fill="${fill}" ${s}/><circle cx="142" cy="68" r="14" fill="${fill}" ${s}/>
        <circle cx="58" cy="68" r="6" fill="${inner}"/><circle cx="142" cy="68" r="6" fill="${inner}"/>`;
    case 'cat':
      return `<path d="M50 84 L58 40 L86 64 Z" fill="${fill}" ${s}/><path d="M150 84 L142 40 L114 64 Z" fill="${fill}" ${s}/>
        <path d="M58 72 L61 52 L75 64 Z" fill="${inner}"/><path d="M142 72 L139 52 L125 64 Z" fill="${inner}"/>`;
    case 'fox':
      return `<path d="M44 90 L52 30 L90 62 Z" fill="${fill}" ${s}/><path d="M156 90 L148 30 L110 62 Z" fill="${fill}" ${s}/>
        <path d="M54 76 L57 46 L76 62 Z" fill="#FFF7EE"/><path d="M146 76 L143 46 L124 62 Z" fill="#FFF7EE"/>`;
    case 'squirrel':
      return `<path d="M56 78 L58 42 L82 64 Z" fill="${fill}" ${s}/><path d="M144 78 L142 42 L118 64 Z" fill="${fill}" ${s}/>
        <path d="M58 40 l-4 -8 M58 40 l3 -9 M142 40 l4 -8 M142 40 l-3 -9" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>`;
    case 'longDroop':
      return `<ellipse cx="66" cy="44" rx="13" ry="34" transform="rotate(-28 66 70)" fill="${fill}" ${s}/>
        <ellipse cx="134" cy="44" rx="13" ry="34" transform="rotate(28 134 70)" fill="${fill}" ${s}/>
        <ellipse cx="66" cy="46" rx="6" ry="24" transform="rotate(-28 66 70)" fill="${inner}"/>
        <ellipse cx="134" cy="46" rx="6" ry="24" transform="rotate(28 134 70)" fill="${inner}"/>`;
    case 'floppy':
      return `<ellipse cx="44" cy="104" rx="16" ry="32" transform="rotate(18 44 80)" fill="${inner}" ${s}/>
        <ellipse cx="156" cy="104" rx="16" ry="32" transform="rotate(-18 156 80)" fill="${inner}" ${s}/>`;
    case 'tuft':
      return `<path d="M54 70 L50 40 L78 58 Z" fill="${fill}" ${s}/><path d="M146 70 L150 40 L122 58 Z" fill="${fill}" ${s}/>`;
    case 'pig':
      return `<path d="M50 80 L52 46 L80 62 Z" fill="${inner}" ${s}/><path d="M150 80 L148 46 L120 62 Z" fill="${inner}" ${s}/>`;
    case 'crest':
      return `<path d="M92 60 C86 40 96 30 100 30 C100 44 104 50 108 60 C112 46 120 40 128 42 C120 50 116 58 112 66 Z" fill="#F29B4B" ${s}/>`;
    default:
      return '';
  }
}

function eyes(kind) {
  const L = 78;
  const R = 122;
  const Y = 110;
  const dark = INK;
  const hl = (x, y, r = 2.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
  switch (kind) {
    case 'sparkle':
      return [L, R].map((x) => `<circle cx="${x}" cy="${Y}" r="9.5" fill="${dark}"/>${hl(x - 3, Y - 3, 3.4)}${hl(x + 3.5, Y + 3, 1.8)}`).join('');
    case 'sleepy':
      return [L, R].map((x) => `<path d="M${x - 9} ${Y} q9 7 18 0" fill="none" stroke="${dark}" stroke-width="4.5" stroke-linecap="round"/>`).join('');
    case 'happy':
      return [L, R].map((x) => `<path d="M${x - 9} ${Y + 3} q9 -10 18 0" fill="none" stroke="${dark}" stroke-width="4.5" stroke-linecap="round"/>`).join('');
    case 'worried':
      return [L, R].map((x, i) => `<circle cx="${x}" cy="${Y + 2}" r="6.5" fill="${dark}"/>${hl(x - 2, Y)}
        <path d="M${x - 9} ${Y - 12 + (i ? -4 : 0)} L${x + 9} ${Y - 12 + (i ? 0 : -4)}" stroke="${dark}" stroke-width="3.5" stroke-linecap="round"/>`).join('');
    case 'teary':
      return [L, R].map((x) => `<circle cx="${x}" cy="${Y}" r="7" fill="${dark}"/>${hl(x - 2, Y - 2)}
        <path d="M${x + 4} ${Y + 8} q4 8 0 12 q-4 -4 0 -12" fill="#7EC8F2"/>`).join('');
    case 'smug':
      return [L, R].map((x) => `<path d="M${x - 10} ${Y - 2} L${x + 10} ${Y - 2}" stroke="${dark}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M${x - 7} ${Y - 1} q7 9 14 0" fill="${dark}"/>`).join('');
    case 'swirl':
      return [L, R].map((x) => `<circle cx="${x}" cy="${Y}" r="9" fill="#fff" stroke="${dark}" stroke-width="3.5"/>
        <path d="M${x} ${Y} m-4 0 a4 4 0 1 1 4 4 a2 2 0 1 1 -2 -2" fill="none" stroke="${dark}" stroke-width="2.5"/>`).join('');
    case 'owl':
      return [L - 2, R + 2].map((x) => `<circle cx="${x}" cy="${Y - 2}" r="16" fill="#FFF8E7" stroke="${dark}" stroke-width="3.5"/>
        <circle cx="${x}" cy="${Y - 2}" r="7.5" fill="${dark}"/>${hl(x - 2.5, Y - 5)}`).join('');
    case 'panda':
      return [L, R].map((x) => `<circle cx="${x}" cy="${Y}" r="6" fill="#fff"/><circle cx="${x + 1}" cy="${Y + 1}" r="3.2" fill="${dark}"/>`).join('');
    case 'pixel':
      return [L, R].map((x) => `<rect x="${x - 7}" y="${Y - 12}" width="14" height="14" fill="#1F2A3A"/>`).join('');
    default:
      return [L, R].map((x) => `<circle cx="${x}" cy="${Y}" r="7" fill="${dark}"/>${hl(x - 2, Y - 2)}`).join('');
  }
}

function mouth(kind) {
  const s = `fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 'flat':
      return `<path d="M92 131 L108 131" ${s}/>`;
    case 'wavy':
      return `<path d="M88 132 q4 -5 8 0 q4 5 8 0 q4 -5 8 0" ${s}/>`;
    case 'cat':
      return `<path d="M88 128 q6 8 12 0 q6 8 12 0" ${s}/>`;
    case 'open':
      return `<path d="M88 126 q12 0 24 0 q0 16 -12 16 q-12 0 -12 -16 Z" fill="#E2566B" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    case 'beak':
      return `<path d="M90 124 L110 124 L100 138 Z" fill="#F29B4B" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case 'snout':
      return `<ellipse cx="100" cy="132" rx="17" ry="12" fill="#F6A5B5" stroke="${INK}" stroke-width="3.5"/>
        <ellipse cx="94" cy="132" rx="3" ry="4.5" fill="${INK}"/><ellipse cx="106" cy="132" rx="3" ry="4.5" fill="${INK}"/>`;
    case 'whiskers':
      return `<path d="M94 126 q6 6 12 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="100" cy="121" r="5" fill="${INK}"/>
        <path d="M70 128 l-18 -4 M70 134 l-18 2 M130 128 l18 -4 M130 134 l18 2" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'pixel':
      return `<path d="M86 124 h6 v6 h16 v-6 h6 v6 h-6 v6 h-16 v-6 h-6 Z" fill="#1F2A3A"/>`;
    default:
      return `<path d="M90 128 q10 10 20 0" ${s}/>`;
  }
}

function backParts(list, fill, stroke) {
  const s = `stroke="${stroke}" stroke-width="4" stroke-linejoin="round"`;
  return list
    .map((p) => {
      switch (p) {
        case 'squirrelTail':
          return `<path d="M150 150 C196 150 196 80 168 64 C150 54 136 70 150 84 C164 98 150 120 136 132 Z" fill="${shade(fill, 0.12)}" ${s}/>`;
        case 'squidFin':
          return `<path d="M100 18 L150 70 L50 70 Z" fill="${fill}" ${s}/>`;
        case 'tentacles':
          return [52, 76, 100, 124, 148]
            .map((x) => `<path d="M${x - 9} 160 q0 24 9 26 q9 -2 9 -26" fill="${fill}" ${s}/>`)
            .join('');
        case 'dorsalFin':
          return `<path d="M86 74 C96 46 116 40 128 44 C120 56 118 66 120 78 Z" fill="${shade(fill, 0.1)}" ${s}/>`;
        case 'fishTail':
          return `<path d="M168 122 L196 96 L192 150 Z" fill="${shade(fill, 0.1)}" ${s}/>`;
        case 'snakeTail':
          return `<path d="M160 140 C196 136 196 176 170 178 C182 168 176 156 156 160 Z" fill="${shade(fill, 0.08)}" ${s}/>`;
        case 'wheel':
          return `<circle cx="100" cy="112" r="92" fill="none" stroke="#C9B7A5" stroke-width="7"/>
            <circle cx="100" cy="112" r="92" fill="none" stroke="#E9DED2" stroke-width="3" stroke-dasharray="6 14"/>`;
        default:
          return '';
      }
    })
    .join('');
}

function frontParts(list, color) {
  const s = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  return list
    .map((p) => {
      switch (p) {
        case 'pray':
          return `<ellipse cx="93" cy="156" rx="9" ry="13" transform="rotate(14 93 156)" fill="${tint(color, 0.35)}" ${s}/>
            <ellipse cx="107" cy="156" rx="9" ry="13" transform="rotate(-14 107 156)" fill="${tint(color, 0.35)}" ${s}/>`;
        case 'stopwatch':
          return `<circle cx="160" cy="152" r="20" fill="#fff" ${s}/><path d="M160 152 L160 140 M160 152 L169 156 M156 128 h8" ${s}/>`;
        case 'nightcap':
          return `<path d="M62 70 C70 30 120 22 140 50 C152 66 170 60 178 74 C160 76 146 72 138 66 Z" fill="#6C7FD8" ${s}/>
            <circle cx="180" cy="76" r="9" fill="#fff" ${s}/><path d="M60 72 Q100 52 142 66" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`;
        case 'blanket':
          return `<path d="M24 158 Q100 140 176 158 L180 196 L20 196 Z" fill="#FFE7A8" ${s}/>
            <path d="M40 174 h16 M70 180 h16 M104 176 h16 M138 182 h16" stroke="#F2B64B" stroke-width="5" stroke-linecap="round"/>`;
        case 'sweat':
          return `<path d="M156 80 q10 14 0 20 q-10 -6 0 -20" fill="#7EC8F2" ${s}/>`;
        case 'sparkle':
          return [[34, 70, 1], [168, 54, 0.8], [172, 150, 0.6]]
            .map(([x, y, k]) => `<path d="M${x} ${y - 12 * k} L${x + 3 * k} ${y - 3 * k} L${x + 12 * k} ${y} L${x + 3 * k} ${y + 3 * k} L${x} ${y + 12 * k} L${x - 3 * k} ${y + 3 * k} L${x - 12 * k} ${y} L${x - 3 * k} ${y - 3 * k} Z" fill="#FFD84D"/>`)
            .join('');
        case 'phone':
          return `<rect x="142" y="128" width="30" height="48" rx="6" fill="#2D3446" ${s}/><rect x="147" y="135" width="20" height="30" rx="3" fill="#BFF3E6"/>
            <path d="M150 150 l4 4 l8 -9" fill="none" stroke="#2D9C7A" stroke-width="3" stroke-linecap="round"/>`;
        case 'note':
          return `<path d="M164 70 v-26 l16 -4 v26" fill="none" ${s}/><circle cx="160" cy="70" r="5" fill="${INK}"/><circle cx="176" cy="66" r="5" fill="${INK}"/>`;
        case 'lightstick':
          return `<rect x="160" y="96" width="12" height="40" rx="5" fill="#FF8AD8" ${s}/><rect x="161" y="134" width="10" height="26" rx="3" fill="#555" ${s}/>`;
        case 'hearts':
          return [[30, 74, 1], [172, 62, 0.8]]
            .map(([x, y, k]) => `<path d="M${x} ${y + 10 * k} C${x - 16 * k} ${y} ${x - 8 * k} ${y - 12 * k} ${x} ${y - 4 * k} C${x + 8 * k} ${y - 12 * k} ${x + 16 * k} ${y} ${x} ${y + 10 * k} Z" fill="#FF6F91"/>`)
            .join('');
        case 'flag':
          return `<path d="M164 170 V100" ${s}/><path d="M164 100 L192 110 L164 122 Z" fill="#FF7A59" ${s}/>`;
        case 'moon':
          return `<path d="M168 24 a20 20 0 1 0 20 26 a16 16 0 1 1 -20 -26 Z" fill="#FFE27A" ${s}/>`;
        case 'bag':
          return `<path d="M146 136 h32 l-4 40 h-24 Z" fill="#FFB347" ${s}/><path d="M154 136 q8 -14 16 0" fill="none" ${s}/>`;
        case 'megaphone':
          return `<path d="M150 132 L184 116 L184 162 L150 146 Z" fill="#FF7A59" ${s}/><rect x="140" y="130" width="12" height="18" rx="3" fill="#fff" ${s}/>`;
        case 'calendar':
          return `<rect x="140" y="126" width="44" height="42" rx="6" fill="#fff" ${s}/><path d="M140 140 h44" ${s}/>
            <path d="M148 150 h6 M160 150 h6 M172 150 h6 M148 160 h6 M160 160 h6 M172 160 h6" stroke="#2D3446" stroke-width="5" stroke-linecap="round"/>`;
        case 'coinSlot':
          return `<rect x="86" y="62" width="28" height="7" rx="3.5" fill="${INK}"/>`;
        case 'emptyCoins':
          return `<circle cx="164" cy="166" r="12" fill="#FFE27A" ${s}/><path d="M160 166 h8" ${s}/>
            <path d="M30 70 q4 -8 8 0 M40 60 q4 -8 8 0" fill="none" stroke="#B49A5A" stroke-width="3" stroke-linecap="round"/>`;
        case 'flippers':
          return `<ellipse cx="44" cy="156" rx="18" ry="9" transform="rotate(-25 44 156)" fill="${color}" ${s}/>
            <ellipse cx="156" cy="156" rx="18" ry="9" transform="rotate(25 156 156)" fill="${color}" ${s}/>`;
        case 'onigiri':
          return `<path d="M150 112 L176 150 L124 150 Z" fill="#fff" ${s}/><rect x="138" y="136" width="24" height="14" fill="#2D3446"/>`;
        case 'mystery':
          return `<text x="160" y="60" font-size="34" font-weight="800" fill="#7FB3A6" font-family="sans-serif">?</text>
            <text x="28" y="78" font-size="26" font-weight="800" fill="#B49A5A" font-family="sans-serif">?</text>
            <path d="M172 92 L175 100 L183 103 L175 106 L172 114 L169 106 L161 103 L169 100 Z" fill="#FFD84D"/>`;
        case 'signal':
          return `<path d="M162 34 a20 20 0 0 1 20 20 M162 22 a32 32 0 0 1 32 32" fill="none" stroke="#8CF2E0" stroke-width="5" stroke-linecap="round"/>`;
        default:
          return '';
      }
    })
    .join('');
}

export function charaSVG(index, { size = 200 } = {}) {
  const look = LOOKS[index];
  const color = TYPES[index].color;
  const fill = look.body || color;
  const stroke = look.ink || shade(color, 0.45);
  const inner = look.ink ? look.ink : shade(color, 0.18);
  const earFill = look.ink || fill;
  const belly = look.belly
    ? `<ellipse cx="100" cy="${look.shape === 'tall' ? 140 : 142}" rx="${look.shape === 'wide' ? 44 : 36}" ry="30" fill="${look.bellyColor || tint(color, 0.55)}"/>`
    : '';
  const patches = look.patches
    ? `<ellipse cx="78" cy="110" rx="15" ry="13" transform="rotate(-20 78 110)" fill="${look.ink}"/>
       <ellipse cx="122" cy="110" rx="15" ry="13" transform="rotate(20 122 110)" fill="${look.ink}"/>`
    : '';
  const shell = look.shell
    ? `<path d="M40 100 Q100 26 160 100 Z" fill="${shade(color, 0.22)}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
       <path d="M72 84 l14 -12 l14 12 l14 -12 l14 12" fill="none" stroke="${tint(color, 0.3)}" stroke-width="4" stroke-linejoin="round"/>`
    : '';
  const screen = look.shape === 'screen'
    ? '<rect x="60" y="60" width="80" height="100" rx="12" fill="#8CF2E0"/><circle cx="100" cy="172" r="4" fill="#8CF2E0"/>'
    : '';
  const cheeks = look.shape === 'screen' ? '' : `<ellipse cx="64" cy="128" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/><ellipse cx="136" cy="128" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/>`;
  const arms = look.shape === 'screen' || ['blanket', 'flippers'].some((f) => (look.front || []).includes(f))
    ? ''
    : `<ellipse cx="${look.shape === 'wide' ? 34 : 40}" cy="140" rx="11" ry="15" transform="rotate(25 40 140)" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
       <ellipse cx="${look.shape === 'wide' ? 166 : 160}" cy="140" rx="11" ry="15" transform="rotate(-25 160 140)" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">
  ${backParts(look.back || [], fill, stroke)}
  ${ears(look.ears, earFill, inner, stroke)}
  <g fill="${fill}" stroke="${stroke}" stroke-width="4">${bodyPath(look.shape)}</g>
  ${shell}${screen}${belly}${arms}${patches}${cheeks}
  ${eyes(look.eyes)}
  ${mouth(look.mouth)}
  ${frontParts(look.front || [], color)}
</svg>`;
}

export const charaDataURL = (index) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(charaSVG(index, { size: 600 }))}`;
