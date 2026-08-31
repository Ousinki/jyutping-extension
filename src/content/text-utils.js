// Small text-display helpers. Pure, no shared state.

const SUPERSCRIPT_MAP = {
  '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
};

// 將音調數字轉為上標（例如 jyut6 -> jyut⁶）
export function convertToSuperscriptTone(str) {
  if (!str) return str;
  return str.replace(/\d/g, match => SUPERSCRIPT_MAP[match] || match);
}

/**
 * 將標準粵拼 (Jyutping) 轉換為正宗學術標準耶魯拼音 (Yale Romanization)
 * 遵循 Yale 官方標音規則（調號 Diacritic + 陽聲調低音標誌 h）
 * @param {string} jp - 例如 "nei5 hou2" 或 "can4 daai6 man4"
 * @returns {string} - 例如 "néih hóu" 或 "chàhn daaih màhn"
 */
export function jyutpingToYale(jp) {
  if (!jp || typeof jp !== 'string') return '';

  const VOWEL_ACCENTS = {
    'a': { 1: 'ā', 2: 'á', 3: 'a', 4: 'à', 5: 'á', 6: 'a' },
    'e': { 1: 'ē', 2: 'é', 3: 'e', 4: 'è', 5: 'é', 6: 'e' },
    'i': { 1: 'ī', 2: 'í', 3: 'i', 4: 'ì', 5: 'í', 6: 'i' },
    'o': { 1: 'ō', 2: 'ó', 3: 'o', 4: 'ò', 5: 'ó', 6: 'o' },
    'u': { 1: 'ū', 2: 'ú', 3: 'u', 4: 'ù', 5: 'ú', 6: 'u' },
    'm': { 1: 'm̄', 2: 'ḿ', 3: 'm', 4: 'm̀', 5: 'ḿ', 6: 'm' },
    'n': { 1: 'n̄', 2: 'ń', 3: 'n', 4: 'ǹ', 5: 'ń', 6: 'n' }
  };

  const syllables = jp.trim().toLowerCase().split(/\s+/);
  const yaleSyllables = syllables.map(syl => {
    const match = syl.match(/^([a-z]+)([1-6])?$/);
    if (!match) return syl;

    let letters = match[1];
    const tone = parseInt(match[2] || '3', 10);
    const isLowTone = (tone === 4 || tone === 5 || tone === 6);

    // 1. 純鼻音節處理 (m, ng)
    if (letters === 'm') {
      const v = VOWEL_ACCENTS['m'][tone];
      return isLowTone ? (v + 'h') : v;
    }
    if (letters === 'ng') {
      const v = VOWEL_ACCENTS['n'][tone] + 'g';
      return isLowTone ? (v + 'h') : v;
    }

    // 2. 聲母轉換
    if (letters.startsWith('gw')) {
      letters = 'gw' + letters.slice(2);
    } else if (letters.startsWith('kw')) {
      letters = 'kw' + letters.slice(2);
    } else if (letters.startsWith('ng')) {
      letters = 'ng' + letters.slice(2);
    } else if (letters.startsWith('c')) {
      letters = 'ch' + letters.slice(1);
    } else if (letters.startsWith('z')) {
      letters = 'j' + letters.slice(1);
    } else if (letters.startsWith('j')) {
      letters = 'y' + letters.slice(1);
    }

    // 3. 韻母轉換
    // oe -> eu, eoi -> eui, eon -> eun, eot -> eut, oeng -> eung, oek -> euk
    letters = letters
      .replace(/oe([ngk])/, 'eu$1')
      .replace(/oe$/, 'eu')
      .replace(/eoi/, 'eui')
      .replace(/eon/, 'eun')
      .replace(/eot/, 'eut');

    // aa 結尾開音節簡寫為 a (例如 waa -> wa, baa -> ba)
    letters = letters.replace(/aa$/, 'a');

    // 4. 元音位置尋找與調號添加
    // 優先在主要元音上標調
    let targetVowelIdx = -1;
    if (letters.includes('yu')) {
      targetVowelIdx = letters.indexOf('u');
    } else {
      targetVowelIdx = letters.search(/[aeiou]/);
    }

    if (targetVowelIdx === -1) {
      return isLowTone ? (letters + 'h') : letters;
    }

    const origVowel = letters[targetVowelIdx];
    const accentedVowel = VOWEL_ACCENTS[origVowel] ? VOWEL_ACCENTS[origVowel][tone] : origVowel;

    letters = letters.slice(0, targetVowelIdx) + accentedVowel + letters.slice(targetVowelIdx + 1);

    // 5. 陽聲調（4, 5, 6 聲）在元音組末尾插入 'h'
    if (isLowTone) {
      const vowelMatch = letters.match(/[aeiouāēīōūáéíóúàèìòù]+/);
      if (vowelMatch) {
        const insertPos = vowelMatch.index + vowelMatch[0].length;
        letters = letters.slice(0, insertPos) + 'h' + letters.slice(insertPos);
      } else {
        letters += 'h';
      }
    }

    return letters;
  });

  return yaleSyllables.join(' ');
}

