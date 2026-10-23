// Google Fonts の CSS（日本語は文字の範囲ごとの定義が多く、約60KBある）を、表示を止めずに後から読みこむ。
// 読みこむまでは端末の丸ゴシック（iPhone ならヒラギノ丸ゴ）で表示する。
// 画像を描くとき（card.js の ensureFonts）は、この読みこみを待ってから文字を描く。
const HREF = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap';

export const fontCss =
  typeof document === 'undefined'
    ? Promise.resolve()
    : new Promise((resolve) => {
        if (document.querySelector(`link[href="${HREF}"]`)) {
          resolve();
          return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = HREF;
        link.onload = () => resolve();
        link.onerror = () => resolve();
        document.head.appendChild(link);
        // 読みこめなくても、4秒で先へ進む（端末のフォントで描く）
        setTimeout(resolve, 4000);
      });
