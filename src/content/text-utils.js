// Small text-display helpers. Pure, no shared state.

const SUPERSCRIPT_MAP = {
  '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
};

// 將音調數字轉為上標（例如 jyut6 -> jyut⁶）
export function convertToSuperscriptTone(str) {
  if (!str) return str;
  return str.replace(/\d/g, match => SUPERSCRIPT_MAP[match] || match);
}
