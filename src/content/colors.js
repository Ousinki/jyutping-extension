// Background-colour and light/dark theme detection helpers.
// Pure DOM reads (getComputedStyle) with no shared extension state — used to
// auto-adjust ruby/popup colours against the underlying page background.

function parseRgba(str) {
  if (!str) return null;
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1.0
  };
}

function calculateLuminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 判斷元素文字是否處於暗色模式（深色背景/黑夜）
 * 核心依據：
 * 1. 優先根據文字自身的計算顏色（getComputedStyle(element).color）判定：
 *    - 黑色/深色文字（Luminance < 0.5）必然出現在白色/淺色背景上 -> false（淺色模式）
 *    - 白色/淺色文字（Luminance >= 0.5）必然出現在深色/黑色背景上 -> true（暗色模式）
 * 2. 回退到元素背景色與父級背景色判定。
 */
export function isElementOnDarkBackground(element) {
  if (!element) return false;
  try {
    const style = window.getComputedStyle(element);
    const textColor = parseRgba(style.color);
    if (textColor && textColor.a > 0.3) {
      const textLum = calculateLuminance(textColor.r, textColor.g, textColor.b);
      // 文字較深（深灰、黑）=> 背景必然為淺色 => 不是暗色背景
      if (textLum < 0.45) {
        return false;
      }
      // 文字較淺（白、淺灰）=> 背景必然為深色 => 是暗色背景
      if (textLum > 0.55) {
        return true;
      }
    }
  } catch (e) { /* ignore */ }

  // 兜底：根據背景色計算
  return checkIsDarkColor(getElementBackgroundColor(element));
}

/**
 * 獲取元素真實有效的實色背景顏色，支援 Alpha Compositing 混合計算，避免將半透明黑誤轉為純黑。
 */
export function getElementBackgroundColor(element) {
  try {
    let el = element;
    const isDark = (function() {
      try {
        const style = window.getComputedStyle(element);
        const textColor = parseRgba(style.color);
        if (textColor && textColor.a > 0.3) {
          return calculateLuminance(textColor.r, textColor.g, textColor.b) > 0.55;
        }
      } catch (e) { /* ignore */ }
      return false;
    })();

    const baseRgb = isDark ? { r: 18, g: 18, b: 20 } : { r: 255, g: 255, b: 255 };

    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const bg = parseRgba(style.backgroundColor);
      if (bg && bg.a > 0.05) {
        if (bg.a >= 0.85) {
          return `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
        }
        // 半透明顏色：將其混合到底色上
        const r = Math.round(bg.r * bg.a + baseRgb.r * (1 - bg.a));
        const g = Math.round(bg.g * bg.a + baseRgb.g * (1 - bg.a));
        const b = Math.round(bg.b * bg.a + baseRgb.b * (1 - bg.a));
        return `rgb(${r}, ${g}, ${b})`;
      }
      el = el.parentElement;
    }

    // 檢查 body 背景
    if (document.body) {
      const bodyBg = parseRgba(window.getComputedStyle(document.body).backgroundColor);
      if (bodyBg && bodyBg.a > 0.05) {
        if (bodyBg.a >= 0.85) {
          return `rgb(${bodyBg.r}, ${bodyBg.g}, ${bodyBg.b})`;
        }
        const r = Math.round(bodyBg.r * bodyBg.a + baseRgb.r * (1 - bodyBg.a));
        const g = Math.round(bodyBg.g * bodyBg.a + baseRgb.g * (1 - bodyBg.a));
        const b = Math.round(bodyBg.b * bodyBg.a + baseRgb.b * (1 - bodyBg.a));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    // 檢查 html 根節點
    if (document.documentElement) {
      const htmlBg = parseRgba(window.getComputedStyle(document.documentElement).backgroundColor);
      if (htmlBg && htmlBg.a > 0.05) {
        return `rgb(${htmlBg.r}, ${htmlBg.g}, ${htmlBg.b})`;
      }
    }

    return isDark ? 'rgb(18, 18, 20)' : 'rgb(255, 255, 255)';
  } catch (e) { /* ignore */ }
  return 'rgb(255, 255, 255)';
}

export function checkIsDarkColor(bgColorStr) {
  if (!bgColorStr) return false;
  const parsed = parseRgba(bgColorStr);
  if (parsed) {
    const luminance = calculateLuminance(parsed.r, parsed.g, parsed.b);
    return luminance < 0.5;
  }
  return false;
}
