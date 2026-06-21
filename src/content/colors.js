// Background-colour detection helpers.
// Pure DOM reads (getComputedStyle) with no shared extension state — used to
// auto-adjust ruby/popup colours against the underlying page background.

export function getElementBackgroundColor(element) {
  try {
    let el = element;
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
      }
      el = el.parentElement;
    }

    // 如果一直找到根節點都沒顏色，嘗試從 body 取，如果還沒有預設為白色
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
      return bodyBg;
    }
  } catch (e) { /* ignore */ }
  return 'rgb(255, 255, 255)'; // 預設白色
}

export function checkIsDarkColor(bgColorStr) {
  if (!bgColorStr) return false;
  const match = bgColorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // W3C 相對亮度公式
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  return false;
}

export function isElementOnDarkBackground(element) {
  return checkIsDarkColor(getElementBackgroundColor(element));
}
