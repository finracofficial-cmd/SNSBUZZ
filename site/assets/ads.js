// 広告（Google AdSense）。SITE.ads.client を入れたときだけ出す（審査に通ってから設定する）。
//   ・10代が多いので、パーソナライズしない広告にする（requestNonPersonalizedAds）
//   ・完全版を買った人には出さない（「広告なし」も完全版の特典）
//   ・置くのは章と章のあいだだけ。ボタンや選択肢のそばには置かない（誤タップをさそう配置はしない）
//   ・広告のスクリプトは、広告の枠がある画面を開いたときにはじめて読む（トップの表示を遅くしない）
import { SITE } from './config.js';
import { esc } from './ui.js';
import { hasPremium } from './premium.js';

export const adsOn = () => !!SITE.ads?.client && !hasPremium();

export function adSlot(place) {
  const slot = SITE.ads?.slots?.[place];
  if (!adsOn() || !slot) return '';
  return `<aside class="ad-slot" aria-label="広告"><span class="ad-label">広告</span>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(SITE.ads.client)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
}

let loaded = false;
export function fillAds(root) {
  const list = root?.querySelectorAll('ins.adsbygoogle:not([data-filled])') || [];
  if (!list.length) return;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.requestNonPersonalizedAds = 1;
  if (!loaded) {
    loaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(SITE.ads.client)}`;
    document.head.append(s);
  }
  list.forEach((el) => {
    el.dataset.filled = '1';
    try {
      window.adsbygoogle.push({});
    } catch {
      // 広告が読めなくても画面は動く
    }
  });
}
