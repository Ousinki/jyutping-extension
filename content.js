(() => {
  // src/content/markdown.js
  function renderMarkdown(md) {
    if (!md) return "";
    let escaped = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = escaped.split(/\r?\n/);
    let htmlResult = "";
    const listStack = [];
    let inTable = false;
    let isTableHeader = false;
    function parseInlineMarkdown(text) {
      if (!text) return "";
      let html = text;
      html = html.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");
      html = html.replace(/(\*|_)(.*?)\1/g, "<em>$2</em>");
      html = html.replace(/`(.*?)`/g, '<code style="font-family: monospace; background: var(--popup-divider, rgba(0,0,0,0.06)); padding: 2px 4px; border-radius: 4px; font-size: 0.9em; word-break: break-all;">$1</code>');
      html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: var(--popup-accent, var(--popup-text-label)); text-decoration: underline; cursor: pointer;">$1</a>');
      return html;
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const isTableLine = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
      if (!isTableLine && inTable) {
        inTable = false;
        htmlResult += "</tbody></table></div>";
      }
      if (isTableLine) {
        if (!inTable) {
          while (listStack.length > 0) {
            const top = listStack.pop();
            htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
          }
          inTable = true;
          isTableHeader = true;
          htmlResult += '<div style="overflow-x: auto; margin: 8px 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.95em; color: var(--popup-text);"><tbody>';
        }
        if (trimmed.replace(/\|/g, "").replace(/-/g, "").replace(/:/g, "").trim() === "") {
          isTableHeader = false;
          continue;
        }
        const cells = trimmed.split("|").slice(1, -1).map((cell) => parseInlineMarkdown(cell.trim()));
        htmlResult += "<tr>";
        cells.forEach((cell) => {
          if (isTableHeader) {
            htmlResult += `<th style="border: 1px solid var(--popup-divider, rgba(0,0,0,0.15)); padding: 6px 10px; background: var(--popup-active-bg, rgba(0,0,0,0.03)); font-weight: bold; text-align: left; line-height: 1.4;">${cell}</th>`;
          } else {
            htmlResult += `<td style="border: 1px solid var(--popup-divider, rgba(0,0,0,0.15)); padding: 6px 10px; line-height: 1.4;">${cell}</td>`;
          }
        });
        htmlResult += "</tr>";
        isTableHeader = false;
        continue;
      }
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        while (listStack.length > 0) {
          const top = listStack.pop();
          htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
        }
        htmlResult += '<hr style="border: none; border-top: 1px solid var(--popup-divider, rgba(0,0,0,0.1)); margin: 8px 0;" />';
        continue;
      }
      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        while (listStack.length > 0) {
          const top = listStack.pop();
          htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
        }
        const level = headerMatch[1].length;
        const content = parseInlineMarkdown(headerMatch[2]);
        const fontSize = 1.3 - (level - 1) * 0.08;
        htmlResult += `<h${level} style="margin: 8px 0 4px 0; font-weight: bold; color: var(--popup-text); line-height: 1.3; font-size: ${fontSize}em;">${content}</h${level}>`;
        continue;
      }
      const quoteMatch = line.match(/^>\s*(.*)$/);
      if (quoteMatch) {
        while (listStack.length > 0) {
          const top = listStack.pop();
          htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
        }
        const content = parseInlineMarkdown(quoteMatch[1]);
        htmlResult += `<blockquote style="border-left: 3px solid var(--popup-divider, rgba(0,0,0,0.1)); padding-left: 8px; margin: 6px 0; color: var(--popup-text-muted, #666); font-style: italic;">${content}</blockquote>`;
        continue;
      }
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ulMatch || olMatch) {
        const isUl = !!ulMatch;
        const match = isUl ? ulMatch : olMatch;
        const indent = match[1].length;
        const content = parseInlineMarkdown(match[2]);
        const listType = isUl ? "ul" : "ol";
        while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
          const top = listStack.pop();
          htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
        }
        if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
          listStack.push({ type: listType, indent });
          const level = listStack.length;
          let listStyle = "";
          if (listType === "ul") {
            const bulletType = level === 1 ? "disc" : level === 2 ? "circle" : "square";
            listStyle = `list-style-type: ${bulletType};`;
          } else {
            const numType = level === 1 ? "decimal" : level === 2 ? "lower-alpha" : "lower-roman";
            listStyle = `list-style-type: ${numType};`;
          }
          htmlResult += `<${listType} style="margin: 4px 0; padding-left: 20px; ${listStyle}">`;
        } else if (listStack[listStack.length - 1].type !== listType) {
          const top = listStack.pop();
          htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
          listStack.push({ type: listType, indent });
          const level = listStack.length;
          let listStyle = "";
          if (listType === "ul") {
            const bulletType = level === 1 ? "disc" : level === 2 ? "circle" : "square";
            listStyle = `list-style-type: ${bulletType};`;
          } else {
            const numType = level === 1 ? "decimal" : level === 2 ? "lower-alpha" : "lower-roman";
            listStyle = `list-style-type: ${numType};`;
          }
          htmlResult += `<${listType} style="margin: 4px 0; padding-left: 20px; ${listStyle}">`;
        }
        htmlResult += `<li style="margin-bottom: 3px; line-height: 1.5;">${content}</li>`;
        continue;
      }
      if (trimmed === "") {
        while (listStack.length > 0) {
          const top = listStack.pop();
          htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
        }
        htmlResult += '<div style="height: 6px;"></div>';
        continue;
      }
      while (listStack.length > 0) {
        const top = listStack.pop();
        htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
      }
      const parsedContent = parseInlineMarkdown(line);
      htmlResult += `<div style="margin-bottom: 4px; line-height: 1.5;">${parsedContent}</div>`;
    }
    while (listStack.length > 0) {
      const top = listStack.pop();
      htmlResult += top.type === "ul" ? "</ul>" : "</ol>";
    }
    if (inTable) {
      htmlResult += "</tbody></table></div>";
    }
    return htmlResult;
  }

  // src/content/colors.js
  function parseRgba(str) {
    if (!str) return null;
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return null;
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== void 0 ? parseFloat(match[4]) : 1
    };
  }
  function calculateLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function isElementOnDarkBackground(element) {
    if (!element) return false;
    try {
      const style = window.getComputedStyle(element);
      const textColor = parseRgba(style.color);
      if (textColor && textColor.a > 0.3) {
        const textLum = calculateLuminance(textColor.r, textColor.g, textColor.b);
        if (textLum < 0.45) {
          return false;
        }
        if (textLum > 0.55) {
          return true;
        }
      }
    } catch (e) {
    }
    return checkIsDarkColor(getElementBackgroundColor(element));
  }
  function getElementBackgroundColor(element) {
    try {
      let el = element;
      const isDark = function() {
        try {
          const style = window.getComputedStyle(element);
          const textColor = parseRgba(style.color);
          if (textColor && textColor.a > 0.3) {
            return calculateLuminance(textColor.r, textColor.g, textColor.b) > 0.55;
          }
        } catch (e) {
        }
        return false;
      }();
      const baseRgb = isDark ? { r: 18, g: 18, b: 20 } : { r: 255, g: 255, b: 255 };
      while (el && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const bg = parseRgba(style.backgroundColor);
        if (bg && bg.a > 0.05) {
          if (bg.a >= 0.85) {
            return `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
          }
          const r = Math.round(bg.r * bg.a + baseRgb.r * (1 - bg.a));
          const g = Math.round(bg.g * bg.a + baseRgb.g * (1 - bg.a));
          const b = Math.round(bg.b * bg.a + baseRgb.b * (1 - bg.a));
          return `rgb(${r}, ${g}, ${b})`;
        }
        el = el.parentElement;
      }
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
      if (document.documentElement) {
        const htmlBg = parseRgba(window.getComputedStyle(document.documentElement).backgroundColor);
        if (htmlBg && htmlBg.a > 0.05) {
          return `rgb(${htmlBg.r}, ${htmlBg.g}, ${htmlBg.b})`;
        }
      }
      return isDark ? "rgb(18, 18, 20)" : "rgb(255, 255, 255)";
    } catch (e) {
    }
    return "rgb(255, 255, 255)";
  }
  function checkIsDarkColor(bgColorStr) {
    if (!bgColorStr) return false;
    const parsed = parseRgba(bgColorStr);
    if (parsed) {
      const luminance = calculateLuminance(parsed.r, parsed.g, parsed.b);
      return luminance < 0.5;
    }
    return false;
  }

  // src/content/text-utils.js
  var SUPERSCRIPT_MAP = {
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹"
  };
  function convertToSuperscriptTone(str) {
    if (!str) return str;
    return str.replace(/\d/g, (match) => SUPERSCRIPT_MAP[match] || match);
  }
  function jyutpingToYale(jp) {
    if (!jp || typeof jp !== "string") return "";
    const VOWEL_ACCENTS = {
      "a": { 1: "ā", 2: "á", 3: "a", 4: "à", 5: "á", 6: "a" },
      "e": { 1: "ē", 2: "é", 3: "e", 4: "è", 5: "é", 6: "e" },
      "i": { 1: "ī", 2: "í", 3: "i", 4: "ì", 5: "í", 6: "i" },
      "o": { 1: "ō", 2: "ó", 3: "o", 4: "ò", 5: "ó", 6: "o" },
      "u": { 1: "ū", 2: "ú", 3: "u", 4: "ù", 5: "ú", 6: "u" },
      "m": { 1: "m̄", 2: "ḿ", 3: "m", 4: "m̀", 5: "ḿ", 6: "m" },
      "n": { 1: "n̄", 2: "ń", 3: "n", 4: "ǹ", 5: "ń", 6: "n" }
    };
    const syllables = jp.trim().toLowerCase().split(/\s+/);
    const yaleSyllables = syllables.map((syl) => {
      const match = syl.match(/^([a-z]+)([1-6])?$/);
      if (!match) return syl;
      let letters = match[1];
      const tone = parseInt(match[2] || "3", 10);
      const isLowTone = tone === 4 || tone === 5 || tone === 6;
      if (letters === "m") {
        const v = VOWEL_ACCENTS["m"][tone];
        return isLowTone ? v + "h" : v;
      }
      if (letters === "ng") {
        const v = VOWEL_ACCENTS["n"][tone] + "g";
        return isLowTone ? v + "h" : v;
      }
      if (letters.startsWith("gw")) {
        letters = "gw" + letters.slice(2);
      } else if (letters.startsWith("kw")) {
        letters = "kw" + letters.slice(2);
      } else if (letters.startsWith("ng")) {
        letters = "ng" + letters.slice(2);
      } else if (letters.startsWith("c")) {
        letters = "ch" + letters.slice(1);
      } else if (letters.startsWith("z")) {
        letters = "j" + letters.slice(1);
      } else if (letters.startsWith("j")) {
        letters = "y" + letters.slice(1);
      }
      letters = letters.replace(/oe([ngk])/, "eu$1").replace(/oe$/, "eu").replace(/eoi/, "eui").replace(/eon/, "eun").replace(/eot/, "eut");
      letters = letters.replace(/aa$/, "a");
      let targetVowelIdx = -1;
      if (letters.includes("yu")) {
        targetVowelIdx = letters.indexOf("u");
      } else {
        targetVowelIdx = letters.search(/[aeiou]/);
      }
      if (targetVowelIdx === -1) {
        return isLowTone ? letters + "h" : letters;
      }
      const origVowel = letters[targetVowelIdx];
      const accentedVowel = VOWEL_ACCENTS[origVowel] ? VOWEL_ACCENTS[origVowel][tone] : origVowel;
      letters = letters.slice(0, targetVowelIdx) + accentedVowel + letters.slice(targetVowelIdx + 1);
      if (isLowTone) {
        const vowelMatch = letters.match(/[aeiouāēīōūáéíóúàèìòù]+/);
        if (vowelMatch) {
          const insertPos = vowelMatch.index + vowelMatch[0].length;
          letters = letters.slice(0, insertPos) + "h" + letters.slice(insertPos);
        } else {
          letters += "h";
        }
      }
      return letters;
    });
    return yaleSyllables.join(" ");
  }

  // src/content/dom.js
  function isEditableElement(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea") {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    let parent = element.parentElement;
    while (parent) {
      if (parent.isContentEditable) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }
  function hasEditableFocus() {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    if (activeEl.closest && (activeEl.closest("#cantonese-popup-dict") || activeEl.closest("#cantonese-translate-popup"))) {
      return false;
    }
    return activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable || activeEl.getAttribute("contenteditable") === "true" || activeEl.closest && activeEl.closest('[contenteditable="true"]');
  }
  function getDeepestElementAtPoint(x, y) {
    let element = document.elementFromPoint(x, y);
    if (!element) return null;
    while (element && element.shadowRoot) {
      const shadowElement = element.shadowRoot.elementFromPoint(x, y);
      if (!shadowElement || shadowElement === element) break;
      element = shadowElement;
    }
    return element;
  }
  function getCaretRangeFromPointInShadow(x, y) {
    let range = document.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      return range;
    }
    const element = getDeepestElementAtPoint(x, y);
    if (!element) return null;
    const root = element.getRootNode();
    if (root && root !== document && typeof root.caretRangeFromPoint === "function") {
      range = root.caretRangeFromPoint(x, y);
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        return range;
      }
    }
    const textNodes = getTextNodesIn(element);
    for (const textNode of textNodes) {
      const nodeRange = document.createRange();
      for (let i = 0; i < textNode.textContent.length; i++) {
        try {
          nodeRange.setStart(textNode, i);
          nodeRange.setEnd(textNode, i + 1);
          const rect = nodeRange.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            nodeRange.setStart(textNode, i);
            nodeRange.setEnd(textNode, i);
            return nodeRange;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return null;
  }
  function getTextNodesIn(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }
  function getAccurateOffset(textNode, clientX, clientY) {
    const text = textNode.textContent;
    if (!text) return -1;
    const range = document.createRange();
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!/[一-鿿]/.test(char)) continue;
      try {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return i;
        }
      } catch (e) {
      }
    }
    return -1;
  }

  // src/content/tts.js
  function createBlobUrlFromDataUri(dataURI) {
    try {
      if (!dataURI.startsWith("data:")) return dataURI;
      const parts = dataURI.split(",");
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Data URI to Blob URL failed:", e);
      return dataURI;
    }
  }

  // src/content/paragraph-translate.js
  var ALLOWED_TAGS = /* @__PURE__ */ new Set([
    "A",
    "B",
    "I",
    "EM",
    "STRONG",
    "SPAN",
    "BR",
    "CODE",
    "SUB",
    "SUP",
    "MARK",
    "U",
    "S",
    "SMALL",
    "DEL",
    "INS",
    "ABBR",
    "WBR",
    "BDI",
    "BDO",
    "Q",
    "CITE",
    "TIME",
    "RUBY",
    "RT",
    "RP"
  ]);
  var DROP_TAGS = /* @__PURE__ */ new Set([
    "SCRIPT",
    "STYLE",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "LINK",
    "META",
    "BASE",
    "FORM",
    "INPUT",
    "TEXTAREA",
    "BUTTON",
    "SELECT",
    "OPTION",
    "SVG",
    "MATH",
    "NOSCRIPT",
    "TEMPLATE",
    "CANVAS",
    "AUDIO",
    "VIDEO",
    "SOURCE",
    "TRACK"
  ]);
  var ALLOWED_ATTRS = { A: /* @__PURE__ */ new Set(["href", "title"]) };
  var EMPTY = /* @__PURE__ */ new Set();
  function isSafeHref(value) {
    const v = (value || "").trim().toLowerCase();
    return !(v.startsWith("javascript:") || v.startsWith("data:") || v.startsWith("vbscript:"));
  }
  function sanitizeTranslatedHtml(html) {
    if (!html) return "";
    const template = document.createElement("template");
    template.innerHTML = html;
    const root = template.content;
    const elements = Array.from(root.querySelectorAll("*"));
    for (const el of elements) {
      if (!root.contains(el)) continue;
      const tag = el.tagName;
      if (DROP_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        continue;
      }
      const allowed = ALLOWED_ATTRS[tag] || EMPTY;
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (!allowed.has(name) || name === "href" && !isSafeHref(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
      if (tag === "A" && el.hasAttribute("href")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    return template.innerHTML;
  }

  // src/content/wordbook-storage.js
  var WORDBOOK_KEY = "wordbook";
  var WORDBOOK_DEFAULT_FOLDER_KEY = "wordbook_default_folder_id";
  var TRASH_AUTO_PURGE_MS = 30 * 24 * 60 * 60 * 1e3;
  function generateId() {
    return "w_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  }
  async function getDefaultFolderId() {
    return new Promise((resolve) => {
      chrome.storage.local.get([WORDBOOK_DEFAULT_FOLDER_KEY], (res) => {
        resolve(res[WORDBOOK_DEFAULT_FOLDER_KEY] || "default");
      });
    });
  }
  async function getWordbook() {
    return new Promise((resolve) => {
      chrome.storage.local.get([WORDBOOK_KEY], (result) => {
        let list = result[WORDBOOK_KEY] || [];
        const now = Date.now();
        let hasExpired = false;
        const purged = list.filter((w) => {
          if (w.deletedAt && now - w.deletedAt > TRASH_AUTO_PURGE_MS) {
            hasExpired = true;
            return false;
          }
          return true;
        });
        if (hasExpired) {
          chrome.storage.local.set({ [WORDBOOK_KEY]: purged });
          resolve(purged);
        } else {
          resolve(list);
        }
      });
    });
  }
  async function addWord(wordData) {
    const wordbook = await getWordbook();
    const defaultFolderId = await getDefaultFolderId();
    const existingIndex = wordbook.findIndex((w) => w.character === wordData.character);
    if (existingIndex !== -1) {
      const existing = wordbook[existingIndex];
      if (existing.deletedAt) {
        delete existing.deletedAt;
        existing.timestamp = Date.now();
        if (wordData.jyutping) existing.jyutping = wordData.jyutping;
        if (wordData.yale) existing.yale = wordData.yale;
        if (wordData.english && wordData.english.length > 0) existing.english = wordData.english;
        if (!existing.folderId) existing.folderId = wordData.folderId || defaultFolderId || "default";
        wordbook.splice(existingIndex, 1);
        wordbook.unshift(existing);
        return new Promise((resolve) => {
          chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, () => {
            resolve({ success: true, isNew: true, entry: existing, restoredFromTrash: true });
          });
        });
      }
      return { success: true, isNew: false, entry: existing };
    }
    const entry = {
      id: generateId(),
      character: wordData.character,
      simplified: wordData.simplified || wordData.character,
      jyutping: wordData.jyutping || "",
      yale: wordData.yale || "",
      english: wordData.english || [],
      timestamp: Date.now(),
      sourceUrl: wordData.sourceUrl || "",
      sourceTitle: wordData.sourceTitle || "",
      tags: [],
      folderId: wordData.folderId || defaultFolderId || "default",
      notes: ""
    };
    wordbook.unshift(entry);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, () => {
        resolve({ success: true, isNew: true, entry });
      });
    });
  }
  async function isWordSaved(character) {
    const wordbook = await getWordbook();
    return wordbook.some((w) => w.character === character && !w.deletedAt);
  }
  async function removeWordByCharacter(character) {
    const wordbook = await getWordbook();
    const item = wordbook.find((w) => w.character === character && !w.deletedAt);
    if (!item) return false;
    item.deletedAt = Date.now();
    return new Promise((resolve) => {
      chrome.storage.local.set({ [WORDBOOK_KEY]: wordbook }, () => {
        resolve(true);
      });
    });
  }

  // src/content/index.js
  (function() {
    "use strict";
    const contentScriptId = Math.random().toString(36).slice(2);
    document.documentElement.setAttribute("data-jyutping-tts-owner", contentScriptId);
    let dictionary = {};
    let popup = null;
    let lastPopupShowTime = 0;
    let popupArrow = null;
    let isEnabled = true;
    let displayMode = "jyutping";
    let toneStyle = "superscript";
    let popupDisplayStyle = "full";
    let popupThemeMode = "manual";
    let popupTheme = "classic";
    let popupThemeDay = "classic";
    let popupThemeNight = "night";
    let popupThemeDayStart = "07:00";
    let popupThemeNightStart = "19:00";
    let ttsEnabled = true;
    let ttsEngine = "edgeTts";
    let edgeTtsMode = "default";
    let edgeTtsUrl = "";
    const EDGE_TTS_DEFAULT_URL = "http://114.55.243.162:8090";
    let azureTtsKey = "";
    let azureTtsRegion = "";
    let azureTtsVoice = "zh-HK-HiuMaanNeural";
    let ttsRate = 0.9;
    let customZhFont = "";
    let customEnFont = "";
    let currentRange = null;
    let highlightSpans = [];
    let highlightedRubyElement = null;
    let activePopupRubyElement = null;
    let highlightStyle = "yellow";
    let rubyHoverStyle = "ruby-red";
    let rubyRtBackground = "none";
    let currentWord = null;
    let currentActiveReading = null;
    let currentContextSentence = "";
    let hoverModifier = "none";
    let isMouseOverPopup = false;
    let hideTimeout = null;
    let justNavigated = false;
    let lastTabSwitchTime = 0;
    let compactExpandBtn = true;
    const EXPAND_GRACE_MS = 400;
    let expandGraceUntil = 0;
    let rubyFadeMask = null;
    let _currentSubwordRoot = "";
    let currentSubwordCandidates = [];
    let popupSubwordsFlyout = null;
    let flyoutHideTimeout = null;
    let lastPopupResult = null;
    let lastPopupRect = null;
    let lastTranslateRect = null;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let paragraphTransKey = "shift";
    let paragraphTransMode = "below";
    let paragraphTransEngine = "bing";
    let paragraphTransDirection = "yue_to_target";
    let paraTransSeq = 0;
    const pendingParaTrans = /* @__PURE__ */ new Map();
    let activeQAContext = {
      word: "",
      sentence: "",
      originalTranslation: "",
      history: []
    };
    function clearQAContext() {
      activeQAContext = {
        word: "",
        sentence: "",
        originalTranslation: "",
        history: []
      };
    }
    let transLangs = ["zh-Hans", "en"];
    let transTrigger = "dblclick";
    let transHoverEngine = "bing";
    let translatePopup = null;
    let pendingTranslateWord = null;
    let aiEnabled = false;
    let aiLongPressTimer = null;
    let aiAnimationTimer = null;
    let ignoreNextRubyClick = false;
    const popupI18n = {
      "zh-HK": {
        translating: "翻譯中...",
        mandarin: "普",
        english: "英",
        japanese: "日",
        korean: "韓",
        aiExplaining: "AI 釋義中...",
        noPronunciation: "找不到該詞的讀音",
        speak: "發音",
        copy: "複製",
        cantConnect: "無法連接字典伺服器",
        wordbookSaved: "已加入生詞本",
        wordbookExists: "此詞已在生詞本中",
        wordbookRemoved: "已從生詞本移除",
        wordbookSaveFailed: "收藏失敗，請重試",
        jyutpingLabel: "粵拼",
        seeAlsoCantonese: "粵語說法：",
        seeAlsoMandarin: "普通話：",
        seeAlsoSynonym: "近義：",
        seeAlsoAntonym: "反義：",
        seeAlsoVariant: "異體：",
        aiInputPlaceholder: "輸入追問... (Enter 發送)",
        speakThisPr: "點擊朗讀此讀音",
        badgeClickToTranslate: "點擊翻譯此釋義",
        retranslateAi: "點擊使用 AI 重新翻譯",
        hoverSubwords: "懸停查看相關詞與單字",
        sense: "釋義",
        examples: "例句",
        playExample: "播放例句"
      },
      "zh-CN": {
        translating: "翻译中...",
        mandarin: "普",
        english: "英",
        japanese: "日",
        korean: "韩",
        aiExplaining: "AI 释义中...",
        noPronunciation: "找不到该词的读音",
        speak: "发音",
        copy: "复制",
        cantConnect: "无法连接字典服务器",
        wordbookSaved: "已加入生词本",
        wordbookExists: "此词已在生词本中",
        wordbookRemoved: "已从生词本移除",
        wordbookSaveFailed: "收藏失败，请重试",
        jyutpingLabel: "粤拼",
        seeAlsoCantonese: "粤语说法：",
        seeAlsoMandarin: "普通话：",
        seeAlsoSynonym: "近义：",
        seeAlsoAntonym: "反义：",
        seeAlsoVariant: "异体：",
        aiInputPlaceholder: "输入追问... (Enter 发送)",
        speakThisPr: "点击朗读此读音",
        badgeClickToTranslate: "点击翻译此释义",
        retranslateAi: "点击使用 AI 重新翻译",
        hoverSubwords: "悬停查看相关词与单字",
        sense: "释义",
        examples: "例句",
        playExample: "播放例句"
      },
      "en": {
        translating: "Translating...",
        mandarin: "CN",
        english: "EN",
        japanese: "JA",
        korean: "KO",
        aiExplaining: "AI explaining...",
        noPronunciation: "Pronunciation not found",
        speak: "Speak",
        copy: "Copy",
        cantConnect: "Cannot connect to server",
        wordbookSaved: "Saved to Word Book",
        wordbookExists: "Already in Word Book",
        wordbookRemoved: "Removed from Word Book",
        wordbookSaveFailed: "Save failed, please retry",
        jyutpingLabel: "Jyutping",
        seeAlsoCantonese: "Cantonese:",
        seeAlsoMandarin: "Mandarin:",
        seeAlsoSynonym: "Synonyms:",
        seeAlsoAntonym: "Antonyms:",
        seeAlsoVariant: "Variants:",
        aiInputPlaceholder: "Ask follow-up question... (Enter to send)",
        speakThisPr: "Click to pronounce",
        badgeClickToTranslate: "Click to translate definition",
        retranslateAi: "Click to retranslate with AI",
        hoverSubwords: "Hover to view related words",
        sense: "Sense",
        examples: "Examples",
        playExample: "Play example audio"
      },
      "ja": {
        translating: "翻訳中...",
        mandarin: "普",
        english: "英",
        japanese: "日",
        korean: "韓",
        aiExplaining: "AI 解説中...",
        noPronunciation: "発音が見つかりません",
        speak: "発音",
        copy: "コピー",
        cantConnect: "サーバーに接続できません",
        wordbookSaved: "単語帳に保存しました",
        wordbookExists: "単語帳に登録済み",
        wordbookRemoved: "単語帳から削除しました",
        wordbookSaveFailed: "保存に失敗しました",
        jyutpingLabel: "広東語ピンイン",
        seeAlsoCantonese: "広東語：",
        seeAlsoMandarin: "普通話：",
        seeAlsoSynonym: "類義語：",
        seeAlsoAntonym: "対義語：",
        seeAlsoVariant: "異体字：",
        aiInputPlaceholder: "質問を入力... (Enter で送信)",
        speakThisPr: "クリックして発音を聴く",
        badgeClickToTranslate: "クリックして翻訳",
        retranslateAi: "クリックして AI で再翻訳",
        hoverSubwords: "ホバーして関連語句を表示",
        sense: "語義",
        examples: "例文",
        playExample: "例文を再生"
      },
      "ko": {
        translating: "번역 중...",
        mandarin: "普",
        english: "英",
        japanese: "日",
        korean: "韓",
        aiExplaining: "AI 설명 중...",
        noPronunciation: "발음을 찾을 수 없습니다",
        speak: "발음",
        copy: "복사",
        cantConnect: "서버에 연결할 수 없습니다",
        wordbookSaved: "단어장에 저장됨",
        wordbookExists: "이미 단어장에 있음",
        wordbookRemoved: "단어장에서 삭제됨",
        wordbookSaveFailed: "저장 실패, 다시 시도해주세요",
        jyutpingLabel: "쿳핑",
        seeAlsoCantonese: "광둥어 표현:",
        seeAlsoMandarin: "보통화:",
        seeAlsoSynonym: "유의어:",
        seeAlsoAntonym: "반의어:",
        seeAlsoVariant: "이체자:",
        aiInputPlaceholder: "추가 질문 입력... (Enter 전송)",
        speakThisPr: "클릭하여 발음 듣기",
        badgeClickToTranslate: "클릭하여 뜻 번역",
        retranslateAi: "클릭하여 AI 재번역",
        hoverSubwords: "마우스를 올려 관련 어휘 보기",
        sense: "의미",
        examples: "예문",
        playExample: "예문 재생"
      }
    };
    const POS_TRANSLATIONS = {
      "名詞": { "en": "Noun", "ja": "名詞", "ko": "명사", "zh-CN": "名词", "zh-HK": "名詞" },
      "動詞": { "en": "Verb", "ja": "動詞", "ko": "동사", "zh-CN": "动词", "zh-HK": "動詞" },
      "形容詞": { "en": "Adj", "ja": "形容詞", "ko": "형용사", "zh-CN": "形容词", "zh-HK": "形容詞" },
      "副詞": { "en": "Adv", "ja": "副詞", "ko": "부사", "zh-CN": "副词", "zh-HK": "副詞" },
      "數詞": { "en": "Num", "ja": "数詞", "ko": "수사", "zh-CN": "数词", "zh-HK": "數詞" },
      "量詞": { "en": "Clf", "ja": "量詞", "ko": "양사", "zh-CN": "量词", "zh-HK": "量詞" },
      "代詞": { "en": "Pron", "ja": "代名詞", "ko": "대명사", "zh-CN": "代词", "zh-HK": "代詞" },
      "介詞": { "en": "Prep", "ja": "前置詞", "ko": "전치사", "zh-CN": "介词", "zh-HK": "介詞" },
      "連詞": { "en": "Conj", "ja": "接続詞", "ko": "접속사", "zh-CN": "连词", "zh-HK": "連詞" },
      "助詞": { "en": "Part", "ja": "助詞", "ko": "조사", "zh-CN": "助词", "zh-HK": "助詞" },
      "嘆詞": { "en": "Interj", "ja": "感嘆詞", "ko": "감탄사", "zh-CN": "叹词", "zh-HK": "嘆詞" },
      "擬聲詞": { "en": "Onom", "ja": "擬声語", "ko": "의성어", "zh-CN": "拟声词", "zh-HK": "擬聲詞" },
      "語素": { "en": "Morph", "ja": "形態素", "ko": "형태소", "zh-CN": "语素", "zh-HK": "語素" },
      "成語": { "en": "Idiom", "ja": "成句", "ko": "성어", "zh-CN": "成语", "zh-HK": "成語" },
      "慣用語": { "en": "Phrase", "ja": "慣用句", "ko": "관용구", "zh-CN": "惯用语", "zh-HK": "慣用語" },
      "熟語": { "en": "Idiom", "ja": "熟語", "ko": "숙어", "zh-CN": "熟语", "zh-HK": "熟語" },
      "詞綴": { "en": "Affix", "ja": "接辞", "ko": "접사", "zh-CN": "词缀", "zh-HK": "詞綴" },
      "人名": { "en": "Name", "ja": "人名", "ko": "인명", "zh-CN": "人名", "zh-HK": "人名" },
      "地名": { "en": "Place", "ja": "地名", "ko": "지명", "zh-CN": "地名", "zh-HK": "地名" }
    };
    let currentLang = "zh-HK";
    function normalizeUiLang(lang) {
      if (!lang) return "zh-HK";
      if (lang === "zh-CN" || lang === "zh_CN" || lang === "zh-Hans") return "zh-CN";
      if (lang === "zh-TW" || lang === "zh_TW" || lang === "zh-HK" || lang === "zh-Hant") return "zh-HK";
      if (String(lang).startsWith("en")) return "en";
      if (String(lang).startsWith("ja")) return "ja";
      if (String(lang).startsWith("ko")) return "ko";
      return "zh-HK";
    }
    function translatePos(posStr) {
      if (!posStr) return pt("sense") || "釋義";
      const trimmed = String(posStr).trim();
      if (POS_TRANSLATIONS[trimmed] && POS_TRANSLATIONS[trimmed][currentLang]) {
        return POS_TRANSLATIONS[trimmed][currentLang];
      }
      return trimmed;
    }
    chrome.storage.local.get(["extensionLang", "uiLang"], (res) => {
      const raw = res.extensionLang || res.uiLang;
      if (raw) currentLang = normalizeUiLang(raw);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.extensionLang || changes.uiLang)) {
        const nextRaw = (changes.extensionLang || changes.uiLang).newValue;
        if (nextRaw) currentLang = normalizeUiLang(nextRaw);
      }
    });
    const pt = (key) => (popupI18n[currentLang] || popupI18n["zh-HK"])[key] || key;
    const toastI18n = {
      "zh-HK": {
        toastRubyEnabled: "全文粵語注音已開啟。<br>如遇排版重疊，請刷新網頁 (F5) 以適應高度。",
        toastRubyDisabled: "全文粵語注音已關閉。<br>如遇排版異常，請刷新網頁 (F5)。"
      },
      "zh-CN": {
        toastRubyEnabled: "全文粤语注音已开启。<br>如遇排版重叠，请刷新网页 (F5) 以适应高度。",
        toastRubyDisabled: "全文粤语注音已关闭。<br>如遇排版异常，请刷新网页 (F5)。"
      },
      "en": {
        toastRubyEnabled: "Full-page Cantonese Ruby enabled.<br>If layouts overlap, refresh page (F5) to adjust height.",
        toastRubyDisabled: "Full-page Cantonese Ruby disabled.<br>If layouts are abnormal, refresh page (F5)."
      },
      "ja": {
        toastRubyEnabled: "全ページ広東語ルビが有効になりました。<br>レイアウトが崩れる場合は、ページを更新 (F5) してください。",
        toastRubyDisabled: "全ページ広東語ルビが無効になりました。<br>表示がおかしい場合は、ページを更新 (F5) してください。"
      },
      "ko": {
        toastRubyEnabled: "전체 페이지 광둥어 발음기호가 활성화되었습니다.<br>레이아웃이 겹치면 페이지를 새로고침(F5) 해주세요.",
        toastRubyDisabled: "전체 페이지 광둥어 발음기호가 비활성화되었습니다.<br>표시가 비정상적이면 페이지를 새로고침(F5) 해주세요."
      }
    };
    const tt = (key) => (toastI18n[currentLang] || toastI18n["zh-HK"])[key] || key;
    const POPUP_THEMES = {
      classic: {
        name: "經典",
        vars: {
          "--popup-bg": "#ffffff",
          "--popup-border": "#d0d0d0",
          "--popup-text": "#333333",
          "--popup-text-muted": "#666666",
          "--popup-text-label": "#888888",
          "--popup-accent": "#2196f3",
          "--popup-accent-hover": "#1976d2",
          "--popup-word-color": "#1a1a1a",
          "--popup-def-color": "#555555",
          "--popup-def-yue": "#b8860b",
          "--popup-divider": "rgba(0, 0, 0, 0.08)",
          "--popup-divider-strong": "#eeeeee",
          "--popup-example-bg": "#f9f9f9",
          "--popup-btn-bg": "#f0f0f0",
          "--popup-btn-hover": "#e0e0e0",
          "--popup-btn-speaking": "#2196f3",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 4px 12px rgba(0, 0, 0, 0.15)",
          "--popup-active-bg": "#f0f7ff"
        }
      },
      academic: {
        name: "香港紅",
        vars: {
          "--popup-bg": "#ffeaeb",
          "--popup-border": "#fba5a8",
          "--popup-text": "#8A1C1C",
          "--popup-text-muted": "#d46a6a",
          "--popup-text-label": "#e38a8a",
          "--popup-accent": "#D83131",
          "--popup-accent-hover": "#8A1C1C",
          "--popup-word-color": "#610c0c",
          "--popup-def-color": "#8A1C1C",
          "--popup-def-yue": "#D83131",
          "--popup-divider": "rgba(138, 28, 28, 0.12)",
          "--popup-divider-strong": "#fccacc",
          "--popup-example-bg": "#fce1e3",
          "--popup-btn-bg": "#fce1e3",
          "--popup-btn-hover": "#fba5a8",
          "--popup-btn-speaking": "#D83131",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 4px 12px rgba(138, 28, 28, 0.2)",
          "--popup-active-bg": "#fce1e3"
        }
      },
      night: {
        name: "深邃夜色",
        vars: {
          "--popup-bg": "#1a1a2e",
          "--popup-border": "#16213e",
          "--popup-text": "#e0e0e0",
          "--popup-text-muted": "#a0a0b0",
          "--popup-text-label": "#8888a0",
          "--popup-accent": "#7c8cf8",
          "--popup-accent-hover": "#9aa6ff",
          "--popup-word-color": "#f0f0ff",
          "--popup-def-color": "#c0c0d0",
          "--popup-def-yue": "#e8b84e",
          "--popup-divider": "rgba(255, 255, 255, 0.08)",
          "--popup-divider-strong": "#2a2a40",
          "--popup-example-bg": "#141425",
          "--popup-btn-bg": "#2a2a40",
          "--popup-btn-hover": "#3a3a55",
          "--popup-btn-speaking": "#7c8cf8",
          "--popup-btn-speaking-text": "#1a1a2e",
          "--popup-shadow": "0 4px 16px rgba(0, 0, 0, 0.4)",
          "--popup-active-bg": "#222240"
        }
      },
      ink: {
        name: "墨韻",
        vars: {
          "--popup-bg": "#2d2d2d",
          "--popup-border": "#444444",
          "--popup-text": "#e0e0e0",
          "--popup-text-muted": "#aaaaaa",
          "--popup-text-label": "#999999",
          "--popup-accent": "#64b5f6",
          "--popup-accent-hover": "#90caf9",
          "--popup-word-color": "#f0f0f0",
          "--popup-def-color": "#cccccc",
          "--popup-def-yue": "#daa520",
          "--popup-divider": "rgba(255, 255, 255, 0.08)",
          "--popup-divider-strong": "#3d3d3d",
          "--popup-example-bg": "#252525",
          "--popup-btn-bg": "#444444",
          "--popup-btn-hover": "#555555",
          "--popup-btn-speaking": "#64b5f6",
          "--popup-btn-speaking-text": "#1a1a1a",
          "--popup-shadow": "0 4px 16px rgba(0, 0, 0, 0.4)",
          "--popup-active-bg": "#383838"
        }
      },
      dark: {
        name: "深色",
        vars: {
          "--popup-bg": "#1e1e1e",
          "--popup-border": "#333333",
          "--popup-text": "#e0e0e0",
          "--popup-text-muted": "#aaaaaa",
          "--popup-text-label": "#888888",
          "--popup-accent": "#ef4444",
          "--popup-accent-hover": "#f87171",
          "--popup-word-color": "#f5f5f5",
          "--popup-def-color": "#cccccc",
          "--popup-def-yue": "#d4af37",
          "--popup-divider": "rgba(255, 255, 255, 0.1)",
          "--popup-divider-strong": "#444444",
          "--popup-example-bg": "#2a2a2a",
          "--popup-btn-bg": "#333333",
          "--popup-btn-hover": "#444444",
          "--popup-btn-speaking": "#ef4444",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0px 4px 16px rgba(0, 0, 0, 0.5)",
          "--popup-active-bg": "#3f1a1a"
        }
      },
      ocean: {
        name: "海洋藍",
        vars: {
          "--popup-bg": "#e3f2fd",
          "--popup-border": "#90caf9",
          "--popup-text": "#1565c0",
          "--popup-text-muted": "#42a5f5",
          "--popup-text-label": "#64b5f6",
          "--popup-accent": "#0d47a1",
          "--popup-accent-hover": "#1565c0",
          "--popup-word-color": "#0d47a1",
          "--popup-def-color": "#1976d2",
          "--popup-def-yue": "#e65100",
          "--popup-divider": "rgba(13, 71, 161, 0.1)",
          "--popup-divider-strong": "#bbdefb",
          "--popup-example-bg": "#bbdefb",
          "--popup-btn-bg": "#bbdefb",
          "--popup-btn-hover": "#90caf9",
          "--popup-btn-speaking": "#1565c0",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 4px 12px rgba(21, 101, 192, 0.2)",
          "--popup-active-bg": "#bbdefb"
        }
      },
      warm: {
        name: "暖陽",
        vars: {
          "--popup-bg": "#fff8e1",
          "--popup-border": "#ffe082",
          "--popup-text": "#5d4037",
          "--popup-text-muted": "#8d6e63",
          "--popup-text-label": "#a1887f",
          "--popup-accent": "#e65100",
          "--popup-accent-hover": "#f57c00",
          "--popup-word-color": "#3e2723",
          "--popup-def-color": "#6d4c41",
          "--popup-def-yue": "#c62828",
          "--popup-divider": "rgba(93, 64, 55, 0.1)",
          "--popup-divider-strong": "#ffe0b2",
          "--popup-example-bg": "#fff3e0",
          "--popup-btn-bg": "#ffe0b2",
          "--popup-btn-hover": "#ffcc80",
          "--popup-btn-speaking": "#e65100",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 4px 12px rgba(230, 81, 0, 0.15)",
          "--popup-active-bg": "#fff3e0"
        }
      },
      mint: {
        name: "薄荷綠",
        vars: {
          "--popup-bg": "#e8f5e9",
          "--popup-border": "#a5d6a7",
          "--popup-text": "#2e7d32",
          "--popup-text-muted": "#4caf50",
          "--popup-text-label": "#66bb6a",
          "--popup-accent": "#1b5e20",
          "--popup-accent-hover": "#2e7d32",
          "--popup-word-color": "#1b5e20",
          "--popup-def-color": "#388e3c",
          "--popup-def-yue": "#bf360c",
          "--popup-divider": "rgba(46, 125, 50, 0.1)",
          "--popup-divider-strong": "#c8e6c9",
          "--popup-example-bg": "#c8e6c9",
          "--popup-btn-bg": "#c8e6c9",
          "--popup-btn-hover": "#a5d6a7",
          "--popup-btn-speaking": "#2e7d32",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 4px 12px rgba(46, 125, 50, 0.2)",
          "--popup-active-bg": "#c8e6c9"
        }
      },
      glass: {
        name: "毛玻璃",
        vars: {
          "--popup-bg": "rgba(255, 255, 255, 0.95)",
          "--popup-border": "rgba(255, 255, 255, 0.3)",
          "--popup-text": "#1F1F1F",
          "--popup-text-muted": "#555555",
          "--popup-text-label": "#777777",
          "--popup-accent": "#8A1C1C",
          "--popup-accent-hover": "#B42929",
          "--popup-word-color": "#111111",
          "--popup-def-color": "#333333",
          "--popup-def-yue": "#8A1C1C",
          "--popup-divider": "rgba(0, 0, 0, 0.06)",
          "--popup-divider-strong": "rgba(0, 0, 0, 0.08)",
          "--popup-example-bg": "rgba(255, 255, 255, 0.5)",
          "--popup-btn-bg": "rgba(0, 0, 0, 0.06)",
          "--popup-btn-hover": "rgba(0, 0, 0, 0.1)",
          "--popup-btn-speaking": "#8A1C1C",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 8px 32px rgba(0, 0, 0, 0.12)",
          "--popup-active-bg": "rgba(138, 28, 28, 0.08)"
        }
      }
    };
    function resolveEffectivePopupTheme(targetElement = null) {
      if (popupThemeMode === "auto_time") {
        const now = /* @__PURE__ */ new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        const [dH, dM] = (popupThemeDayStart || "07:00").split(":").map(Number);
        const [nH, nM] = (popupThemeNightStart || "19:00").split(":").map(Number);
        const dayStart = (dH || 7) * 60 + (dM || 0);
        const nightStart = (nH || 19) * 60 + (nM || 0);
        let isDay = false;
        if (dayStart < nightStart) {
          isDay = curMins >= dayStart && curMins < nightStart;
        } else {
          isDay = curMins >= dayStart || curMins < nightStart;
        }
        return isDay ? popupThemeDay || "classic" : popupThemeNight || "night";
      }
      if (popupThemeMode === "follow_system") {
        const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        return isDark ? popupThemeNight || "night" : popupThemeDay || "classic";
      }
      if (popupThemeMode === "follow_page") {
        const el = targetElement || (currentRange && currentRange.startContainer ? currentRange.startContainer.nodeType === Node.TEXT_NODE ? currentRange.startContainer.parentElement : currentRange.startContainer : document.body);
        const isDark = isElementOnDarkBackground(el);
        return isDark ? popupThemeNight || "night" : popupThemeDay || "classic";
      }
      return popupTheme || "classic";
    }
    function applyPopupTheme(themeName = null, targetElement = null) {
      if (!popup) return;
      const activeThemeName = themeName || resolveEffectivePopupTheme(targetElement);
      const theme = POPUP_THEMES[activeThemeName] || POPUP_THEMES.classic;
      for (const [prop, value] of Object.entries(theme.vars)) {
        popup.style.setProperty(prop, value);
        if (translatePopup) translatePopup.style.setProperty(prop, value);
      }
      popup.classList.remove("popup-theme-glass");
      if (translatePopup) translatePopup.classList.remove("popup-theme-glass");
      if (activeThemeName === "glass") {
        popup.classList.add("popup-theme-glass");
        if (translatePopup) translatePopup.classList.add("popup-theme-glass");
      }
      if (customZhFont) {
        popup.style.setProperty("--popup-font-zh", customZhFont);
        if (translatePopup) translatePopup.style.setProperty("--popup-font-zh", customZhFont);
      } else {
        popup.style.removeProperty("--popup-font-zh");
        if (translatePopup) translatePopup.style.removeProperty("--popup-font-zh");
      }
      if (customEnFont) {
        popup.style.setProperty("--popup-font-en", customEnFont);
        if (translatePopup) translatePopup.style.setProperty("--popup-font-en", customEnFont);
      } else {
        popup.style.removeProperty("--popup-font-en");
        if (translatePopup) translatePopup.style.removeProperty("--popup-font-en");
      }
    }
    const ttsCache = /* @__PURE__ */ new Map();
    const TTS_CACHE_MAX = 20;
    let pendingTtsText = "";
    let pendingTtsSessionId = -1;
    let shadowRoot = null;
    async function createShadowHost() {
      const oldHost = document.getElementById("jyutping-shadow-host");
      if (oldHost) oldHost.remove();
      const oldHostStyles = document.getElementById("jyutping-host-styles");
      if (oldHostStyles) oldHostStyles.remove();
      const host = document.createElement("div");
      host.id = "jyutping-shadow-host";
      host.style.cssText = "position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: visible; z-index: 2147483647; pointer-events: none;";
      shadowRoot = host.attachShadow({ mode: "closed" });
      try {
        const cssUrl = chrome.runtime.getURL("popup.css");
        const resp = await fetch(cssUrl);
        const cssText = await resp.text();
        const style = document.createElement("style");
        style.textContent = cssText;
        shadowRoot.appendChild(style);
      } catch (e) {
        console.error("[Jyutping] Failed to load popup.css into Shadow DOM:", e);
      }
      const hostStyle = document.createElement("style");
      hostStyle.id = "jyutping-host-styles";
      hostStyle.textContent = `
      @font-face {
        font-family: "HanaMinB";
        src: url("${chrome.runtime.getURL("fonts/HanaMinB.ttf")}");
        font-display: swap;
      }

      /* ========== 文字高亮樣式 ========== */
      ::highlight(jyutping-highlight),
      .jyutping-highlight {
        background-color: rgba(255, 220, 80, 0.45) !important;
        font-size: inherit !important;
      }
      .jyutping-highlight.hl-yellow { background-color: rgba(255, 220, 80, 0.45) !important; }
      .jyutping-highlight.hl-blue { background-color: rgba(96, 165, 250, 0.35) !important; }
      .jyutping-highlight.hl-red { background-color: rgba(248, 113, 113, 0.35) !important; }
      .jyutping-highlight.hl-green { background-color: rgba(74, 222, 128, 0.35) !important; }
      .jyutping-highlight.hl-gray { background-color: rgba(156, 163, 175, 0.3) !important; }
      .jyutping-highlight.hl-underline-dashed {
        background-color: transparent !important;
        text-decoration: underline dashed !important;
        text-decoration-color: #888 !important;
        text-underline-offset: 3px !important;
        text-decoration-thickness: 1.5px !important;
      }
      .jyutping-highlight.hl-border-dashed {
        background-color: transparent !important;
        outline: 1.5px dashed #888 !important;
        outline-offset: 2px !important;
        border-radius: 3px !important;
      }

      /* ========== AI 長按進度環 ========== */
      #jyutping-longpress-ring {
        position: fixed !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        width: 28px !important; height: 28px !important;
        transform: translate(-50%, -50%) scale(1) !important;
        opacity: 0 !important;
        transition: opacity 0.1s ease, transform 0s !important;
        display: block !important;
      }
      #jyutping-longpress-ring.active {
        opacity: 1 !important;
        transform: translate(-50%, -50%) scale(1) !important;
        transition: opacity 0.1s ease, transform 0s !important;
      }
      #jyutping-longpress-ring.done {
        opacity: 0 !important;
        transform: translate(-50%, -50%) scale(1) !important;
        transition: opacity 0.2s ease-out !important;
      }
      #jyutping-longpress-ring svg {
        display: block !important; width: 28px !important; height: 28px !important; overflow: visible !important;
      }
      #jyutping-longpress-ring .ring-track {
        fill: none !important; stroke: rgba(0, 0, 0, 0.1) !important; stroke-width: 3 !important;
      }
      #jyutping-longpress-ring .ring-progress {
        fill: none !important; stroke: rgba(138, 28, 28, 0.85) !important; stroke-width: 3 !important;
        stroke-linecap: round !important; stroke-dasharray: 69.115 !important; stroke-dashoffset: 69.115 !important;
        transform: rotate(-90deg) !important; transform-origin: center !important; transition: stroke-dashoffset 0s !important;
      }
      #jyutping-longpress-ring.active .ring-progress {
        stroke-dashoffset: 0 !important; transition: stroke-dashoffset 500ms linear !important;
      }

      /* ========== Toast 提示框 ========== */
      #jyutping-toast-container {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 2147483647; display: flex; flex-direction: column;
        align-items: center; gap: 8px; pointer-events: none;
      }
      .jyutping-toast {
        display: inline-flex; align-items: center; gap: 8px;
        background: rgba(30, 30, 30, 0.88); color: #f0f0f0;
        border: none; border-radius: 20px; padding: 8px 18px 8px 14px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 13px; font-weight: 500; line-height: 1.4;
        max-width: 320px; word-wrap: break-word; pointer-events: auto;
        opacity: 0; transform: translateY(-12px) scale(0.95);
        transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .jyutping-toast.show { opacity: 1; transform: translateY(0) scale(1); }
      .jyutping-toast-success { background: rgba(120, 30, 30, 0.72) !important; color: #fff !important; backdrop-filter: blur(16px) saturate(180%) !important; -webkit-backdrop-filter: blur(16px) saturate(180%) !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; }
      .jyutping-toast-error { background: rgba(60, 60, 60, 0.92) !important; color: #f0f0f0 !important; }

      /* ========== Translation Highlight ========== */
      ::highlight(jyutping-translate-hl) {
        background-color: rgba(255, 213, 79, 0.5) !important;
        color: inherit !important;
      }

      /* ========== 懸停注音 (Ruby) 樣式 ========== */
      ruby.jyutping-hover-ruby {
        cursor: pointer; line-height: inherit; position: relative !important; display: inline !important;
      }
      /* 提升層級以保證高亮樣式正常顯示 */
      ruby.jyutping-hover-ruby:hover,
      ruby.jyutping-hover-ruby.jyutping-popup-active {
        z-index: 2147483640 !important;
      }
      ruby.jyutping-hover-ruby:hover,
      ruby.jyutping-hover-ruby.jyutping-popup-active {
        color: var(--ruby-hover-color, #8A1C1C) !important;
      }
      ruby.jyutping-hover-ruby.hl-ruby-red { --ruby-hover-color: #8A1C1C; }
      ruby.jyutping-hover-ruby.hl-ruby-blue { --ruby-hover-color: #1565C0; }
      ruby.jyutping-hover-ruby.hl-ruby-green { --ruby-hover-color: #2E7D32; }
      ruby.jyutping-hover-ruby.hl-ruby-orange { --ruby-hover-color: #E65100; }
      ruby.jyutping-hover-ruby.hl-ruby-purple { --ruby-hover-color: #6A1B9A; }
      /* 暗色背景自適應：覆寫為亮色 */
      ruby.jyutping-hover-ruby.dark-bg { --ruby-hover-color: #FFD54F; }
      ruby.jyutping-hover-ruby.hl-ruby-underline:hover,
      ruby.jyutping-hover-ruby.hl-ruby-underline.jyutping-popup-active {
        text-decoration: underline dashed var(--ruby-hover-color, #8A1C1C) !important;
        text-underline-offset: 3px !important; text-decoration-thickness: 1.5px !important;
      }
      ruby.jyutping-hover-ruby.hl-ruby-border:hover,
      ruby.jyutping-hover-ruby.hl-ruby-border.jyutping-popup-active {
        outline: 1.5px dashed var(--ruby-hover-color, #8A1C1C) !important;
        outline-offset: 1px !important; border-radius: 3px !important;
      }

      /* ========== 全文注音 (Ruby) 樣式 ========== */
      ruby.jyutping-ruby-injected {
        ruby-align: center; ruby-position: over;
        line-height: 2.0 !important; margin: 0 0.15em !important; cursor: pointer;
      }
      ruby.jyutping-ruby-injected:hover,
      ruby.jyutping-ruby-injected.jyutping-popup-active,
      ruby.jyutping-ruby-injected:hover rt,
      ruby.jyutping-ruby-injected.jyutping-popup-active rt {
        color: #991b1b !important;
      }
      ruby.jyutping-ruby-injected:hover.jyutping-clicked-hover rt {
        opacity: 1 !important;
      }
      /* 暗色背景自適應 */
      ruby.jyutping-ruby-injected.dark-bg:hover,
      ruby.jyutping-ruby-injected.dark-bg.jyutping-popup-active,
      ruby.jyutping-ruby-injected.dark-bg:hover rt,
      ruby.jyutping-ruby-injected.dark-bg.jyutping-popup-active rt {
        color: #FFD54F !important;
      }
      ruby.jyutping-ruby-injected.dark-bg:hover.jyutping-clicked-hover rt,
      ruby.jyutping-ruby-injected.dark-bg.speaking rt {
        opacity: 1 !important;
      }
      ruby.jyutping-ruby-injected:hover.jyutping-clicked-hover rt,
      ruby.jyutping-ruby-injected.speaking rt {
        opacity: 1 !important;
      }
      ruby.jyutping-ruby-injected rt {
        font-family: var(--jyutping-rt-font, system-ui, -apple-system, sans-serif) !important;
        font-size: 0.5em !important;
        font-weight: var(--jyutping-rt-font-weight, normal) !important;
        font-style: var(--jyutping-rt-font-style, normal) !important;
        letter-spacing: -0.05em !important; padding: 0 0.15em !important;
        color: var(--jyutping-rt-color, inherit) !important;
        opacity: var(--jyutping-rt-opacity, 0.6) !important;
        user-select: none; white-space: nowrap !important;
        transform: scale(0.9); transform-origin: center bottom;
      }

      /* ========== 段落粵語翻譯（內聯於原文下方，灰色半透明以示區別）========== */
      .jyutping-cantonese-trans {
        opacity: 0.65 !important;
        margin-top: 0.15em !important;
        /* 繼承自原塊的字體/排版（淺克隆保留了 class），此處僅淡化以示區別 */
      }
      .jyutping-cantonese-trans-replace {
        opacity: 1 !important;
        margin-top: 0 !important;
      }
      .jyutping-cantonese-trans .jyutping-cantonese-trans-loading {
        opacity: 0.85;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        width: fit-content !important;
      }
      .jyutping-loading-spinner {
        display: inline-block !important;
        width: 14px !important;
        height: 14px !important;
        margin: 0 !important;
        padding: 0 !important;
        flex-shrink: 0 !important;
        border: 2px solid currentColor !important;
        border-right-color: transparent !important;
        border-radius: 50% !important;
        animation: jyutping-spin 0.75s linear infinite !important;
      }
      @keyframes jyutping-spin {
        100% { transform: rotate(360deg); }
      }
      
      /* Speaker Button in Paragraph Translation */
      .jyutping-speaker-btn {
        background: transparent; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 2px; margin-left: 6px; color: inherit; opacity: 0.6; transition: opacity 0.2s, color 0.2s; vertical-align: middle;
      }
      .jyutping-speaker-btn:hover {
        opacity: 1;
      }
      .jyutping-speaker-btn .tts-wave {
        opacity: 0.4;
        transition: opacity 0.2s;
      }
      .jyutping-speaker-btn:hover .tts-wave {
        opacity: 0.8;
      }
      .jyutping-speaker-btn.speaking {
        color: #8A1C1C !important;
        opacity: 1;
      }
      .jyutping-speaker-btn.speaking .tts-wave-1 {
        animation: tts-wave-anim 1.5s infinite;
      }
      .jyutping-speaker-btn.speaking .tts-wave-2 {
        animation: tts-wave-anim 1.5s infinite 0.3s;
      }
      @keyframes tts-wave-anim {
        0%, 100% { opacity: 0; }
        50% { opacity: 1; }
      }
    `;
      document.head.appendChild(hostStyle);
      document.body.appendChild(host);
    }
    async function init() {
      await createShadowHost();
      createPopup();
      createTranslatePopup();
      loadSettings();
      setupEventListeners();
      if (isFullPageRubyActive && isEnabled) {
        await loadDictionary();
        console.log("[Content] Auto-restoring Jyutping Full Page Ruby from sessionStorage");
        injectRubyAnnotations(document.body);
        startRubyObserver();
      }
    }
    let hasUserSelection = false;
    function createTranslatePopup() {
      translatePopup = document.createElement("div");
      translatePopup.id = "cantonese-translate-popup";
      translatePopup.style.display = "none";
      translatePopup.style.position = "absolute";
      translatePopup.style.left = "-9999px";
      translatePopup.style.top = "-9999px";
      shadowRoot.appendChild(translatePopup);
      translatePopup.addEventListener("mousedown", (e) => {
        if (e.target.closest(".popup-qa-container")) {
          e.stopPropagation();
          return;
        }
        const tag = e.target.tagName.toLowerCase();
        if (tag === "textarea" || tag === "input") {
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      });
      translatePopup.addEventListener("mouseenter", () => {
        isMouseOverPopup = true;
        cancelScheduledHide();
      });
      translatePopup.addEventListener("mouseleave", () => {
        isMouseOverPopup = false;
        if (Date.now() - lastPopupShowTime < 400) return;
        scheduleHidePopup();
      });
      translatePopup.addEventListener("dblclick", (e) => {
        if (e.target.closest("textarea") || e.target.closest("input") || e.target.closest("button")) {
          return;
        }
        e.stopPropagation();
        showPopupQA(translatePopup);
      });
    }
    let longPressRing = null;
    function createLongPressRing() {
      if (longPressRing) return;
      longPressRing = document.createElement("div");
      longPressRing.id = "jyutping-longpress-ring";
      longPressRing.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(139, 92, 246, 0.2)" stroke-width="3"></circle>
        <circle class="ring-progress" cx="14" cy="14" r="12" fill="none" stroke="#8b5cf6" stroke-width="3" 
          stroke-dasharray="75.4" stroke-dashoffset="75.4" stroke-linecap="round" 
          transform="rotate(-90 14 14)"></circle>
      </svg>
    `;
      document.body.appendChild(longPressRing);
    }
    function startLongPressAnimation(x, y) {
      if (!longPressRing) createLongPressRing();
      longPressRing.style.left = x + "px";
      longPressRing.style.top = y + "px";
      longPressRing.classList.remove("done");
      longPressRing.offsetHeight;
      longPressRing.classList.add("active");
    }
    function cancelLongPressAnimation() {
      if (aiAnimationTimer) {
        clearTimeout(aiAnimationTimer);
        aiAnimationTimer = null;
      }
      if (!longPressRing) return;
      longPressRing.classList.remove("active");
      longPressRing.classList.remove("done");
      longPressRing.style.opacity = "0";
      const progressCircle = longPressRing.querySelector(".ring-progress");
      if (progressCircle) {
        progressCircle.style.transition = "none";
        progressCircle.style.strokeDashoffset = "69.1";
      }
    }
    function getBestRectForRange(range) {
      if (!range) {
        console.log("[Debug] getBestRectForRange: range is null");
        return null;
      }
      const rects = Array.from(range.getClientRects());
      console.log("[Debug] getBestRectForRange: rects count =", rects.length);
      if (rects.length > 1) {
        console.log("[Debug] getBestRectForRange: multiple rects detected", rects);
      }
      if (rects.length === 0) return null;
      if (rects.length === 1) return rects[0];
      if (currentMouseX === 0 && currentMouseY === 0) {
        console.log("[Debug] getBestRectForRange: mouse position is 0, returning bounding box", range.getBoundingClientRect());
        return range.getBoundingClientRect();
      }
      let bestRect = rects[0];
      let minDistance = Infinity;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const dx = Math.max(rect.left - currentMouseX, 0, currentMouseX - rect.right);
        const dy = Math.max(rect.top - currentMouseY, 0, currentMouseY - rect.bottom);
        const dist = dx * dx + dy * dy;
        if (dist < minDistance) {
          minDistance = dist;
          bestRect = rect;
        }
      }
      let minX = bestRect.left;
      let maxX = bestRect.right;
      let minY = bestRect.top;
      let maxY = bestRect.bottom;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.bottom > bestRect.top && rect.top < bestRect.bottom) {
          minX = Math.min(minX, rect.left);
          maxX = Math.max(maxX, rect.right);
          minY = Math.min(minY, rect.top);
          maxY = Math.max(maxY, rect.bottom);
        }
      }
      const finalRect = {
        left: minX,
        right: maxX,
        top: minY,
        bottom: maxY,
        width: maxX - minX,
        height: maxY - minY
      };
      console.log("[Debug] getBestRectForRange: returning merged finalRect", finalRect);
      return finalRect;
    }
    function positionTranslatePopup(rect) {
      if (!rect) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popupWidth = translatePopup.offsetWidth || 200;
      const popupHeight = translatePopup.offsetHeight || 60;
      const ARROW_HEIGHT = 8;
      const GAP = 2;
      let left;
      let top;
      let arrowDirection = "up";
      const highlightCenterX = rect.left + rect.width / 2;
      left = highlightCenterX - popupWidth / 2;
      if (left + popupWidth > viewportWidth - 5) left = viewportWidth - popupWidth - 5;
      if (left < 5) left = 5;
      if (rect.bottom + GAP + ARROW_HEIGHT + popupHeight <= viewportHeight) {
        top = rect.bottom + GAP + ARROW_HEIGHT;
        arrowDirection = "up";
      } else {
        top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
        arrowDirection = "down";
        if (top < 5) {
          top = 5;
          arrowDirection = "up";
        }
      }
      translatePopup.style.position = "absolute";
      translatePopup.style.left = Math.max(5, left + window.scrollX) + "px";
      translatePopup.style.top = top + window.scrollY + "px";
      const translatePopupArrow = translatePopup.querySelector(".popup-arrow");
      if (translatePopupArrow) {
        translatePopupArrow.className = "popup-arrow popup-arrow-" + arrowDirection;
        let arrowCenter = highlightCenterX - left;
        arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
        translatePopupArrow.style.left = arrowCenter + "px";
      }
    }
    function requestTranslation(text) {
      if (!transLangs || transLangs.length === 0) return;
      const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length;
      if (chineseRatio < 0.3) return;
      if (transHoverEngine === "ai" && aiEnabled) {
        let fakeTranslations = {};
        transLangs.forEach((lang) => {
          fakeTranslations[lang] = "AI 翻譯中...";
        });
        showTranslatePopup(text, fakeTranslations, false);
        let rows;
        if (translatePopup && translatePopup.style.display !== "none") {
          rows = translatePopup.querySelectorAll(".translate-row");
        } else if (popup && popup.style.display !== "none") {
          rows = popup.querySelectorAll(".translate-row");
        }
        if (rows) {
          rows.forEach((row) => {
            const textEl = row.querySelector(".translate-text");
            const labelEl = row.querySelector(".translate-label");
            const key = row.dataset.key;
            if (textEl) textEl.style.opacity = "0.5";
            if (labelEl) {
              let labelName = "AI";
              if (key === "zh-Hans") labelName = pt("mandarin");
              else if (key === "en") labelName = pt("english");
              else if (key === "ja") labelName = pt("japanese");
              else if (key === "ko") labelName = pt("korean");
              labelEl.textContent = labelName;
              labelEl.classList.add("translate-label-ai");
              labelEl.title = "點擊使用 Bing 重新翻譯";
            }
          });
        }
        transLangs.forEach((lang) => {
          let langName = "";
          if (lang === "zh-Hans") langName = "現代標準漢語（普通話）";
          else if (lang === "en") langName = "英文";
          else if (lang === "ja") langName = "日文";
          else if (lang === "ko") langName = "韓文";
          chrome.runtime.sendMessage({
            action: "aiTranslateSentenceLang",
            text,
            targetLang: langName,
            key: lang
          });
        });
      } else {
        showTranslatePopup(text, null, true);
        chrome.runtime.sendMessage({
          action: "translate",
          text,
          transLangs
        });
      }
    }
    function showTranslatePopup(originalText, translations, loading) {
      cancelScheduledHide();
      lastPopupShowTime = Date.now();
      if (originalText !== null) {
        activeQAContext.word = "";
        activeQAContext.sentence = originalText;
        activeQAContext.history = [];
      }
      if (!loading && translations) {
        activeQAContext.originalTranslation = Object.values(translations).join("; ");
      }
      if (popup && popup.style.display !== "none" && !popup.classList.contains("compact-mode") && !popup.classList.contains("popup-ruby-mode")) {
        const translateDiv = popup.querySelector(".popup-translate");
        if (translateDiv) {
          if (loading) {
            translateDiv.innerHTML = `<div class="translate-loading">${pt("translating")}</div>`;
          } else {
            let rows = "";
            if (translations) {
              const keys = Object.keys(translations);
              for (const key of keys) {
                let label = "";
                let langName = "";
                if (key === "zh-Hans") {
                  label = pt("mandarin");
                  langName = "現代標準漢語（普通話）";
                } else if (key === "en") {
                  label = pt("english");
                  langName = "英文";
                } else if (key === "ja") {
                  label = pt("japanese");
                  langName = "日文";
                } else if (key === "ko") {
                  label = pt("korean");
                  langName = "韓文";
                }
                rows += `<div class="translate-row" data-key="${key}" data-lang="${langName}"><span class="translate-label translate-label-${key}" title="點擊使用 AI 重新翻譯" style="cursor: pointer;">${label}</span><span class="translate-text">${translations[key] || ""}</span></div>`;
              }
            }
            translateDiv.innerHTML = rows;
            translateDiv.querySelectorAll(".translate-label").forEach((labelEl) => {
              labelEl.addEventListener("click", (e) => {
                e.stopPropagation();
                const row = labelEl.closest(".translate-row");
                const key = row.dataset.key;
                const langName = row.dataset.lang;
                const textEl = row.querySelector(".translate-text");
                if (popup) popup.classList.add("jyutping-popup-pinned");
                if (translatePopup) translatePopup.classList.add("jyutping-popup-pinned");
                if (labelEl.classList.contains("translate-label-ai")) {
                  labelEl.classList.remove("translate-label-ai");
                  if (key === "zh-Hans") labelEl.textContent = pt("mandarin");
                  else if (key === "en") labelEl.textContent = pt("english");
                  else if (key === "ja") labelEl.textContent = pt("japanese");
                  else if (key === "ko") labelEl.textContent = pt("korean");
                  labelEl.title = "點擊使用 AI 重新翻譯";
                  if (textEl) {
                    textEl.textContent = "Bing 翻譯中...";
                    textEl.style.opacity = "0.5";
                  }
                  chrome.runtime.sendMessage({
                    action: "bingTranslateSentenceLang",
                    text: activeQAContext.sentence,
                    targetLang: key,
                    key
                  });
                } else {
                  if (textEl) {
                    textEl.textContent = "AI 翻譯中...";
                    textEl.style.opacity = "0.5";
                  }
                  let labelName = "AI";
                  if (key === "zh-Hans") labelName = pt("mandarin");
                  else if (key === "en") labelName = pt("english");
                  else if (key === "ja") labelName = pt("japanese");
                  else if (key === "ko") labelName = pt("korean");
                  labelEl.textContent = labelName;
                  labelEl.title = "點擊使用 Bing 重新翻譯";
                  labelEl.classList.add("translate-label-ai");
                  chrome.runtime.sendMessage({
                    action: "aiTranslateSentenceLang",
                    text: activeQAContext.sentence,
                    targetLang: labelName,
                    key
                  });
                }
              });
            });
          }
          translateDiv.style.display = "block";
          return;
        }
      }
      if (!translatePopup) return;
      let innerContent = "";
      if (loading) {
        innerContent = `
        <div class="translate-header">${pt("translating")}</div>
        <div class="translate-body" style="opacity:0.5;">${originalText}</div>
      `;
      } else {
        let rows = "";
        if (translations) {
          const keys = Object.keys(translations);
          for (const key of keys) {
            let label = "";
            let langName = "";
            if (key === "zh-Hans") {
              label = pt("mandarin");
              langName = "現代標準漢語（普通話）";
            } else if (key === "en") {
              label = pt("english");
              langName = "英文";
            } else if (key === "ja") {
              label = pt("japanese");
              langName = "日文";
            } else if (key === "ko") {
              label = pt("korean");
              langName = "韓文";
            }
            rows += `<div class="translate-row" data-key="${key}" data-lang="${langName}"><span class="translate-label translate-label-${key}" title="點擊使用 AI 重新翻譯" style="cursor: pointer;">${label}</span><span class="translate-text">${translations[key] || ""}</span></div>`;
          }
        }
        innerContent = rows;
      }
      translatePopup.innerHTML = `
      <div class="popup-inner">
        ${innerContent}
      </div>
      <div class="popup-arrow"></div>
    `;
      translatePopup.querySelectorAll(".translate-label").forEach((labelEl) => {
        labelEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const row = labelEl.closest(".translate-row");
          if (!row) return;
          const key = row.dataset.key;
          const langName = row.dataset.lang;
          const textEl = row.querySelector(".translate-text");
          if (popup) popup.classList.add("jyutping-popup-pinned");
          if (translatePopup) translatePopup.classList.add("jyutping-popup-pinned");
          if (labelEl.classList.contains("translate-label-ai")) {
            labelEl.classList.remove("translate-label-ai");
            if (key === "zh-Hans") labelEl.textContent = pt("mandarin");
            else if (key === "en") labelEl.textContent = pt("english");
            else if (key === "ja") labelEl.textContent = pt("japanese");
            else if (key === "ko") labelEl.textContent = pt("korean");
            labelEl.title = "點擊使用 AI 重新翻譯";
            if (textEl) {
              textEl.textContent = "Bing 翻譯中...";
              textEl.style.opacity = "0.5";
            }
            chrome.runtime.sendMessage({
              action: "bingTranslateSentenceLang",
              text: activeQAContext.sentence,
              targetLang: key,
              key
            });
          } else {
            if (textEl) {
              textEl.textContent = "AI 翻譯中...";
              textEl.style.opacity = "0.5";
            }
            let labelName = "AI";
            if (key === "zh-Hans") labelName = pt("mandarin");
            else if (key === "en") labelName = pt("english");
            else if (key === "ja") labelName = pt("japanese");
            else if (key === "ko") labelName = pt("korean");
            labelEl.textContent = labelName;
            labelEl.title = "點擊使用 Bing 重新翻譯";
            labelEl.classList.add("translate-label-ai");
            chrome.runtime.sendMessage({
              action: "aiTranslateSentenceLang",
              text: activeQAContext.sentence,
              targetLang: labelName,
              key
            });
          }
        });
      });
      translatePopup.style.display = "block";
      translatePopup.style.setProperty("width", "max-content", "important");
      translatePopup.style.setProperty("min-width", "0", "important");
      translatePopup.style.setProperty("max-width", "320px", "important");
      const inner = translatePopup.querySelector(".popup-inner");
      if (inner) {
        inner.style.setProperty("width", "auto", "important");
        inner.style.setProperty("max-width", "100%", "important");
        inner.style.setProperty("min-width", "0", "important");
        inner.style.setProperty("box-sizing", "border-box", "important");
      }
      if (typeof popupTheme !== "undefined") applyPopupTheme(popupTheme);
      let posRect = null;
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        posRect = getBestRectForRange(range);
        if (typeof CSS !== "undefined" && CSS.highlights) {
          try {
            const highlight = new Highlight(range);
            CSS.highlights.set("jyutping-translate-hl", highlight);
          } catch (e) {
            console.warn("CSS Custom Highlights API failed:", e);
          }
        }
      }
      if (!posRect && typeof currentRange !== "undefined" && currentRange) {
        posRect = getBestRectForRange(currentRange);
      }
      if (posRect) {
        lastTranslateRect = posRect;
        positionTranslatePopup(posRect);
      }
    }
    function hideTranslatePopup() {
      if (translatePopup) {
        translatePopup.classList.remove("jyutping-popup-pinned");
        translatePopup.style.display = "none";
        translatePopup.style.removeProperty("width");
        translatePopup.style.removeProperty("min-width");
        translatePopup.style.removeProperty("max-width");
        const inner = translatePopup.querySelector(".popup-inner");
        if (inner) {
          inner.style.removeProperty("width");
          inner.style.removeProperty("max-width");
          inner.style.removeProperty("min-width");
          inner.style.removeProperty("box-sizing");
        }
        const qaContainer = translatePopup.querySelector(".popup-qa-container");
        if (qaContainer) {
          qaContainer.remove();
        }
        const qaUpperDisplay = translatePopup.querySelector(".qa-upper-display");
        if (qaUpperDisplay) {
          qaUpperDisplay.remove();
        }
        if (inner) {
          Array.from(inner.children).forEach((child) => {
            if (child.className !== "popup-qa-container" && child.className !== "qa-upper-display") {
              child.style.display = "";
            }
          });
        }
      }
      if (typeof CSS !== "undefined" && CSS.highlights) {
        CSS.highlights.delete("jyutping-translate-hl");
      }
      clearQAContext();
    }
    function getSurroundingSentence(rangeToUse) {
      let targetNode = null;
      if (rangeToUse) {
        try {
          targetNode = rangeToUse.startContainer;
        } catch (e) {
        }
      }
      if (!targetNode) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          try {
            targetNode = selection.getRangeAt(0).startContainer;
          } catch (e) {
          }
        }
      }
      if (!targetNode) return "";
      const blockTags = ["P", "DIV", "LI", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "ARTICLE", "SECTION"];
      let el = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;
      while (el && !blockTags.includes(el.tagName)) {
        el = el.parentElement;
      }
      if (!el) {
        el = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;
      }
      const text = (el.textContent || "").trim();
      return text.length > 500 ? text.substring(0, 500) + "..." : text;
    }
    function requestAiTranslation(word, rectOverride = null) {
      if (!word) return;
      const sentence = getSurroundingSentence(currentRange);
      console.log("[AI] requestAiTranslation, word:", word, "sentence:", sentence.substring(0, 80));
      activeQAContext.word = word;
      activeQAContext.sentence = sentence;
      activeQAContext.originalTranslation = "AI 翻譯中...";
      activeQAContext.history = [];
      let targetRect = rectOverride;
      if (!targetRect) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
          targetRect = getBestRectForRange(selection.getRangeAt(0));
        } else if (typeof currentRange !== "undefined" && currentRange) {
          targetRect = getBestRectForRange(currentRange);
        }
      }
      activeQAContext.targetRect = targetRect;
      if (translatePopup && translatePopup.style.display !== "none") {
        translatePopup.innerHTML = "";
        translatePopup.style.display = "none";
      }
      showAiResult(word, "✨ AI 分析中...", targetRect);
      chrome.runtime.sendMessage({
        action: "aiTranslate",
        word,
        sentence
      });
    }
    function showAiResult(word, explanation, targetRect = null) {
      let textToRender = explanation;
      if (!explanation.startsWith("✨") && !explanation.startsWith("❌")) {
        textToRender = "✨ " + explanation;
      }
      const renderedText = renderMarkdown(textToRender);
      if (popup && popup.style.display !== "none" && !popup.classList.contains("compact-mode") && !popup.classList.contains("popup-ruby-mode")) {
        const translateDiv = popup.querySelector(".popup-translate");
        if (translateDiv) {
          const existingAiText = translateDiv.querySelector(".ai-text");
          if (existingAiText) {
            existingAiText.innerHTML = renderedText;
          } else {
            translateDiv.innerHTML = `
            <div class="ai-result">
              <div class="ai-text" style="white-space: pre-wrap;">${renderedText}</div>
            </div>
          `;
          }
          translateDiv.style.display = "block";
          return;
        }
      }
      if (!translatePopup) return;
      if (translatePopup.style.display !== "none") {
        const aiText = translatePopup.querySelector(".ai-text");
        const isQA = translatePopup.querySelector(".popup-qa-container");
        if (aiText && !isQA) {
          aiText.innerHTML = renderedText;
          const finalRect = targetRect || lastTranslateRect;
          if (finalRect) {
            lastTranslateRect = finalRect;
            positionTranslatePopup(finalRect);
          }
          return;
        }
      }
      translatePopup.innerHTML = `
      <div class="popup-inner">
        <div class="ai-result">
          <div class="ai-text" style="white-space: pre-wrap;">${renderedText}</div>
        </div>
      </div>
      <div class="popup-arrow"></div>
    `;
      translatePopup.style.display = "block";
      translatePopup.style.setProperty("width", "max-content", "important");
      translatePopup.style.setProperty("min-width", "0", "important");
      translatePopup.style.setProperty("max-width", "320px", "important");
      const inner = translatePopup.querySelector(".popup-inner");
      if (inner) {
        inner.style.setProperty("width", "auto", "important");
        inner.style.setProperty("max-width", "100%", "important");
        inner.style.setProperty("min-width", "0", "important");
        inner.style.setProperty("box-sizing", "border-box", "important");
      }
      if (typeof popupTheme !== "undefined") applyPopupTheme(popupTheme);
      let posRect = targetRect;
      if (!posRect) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          posRect = getBestRectForRange(range);
        }
        if (!posRect && typeof currentRange !== "undefined" && currentRange) {
          posRect = getBestRectForRange(currentRange);
        }
        if (!posRect && lastTranslateRect) {
          posRect = lastTranslateRect;
        }
      }
      if (posRect) {
        lastTranslateRect = posRect;
        positionTranslatePopup(posRect);
      }
    }
    async function saveCurrentWordToWordbook(overrideEntry) {
      const word = currentWord;
      if (!word) return;
      const entry = overrideEntry || dictionary && dictionary[word];
      try {
        const reading = !overrideEntry && currentActiveReading && currentActiveReading.word === word ? currentActiveReading : null;
        const result = await addWord({
          character: word,
          simplified: entry ? entry.simplified : word,
          jyutping: reading ? reading.jyutping : entry ? entry.jyutping : "",
          yale: reading ? reading.yale || jyutpingToYale(reading.jyutping) : entry ? jyutpingToYale(entry.jyutping) : "",
          english: reading ? reading.english || [] : entry ? entry.english || [] : [],
          sourceUrl: window.location.href,
          sourceTitle: document.title
        });
        updateBookmarkBtnState(true);
        if (result.isNew) {
          showToast(pt("wordbookSaved"), 1500, "success");
        } else {
          showToast(pt("wordbookExists"), 1500, "success");
        }
      } catch (e) {
        console.error("[Wordbook] Save failed:", e);
        showToast(pt("wordbookSaveFailed"), 1500, "error");
      }
    }
    function updateBookmarkBtnState(isSaved) {
      if (!popup) return;
      const btn = popup.querySelector(".popup-bookmark-btn");
      if (!btn) return;
      const svg = btn.querySelector("svg");
      if (!svg) return;
      if (isSaved) {
        svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#D4AF37" stroke="#D4AF37" stroke-width="1.5"></polygon>';
        btn.title = pt("wordbookRemoved").replace("已從", "從").replace("移除", "生詞本移除");
      } else {
        svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>';
        btn.title = pt("wordbookSaved");
      }
    }
    function createPopup() {
      let existingPopup = document.getElementById("cantonese-popup-dict");
      if (existingPopup) {
        existingPopup.remove();
      }
      popup = document.createElement("div");
      popup.id = "cantonese-popup-dict";
      popup.style.display = "none";
      popup.style.position = "absolute";
      popup.style.left = "-9999px";
      popup.style.top = "-9999px";
      popupArrow = document.createElement("div");
      popupArrow.className = "popup-arrow";
      popup.innerHTML = `
      <div class="popup-inner" style="border-radius: inherit; overflow: hidden; width: 100%; height: 100%; display: flex; flex-direction: column; position: relative;">
        <!-- 右上角操作按鈕區（包含報告和設定） -->
        <div class="popup-actions-wrapper" style="position: absolute; top: 10px; right: 10px; display: flex; align-items: center; z-index: 10;">
          <!-- 報告錯誤按鈕 (預設隱藏，hover wrapper 時滑出) -->
          <div class="popup-report-btn" title="${chrome.i18n.getMessage("dictReportTitle") || "報告錯誤"}" style="cursor: pointer; opacity: 0; width: 0; min-width: 0; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; height: 24px; border-radius: 4px; background-color: var(--popup-divider); margin-right: 0; color: var(--popup-text); font-size: 12px; white-space: nowrap; padding: 0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; flex-shrink: 0;">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <span style="transform: translateY(-0.5px)">${chrome.i18n.getMessage("dictBtnReport") || "報告"}</span>
          </div>
          <!-- 生詞本收藏按鈕 -->
          <div class="popup-bookmark-btn" title="${chrome.i18n.getMessage("dictBookmarkAdd") || "加入生詞本"}" style="cursor: pointer; opacity: 0; width: 0; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; height: 24px; width: 0; border-radius: 4px; background-color: var(--popup-divider); margin-right: 0; color: var(--popup-text); padding: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>
            </svg>
          </div>
          <!-- 設定按鈕 -->
          <div class="popup-settings-btn" title="${chrome.i18n.getMessage("optSettingsTitle") || "設定"}" style="cursor: pointer; opacity: 0.4; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--popup-text, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
        </div>
        <div class="popup-container">
          <div class="popup-main"></div>
          <div class="popup-examples" style="display:none;"></div>
        </div>
        <div class="popup-translate" style="display:none;"></div>
        
        <!-- 內聯報告表單 (預設隱藏) -->
        <div class="popup-report-form" style="display:none; padding: 12px; flex-direction: column; gap: 8px;">
          <div style="font-weight: bold; color: var(--popup-text); margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>${chrome.i18n.getMessage("dictReportTitle") || "報告錯誤"}</span>
            <span class="report-cancel-icon" style="cursor: pointer; opacity: 0.6;">✕</span>
          </div>
          <div style="font-size: 13px; color: var(--popup-text-muted); background: var(--popup-bg); padding: 6px; border-radius: 4px; border: 1px solid var(--popup-divider);">
            <div><strong>${chrome.i18n.getMessage("dictReportWord") || "詞語："}</strong><span class="report-word-preview"></span></div>
            <div style="margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>${chrome.i18n.getMessage("optSentenceLabel") || "句子："}</strong><span class="report-sentence-preview"></span></div>
          </div>
          <textarea class="report-textarea" placeholder="${chrome.i18n.getMessage("dictReportPlaceholder") || "請描述具體的錯誤（例如讀音不正確、釋義有誤等）..."}" style="width: 100%; height: 60px; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; background: var(--popup-bg); color: var(--popup-text); font-size: 13px; resize: none; outline: none !important; box-shadow: none !important; -webkit-appearance: none; box-sizing: border-box;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button class="report-cancel-btn" style="padding: 4px 10px; border: 1px solid var(--popup-border); background: transparent; color: var(--popup-text); border-radius: 4px; cursor: pointer; font-size: 12px;">${chrome.i18n.getMessage("wordbookNoteCancel") || "取消"}</button>
            <button class="report-send-btn" style="padding: 4px 10px; border: none; background: var(--popup-accent); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">${chrome.i18n.getMessage("dictReportSend") || "發送報告"}</button>
          </div>
        </div>
      </div>
    `;
      popup.appendChild(popupArrow);
      popupSubwordsFlyout = document.createElement("div");
      popupSubwordsFlyout.className = "popup-subwords-flyout";
      popupSubwordsFlyout.style.display = "none";
      popup.appendChild(popupSubwordsFlyout);
      shadowRoot.appendChild(popup);
      const actionsWrapper = popup.querySelector(".popup-actions-wrapper");
      const settingsBtn = popup.querySelector(".popup-settings-btn");
      const reportBtn = popup.querySelector(".popup-report-btn");
      const bookmarkBtn = popup.querySelector(".popup-bookmark-btn");
      const popupContainer = popup.querySelector(".popup-container");
      const popupTranslate = popup.querySelector(".popup-translate");
      const reportForm = popup.querySelector(".popup-report-form");
      actionsWrapper.addEventListener("mouseenter", () => {
        if (reportForm.style.display === "flex") return;
        settingsBtn.style.opacity = "1";
        settingsBtn.style.backgroundColor = "var(--popup-divider)";
        reportBtn.style.opacity = "1";
        reportBtn.style.width = "auto";
        reportBtn.style.minWidth = "58px";
        reportBtn.style.padding = "0 8px";
        reportBtn.style.marginRight = "4px";
        bookmarkBtn.style.opacity = "1";
        bookmarkBtn.style.width = "24px";
        bookmarkBtn.style.padding = "0 5px";
        bookmarkBtn.style.marginRight = "4px";
      });
      actionsWrapper.addEventListener("mouseleave", () => {
        settingsBtn.style.opacity = "0.4";
        settingsBtn.style.backgroundColor = "transparent";
        reportBtn.style.opacity = "0";
        reportBtn.style.width = "0";
        reportBtn.style.minWidth = "0";
        reportBtn.style.padding = "0";
        reportBtn.style.marginRight = "0";
        reportBtn.style.backgroundColor = "var(--popup-divider)";
        bookmarkBtn.style.opacity = "0";
        bookmarkBtn.style.width = "0";
        bookmarkBtn.style.padding = "0";
        bookmarkBtn.style.marginRight = "0";
        bookmarkBtn.style.backgroundColor = "var(--popup-divider)";
      });
      reportBtn.addEventListener("mouseenter", () => {
        reportBtn.style.backgroundColor = "var(--popup-divider-strong)";
      });
      reportBtn.addEventListener("mouseleave", () => {
        reportBtn.style.backgroundColor = "var(--popup-divider)";
      });
      bookmarkBtn.addEventListener("mouseenter", () => {
        bookmarkBtn.style.backgroundColor = "var(--popup-divider-strong)";
      });
      bookmarkBtn.addEventListener("mouseleave", () => {
        bookmarkBtn.style.backgroundColor = "var(--popup-divider)";
      });
      bookmarkBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        bookmarkBtn.style.transition = "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";
        bookmarkBtn.style.transform = "scale(1.3)";
        setTimeout(() => {
          bookmarkBtn.style.transform = "scale(1)";
        }, 200);
        const saved = await isWordSaved(currentWord);
        if (saved) {
          await removeWordByCharacter(currentWord);
          updateBookmarkBtnState(false);
          showToast(pt("wordbookRemoved"), 1500, "success");
        } else {
          await saveCurrentWordToWordbook();
        }
      });
      reportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        popupContainer.style.display = "none";
        if (popupTranslate) popupTranslate.style.display = "none";
        reportForm.style.display = "flex";
        actionsWrapper.style.display = "none";
        popup.querySelector(".report-word-preview").textContent = currentWord || "未知";
        popup.querySelector(".report-sentence-preview").textContent = currentContextSentence || "未知";
        popup.querySelector(".report-textarea").value = "";
      });
      const closeReportForm = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        reportForm.style.display = "none";
        popupContainer.style.display = "block";
        actionsWrapper.style.display = "flex";
      };
      popup.querySelector(".report-cancel-btn").addEventListener("click", closeReportForm);
      popup.querySelector(".report-cancel-icon").addEventListener("click", closeReportForm);
      popup.querySelector(".report-send-btn").addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.currentTarget;
        const originalText = btn.textContent;
        const originalBg = btn.style.backgroundColor;
        btn.textContent = "發送中...";
        btn.style.opacity = "0.8";
        btn.style.pointerEvents = "none";
        const userDesc = popup.querySelector(".report-textarea").value;
        const subject = `[Jyutping Extension] 錯誤報告: ${currentWord || "未知"}`;
        const message = `【單詞】：${currentWord || "未知"}
【上下文】：${currentContextSentence || "未知"}

【錯誤描述】：
${userDesc || "未提供具體描述"}`;
        try {
          const response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              access_key: "d19a0594-b64b-4593-b0e1-baf1cbeb6a4c",
              subject,
              from_name: "Jyutping Extension",
              message
            })
          });
          const result = await response.json();
          if (response.status === 200) {
            btn.textContent = "✓ 報告已送出";
            btn.style.backgroundColor = "#4caf50";
          } else {
            btn.textContent = "❌ 發送失敗";
            btn.style.backgroundColor = "#f44336";
            console.error("Email API Error:", result);
          }
        } catch (error) {
          btn.textContent = "❌ 網絡錯誤";
          btn.style.backgroundColor = "#f44336";
          console.error("Network Error:", error);
        }
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = originalBg;
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
          closeReportForm();
        }, 1500);
      });
      settingsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: "openOptionsPage" });
      });
      popup.addEventListener("mouseenter", () => {
        isMouseOverPopup = true;
        justNavigated = false;
        endExpandGrace();
        cancelScheduledHide();
      });
      popup.addEventListener("mouseleave", () => {
        isMouseOverPopup = false;
        if (Date.now() - lastPopupShowTime < 400) return;
        if (Date.now() - lastTabSwitchTime < 1e3) return;
        if (justNavigated) {
          return;
        }
        scheduleHidePopup();
      });
      popup.addEventListener("mousedown", (e) => {
        if (e.target.closest(".popup-qa-container")) {
          e.stopPropagation();
          return;
        }
        const tag = e.target.tagName.toLowerCase();
        if (tag === "textarea" || tag === "input") {
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      });
      popup.addEventListener("dblclick", (e) => {
        if (e.target.closest("textarea") || e.target.closest("input") || e.target.closest("button") || e.target.closest(".see-also-link")) {
          return;
        }
        e.stopPropagation();
        showPopupQA(popup);
      });
    }
    let dictionaryLoadPromise = null;
    function loadDictionary() {
      if (!dictionaryLoadPromise) {
        dictionaryLoadPromise = (async () => {
          try {
            const manifest = chrome.runtime.getManifest();
            const url = chrome.runtime.getURL("dictionary.json") + "?v=" + manifest.version;
            const response = await fetch(url, { cache: "no-cache" });
            dictionary = await response.json();
            console.log("粵語詞典已載入，詞條數：", Object.keys(dictionary).length);
          } catch (error) {
            console.warn("載入詞典失敗：", error.message || error);
          }
        })();
      }
      return dictionaryLoadPromise;
    }
    let toneDisplayStyle = "normal";
    let rubyTextOpacity = "0.85";
    let rubyTextStyle = "default";
    let rubyDictionaryColor = "#999999";
    let enableAutoTranslateYueDefs = false;
    let autoTranslateYueDefsTargetLang = "zh-Hans";
    let autoTranslateYueDefsEngine = "google";
    let yueDefDisplayMode = "expand";
    const yueDefTranslationCache = /* @__PURE__ */ new Map();
    function loadSettings() {
      chrome.storage.sync.get([
        "enabled",
        "displayMode",
        "toneStyle",
        "rubyRtBackground",
        "hoverModifier",
        "popupDisplayStyle",
        "popupTheme",
        "popupThemeMode",
        "popupThemeDay",
        "popupThemeNight",
        "popupThemeDayStart",
        "popupThemeNightStart",
        "customZhFont",
        "customEnFont",
        "highlightStyle",
        "rubyHoverStyle",
        "compactExpandBtn",
        "ttsEnabled",
        "ttsEngine",
        "edgeTtsMode",
        "edgeTtsUrl",
        "azureTtsKey",
        "azureTtsRegion",
        "azureTtsVoice",
        "ttsRate",
        "toneDisplayStyle",
        "rubyTextOpacity",
        "rubyTextStyle",
        "rubyDictionaryColor",
        "transLang",
        "transLangs",
        "transTrigger",
        "transHoverEngine",
        "paragraphTransKey",
        "paragraphTransMode",
        "paragraphTransEngine",
        "paragraphTransDirection",
        "enableAutoTranslateYueDefs",
        "autoTranslateYueDefsTargetLang",
        "autoTranslateYueDefsEngine",
        "yueDefDisplayMode"
      ], (result) => {
        if (result.enabled !== void 0) isEnabled = result.enabled !== false;
        yueDefDisplayMode = result.yueDefDisplayMode || "expand";
        displayMode = result.displayMode || "jyutping";
        toneStyle = result.toneStyle || "superscript";
        if (result.rubyRtBackground === true) rubyRtBackground = "solid";
        else if (result.rubyRtBackground === false || !result.rubyRtBackground) rubyRtBackground = "none";
        else rubyRtBackground = result.rubyRtBackground;
        hoverModifier = result.hoverModifier || "none";
        paragraphTransKey = result.paragraphTransKey || "shift";
        paragraphTransMode = result.paragraphTransMode || "below";
        paragraphTransEngine = result.paragraphTransEngine || "bing";
        paragraphTransDirection = result.paragraphTransDirection || "yue_to_target";
        popupDisplayStyle = result.popupDisplayStyle || "full";
        popupThemeMode = result.popupThemeMode || "manual";
        popupTheme = result.popupTheme || "classic";
        popupThemeDay = result.popupThemeDay || "classic";
        popupThemeNight = result.popupThemeNight || "night";
        popupThemeDayStart = result.popupThemeDayStart || "07:00";
        popupThemeNightStart = result.popupThemeNightStart || "19:00";
        customZhFont = result.customZhFont || "";
        customEnFont = result.customEnFont || "";
        highlightStyle = result.highlightStyle || "yellow";
        rubyHoverStyle = result.rubyHoverStyle || "ruby-red";
        compactExpandBtn = result.compactExpandBtn !== false;
        applyPopupTheme();
        ttsEnabled = result.ttsEnabled !== false;
        if (!ttsEnabled) detachAudioUnlockListeners();
        ttsEngine = result.ttsEngine || "edgeTts";
        edgeTtsMode = result.edgeTtsMode || "default";
        edgeTtsUrl = result.edgeTtsUrl || "";
        azureTtsKey = result.azureTtsKey || "";
        azureTtsRegion = result.azureTtsRegion || "";
        azureTtsVoice = result.azureTtsVoice || "zh-HK-HiuMaanNeural";
        ttsRate = result.ttsRate || 0.9;
        toneDisplayStyle = result.toneDisplayStyle || "normal";
        rubyTextOpacity = result.rubyTextOpacity || "0.85";
        rubyTextStyle = result.rubyTextStyle || "default";
        rubyDictionaryColor = result.rubyDictionaryColor || "#999999";
        enableAutoTranslateYueDefs = result.enableAutoTranslateYueDefs === true;
        autoTranslateYueDefsTargetLang = result.autoTranslateYueDefsTargetLang || "zh-Hans";
        autoTranslateYueDefsEngine = result.autoTranslateYueDefsEngine || "google";
        let tls = result.transLangs;
        if (!tls && result.transLang) {
          if (result.transLang === "both") tls = ["zh-Hans", "en"];
          else if (result.transLang === "mandarin") tls = ["zh-Hans"];
          else if (result.transLang === "english") tls = ["en"];
        }
        if (!tls) tls = ["zh-Hans", "en"];
        transLangs = tls;
        transTrigger = result.transTrigger || "dblclick";
        transHoverEngine = result.transHoverEngine || "bing";
        document.documentElement.style.setProperty("--jyutping-rt-opacity", rubyTextStyle === "dictionary" ? "1" : rubyTextOpacity, "important");
        if (rubyTextStyle === "dictionary") {
          document.documentElement.style.setProperty("--jyutping-rt-font", '"Chiron Hei HK WS", "Microsoft YaHei", sans-serif', "important");
          document.documentElement.style.setProperty("--jyutping-rt-font-style", "italic", "important");
          document.documentElement.style.setProperty("--jyutping-rt-color", rubyDictionaryColor, "important");
          document.documentElement.style.setProperty("--jyutping-rt-font-weight", "normal", "important");
          document.documentElement.style.setProperty("-webkit-font-smoothing", "antialiased", "important");
        } else {
          if (customEnFont) {
            document.documentElement.style.setProperty("--jyutping-rt-font", customEnFont, "important");
          } else {
            document.documentElement.style.removeProperty("--jyutping-rt-font");
          }
          document.documentElement.style.setProperty("--jyutping-rt-font-style", "normal", "important");
          document.documentElement.style.setProperty("--jyutping-rt-color", "inherit", "important");
          document.documentElement.style.setProperty("--jyutping-rt-font-weight", "normal", "important");
          document.documentElement.style.setProperty("-webkit-font-smoothing", "auto", "important");
        }
      });
      chrome.storage.local.get(["aiEnabled"], (result) => {
        aiEnabled = result.aiEnabled === true;
        console.log("[AI] loadSettings, aiEnabled:", aiEnabled);
      });
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        if (changes.enabled !== void 0) {
          isEnabled = changes.enabled.newValue !== false;
        }
        if (changes.popupDisplayStyle) {
          popupDisplayStyle = changes.popupDisplayStyle.newValue || "full";
        }
        if (changes.displayMode) {
          displayMode = changes.displayMode.newValue || "jyutping";
        }
        if (changes.toneStyle) {
          toneStyle = changes.toneStyle.newValue || "superscript";
        }
        if (changes.rubyRtBackground) {
          const val = changes.rubyRtBackground.newValue;
          if (val === true) rubyRtBackground = "solid";
          else if (val === false || !val) rubyRtBackground = "none";
          else rubyRtBackground = val;
        }
        if (changes.hoverModifier) {
          hoverModifier = changes.hoverModifier.newValue || "none";
        }
        if (changes.popupThemeMode) {
          popupThemeMode = changes.popupThemeMode.newValue || "manual";
          applyPopupTheme();
        }
        if (changes.popupTheme) {
          popupTheme = changes.popupTheme.newValue || "classic";
          applyPopupTheme();
        }
        if (changes.popupThemeDay) {
          popupThemeDay = changes.popupThemeDay.newValue || "classic";
          applyPopupTheme();
        }
        if (changes.popupThemeNight) {
          popupThemeNight = changes.popupThemeNight.newValue || "night";
          applyPopupTheme();
        }
        if (changes.popupThemeDayStart) {
          popupThemeDayStart = changes.popupThemeDayStart.newValue || "07:00";
          applyPopupTheme();
        }
        if (changes.popupThemeNightStart) {
          popupThemeNightStart = changes.popupThemeNightStart.newValue || "19:00";
          applyPopupTheme();
        }
        if (changes.customZhFont) {
          customZhFont = changes.customZhFont.newValue || "";
          applyPopupTheme();
        }
        if (changes.customEnFont) {
          customEnFont = changes.customEnFont.newValue || "";
          applyPopupTheme();
          if (rubyTextStyle !== "dictionary") {
            if (customEnFont) {
              document.documentElement.style.setProperty("--jyutping-rt-font", customEnFont, "important");
            } else {
              document.documentElement.style.removeProperty("--jyutping-rt-font");
            }
          }
        }
        if (changes.highlightStyle) {
          highlightStyle = changes.highlightStyle.newValue || "yellow";
        }
        if (changes.rubyHoverStyle) {
          rubyHoverStyle = changes.rubyHoverStyle.newValue || "ruby-red";
        }
        if (changes.compactExpandBtn) {
          compactExpandBtn = changes.compactExpandBtn.newValue !== false;
        }
        if (changes.ttsEnabled !== void 0) {
          ttsEnabled = changes.ttsEnabled.newValue !== false;
          if (ttsEnabled) attachAudioUnlockListeners();
          else releaseAudioContext();
        }
        if (changes.ttsEngine) {
          ttsEngine = changes.ttsEngine.newValue || "edgeTts";
        }
        if (changes.edgeTtsMode) {
          edgeTtsMode = changes.edgeTtsMode.newValue || "default";
        }
        if (changes.edgeTtsUrl) {
          edgeTtsUrl = changes.edgeTtsUrl.newValue || "";
        }
        if (changes.azureTtsKey) {
          azureTtsKey = changes.azureTtsKey.newValue || "";
        }
        if (changes.azureTtsRegion) {
          azureTtsRegion = changes.azureTtsRegion.newValue || "";
        }
        if (changes.azureTtsVoice) {
          azureTtsVoice = changes.azureTtsVoice.newValue || "zh-HK-HiuMaanNeural";
        }
        if (changes.ttsRate) {
          ttsRate = changes.ttsRate.newValue || 0.9;
        }
        if (changes.paragraphTransKey) {
          paragraphTransKey = changes.paragraphTransKey.newValue || "shift";
        }
        if (changes.paragraphTransMode) {
          paragraphTransMode = changes.paragraphTransMode.newValue || "below";
        }
        if (changes.paragraphTransEngine) {
          paragraphTransEngine = changes.paragraphTransEngine.newValue || "bing";
        }
        if (changes.uiTheme) {
          applyPopupTheme(popupTheme);
        }
        if (changes.toneDisplayStyle) {
          toneDisplayStyle = changes.toneDisplayStyle.newValue;
        }
        if (changes.rubyTextOpacity) {
          rubyTextOpacity = changes.rubyTextOpacity.newValue;
          document.documentElement.style.setProperty("--jyutping-rt-opacity", rubyTextStyle === "dictionary" ? "1" : rubyTextOpacity, "important");
        }
        if (changes.rubyDictionaryColor) {
          rubyDictionaryColor = changes.rubyDictionaryColor.newValue;
          if (rubyTextStyle === "dictionary") {
            document.documentElement.style.setProperty("--jyutping-rt-color", rubyDictionaryColor, "important");
          }
        }
        if (changes.rubyTextStyle) {
          rubyTextStyle = changes.rubyTextStyle.newValue;
          document.documentElement.style.setProperty("--jyutping-rt-opacity", rubyTextStyle === "dictionary" ? "1" : rubyTextOpacity, "important");
          if (rubyTextStyle === "dictionary") {
            document.documentElement.style.setProperty("--jyutping-rt-font", '"Chiron Hei HK WS", "Microsoft YaHei", sans-serif', "important");
            document.documentElement.style.setProperty("--jyutping-rt-font-style", "italic", "important");
            document.documentElement.style.setProperty("--jyutping-rt-color", rubyDictionaryColor, "important");
            document.documentElement.style.setProperty("--jyutping-rt-font-weight", "normal", "important");
            document.documentElement.style.setProperty("-webkit-font-smoothing", "antialiased", "important");
          } else {
            if (customEnFont) {
              document.documentElement.style.setProperty("--jyutping-rt-font", customEnFont, "important");
            } else {
              document.documentElement.style.removeProperty("--jyutping-rt-font");
            }
            document.documentElement.style.setProperty("--jyutping-rt-font-style", "normal", "important");
            document.documentElement.style.setProperty("--jyutping-rt-color", "inherit", "important");
            document.documentElement.style.setProperty("--jyutping-rt-font-weight", "normal", "important");
            document.documentElement.style.setProperty("-webkit-font-smoothing", "auto", "important");
          }
        }
        if (changes.transLangs) {
          transLangs = changes.transLangs.newValue;
        } else if (changes.transLang && !changes.transLangs) {
          let tls = changes.transLang.newValue;
          if (tls === "both") transLangs = ["zh-Hans", "en"];
          else if (tls === "mandarin") transLangs = ["zh-Hans"];
          else if (tls === "english") transLangs = ["en"];
        } else if (changes.transTrigger) {
          transTrigger = changes.transTrigger.newValue;
        } else if (changes.transHoverEngine) {
          transHoverEngine = changes.transHoverEngine.newValue;
        } else if (changes.paragraphTransDirection) {
          paragraphTransDirection = changes.paragraphTransDirection.newValue || "yue_to_target";
        } else if (changes.enableAutoTranslateYueDefs) {
          enableAutoTranslateYueDefs = changes.enableAutoTranslateYueDefs.newValue === true;
        } else if (changes.autoTranslateYueDefsTargetLang) {
          autoTranslateYueDefsTargetLang = changes.autoTranslateYueDefsTargetLang.newValue;
        } else if (changes.autoTranslateYueDefsEngine) {
          autoTranslateYueDefsEngine = changes.autoTranslateYueDefsEngine.newValue;
        } else if (changes.yueDefDisplayMode) {
          yueDefDisplayMode = changes.yueDefDisplayMode.newValue || "expand";
        }
      } else if (area === "local") {
        if (changes.aiEnabled) {
          aiEnabled = changes.aiEnabled.newValue === true;
          console.log("[AI] Dynamic update from storage.onChanged (local), aiEnabled:", aiEnabled);
        }
      }
    });
    let lastSpeakTime = 0;
    let lastSpeakKey = "";
    let ttsPlaybackTimer = null;
    let activeSpeakerBtn = null;
    let activeSpeakingRuby = null;
    let webAudioCtx = null;
    const audioBufferCache = /* @__PURE__ */ new Map();
    const AUDIO_BUFFER_CACHE_MAX = 150;
    let activeAudioSourceNodes = [];
    let currentHtmlAudio = null;
    let currentAudioSessionId = 0;
    function unlockAudioContext() {
      try {
        if (!webAudioCtx) {
          webAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (webAudioCtx && webAudioCtx.state === "suspended") {
          webAudioCtx.resume().catch(() => {
          });
        }
      } catch (_) {
      }
      return webAudioCtx;
    }
    const AUDIO_UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"];
    let audioUnlockListenersAttached = false;
    function handleFirstGesture() {
      if (!ttsEnabled) return;
      unlockAudioContext();
      if (webAudioCtx) detachAudioUnlockListeners();
    }
    function detachAudioUnlockListeners() {
      if (!audioUnlockListenersAttached) return;
      AUDIO_UNLOCK_EVENTS.forEach((evt) => {
        document.removeEventListener(evt, handleFirstGesture, { capture: true });
      });
      audioUnlockListenersAttached = false;
    }
    function attachAudioUnlockListeners() {
      if (audioUnlockListenersAttached || webAudioCtx) return;
      AUDIO_UNLOCK_EVENTS.forEach((evt) => {
        document.addEventListener(evt, handleFirstGesture, { capture: true, passive: true });
      });
      audioUnlockListenersAttached = true;
    }
    function releaseAudioContext() {
      stopActiveAudioNodes();
      audioBufferCache.clear();
      if (webAudioCtx) {
        try {
          webAudioCtx.close();
        } catch (_) {
        }
        webAudioCtx = null;
      }
    }
    attachAudioUnlockListeners();
    function base64ToArrayBuffer(base64DataUri) {
      try {
        const base64 = base64DataUri.includes(",") ? base64DataUri.split(",")[1] : base64DataUri;
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      } catch (e) {
        return null;
      }
    }
    function stopActiveAudioNodes() {
      activeAudioSourceNodes.forEach((node) => {
        try {
          node.onended = null;
          node.stop();
        } catch (_) {
        }
        releaseSourceChain(node);
      });
      activeAudioSourceNodes = [];
      if (currentHtmlAudio) {
        try {
          currentHtmlAudio.onended = null;
          currentHtmlAudio.onerror = null;
          currentHtmlAudio.ontimeupdate = null;
          currentHtmlAudio.pause();
        } catch (_) {
        }
        currentHtmlAudio = null;
      }
    }
    async function getAudioBuffer(url) {
      if (audioBufferCache.has(url)) {
        const cached = audioBufferCache.get(url);
        audioBufferCache.delete(url);
        audioBufferCache.set(url, cached);
        return cached;
      }
      const ctx = unlockAudioContext();
      if (!ctx) throw new Error("AudioContext unavailable");
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (audioBufferCache.size >= AUDIO_BUFFER_CACHE_MAX) {
        audioBufferCache.delete(audioBufferCache.keys().next().value);
      }
      audioBufferCache.set(url, audioBuffer);
      return audioBuffer;
    }
    function concatenateAudioBuffers(buffers) {
      if (!buffers || buffers.length === 0) return null;
      if (buffers.length === 1) return buffers[0];
      const numChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
      const sampleRate = buffers[0].sampleRate;
      let totalLength = 0;
      for (let i = 0; i < buffers.length; i++) {
        totalLength += buffers[i].length;
      }
      const outputBuffer = webAudioCtx.createBuffer(numChannels, totalLength, sampleRate);
      const gains = buffers.map((b) => computeNormalizedGain(b));
      for (let channel = 0; channel < numChannels; channel++) {
        const outputData = outputBuffer.getChannelData(channel);
        let offset = 0;
        for (let i = 0; i < buffers.length; i++) {
          const buf = buffers[i];
          const gain = gains[i];
          const inputData = buf.getChannelData(Math.min(channel, buf.numberOfChannels - 1));
          const len = inputData.length;
          for (let k = 0; k < len; k++) {
            outputData[offset + k] = inputData[k] * gain;
          }
          offset += len;
        }
      }
      bufferGainCache.set(outputBuffer, 1);
      return outputBuffer;
    }
    function splitJyutpingTokens(text) {
      if (!text || typeof text !== "string") return [];
      return text.trim().split(/\s+/).filter(Boolean);
    }
    function wrapSyllablesInSpans(text) {
      if (!text || typeof text !== "string") return text || "";
      const parts = text.split(/(\s+)/);
      let syllableIndex = 0;
      return parts.map((part) => {
        if (/^\s+$/.test(part)) {
          return part;
        }
        const idx = syllableIndex++;
        return `<span class="syllable-item" data-syllable-index="${idx}">${part}</span>`;
      }).join("");
    }
    function highlightSpeakingSyllable(container, activeIndex) {
      if (!container) return;
      const syllableEls = container.querySelectorAll(".syllable-item");
      syllableEls.forEach((el, idx) => {
        if (idx === activeIndex) {
          el.classList.add("speaking-active");
        } else {
          el.classList.remove("speaking-active");
        }
      });
    }
    async function playSyllablesSeamless(sessionId, syllables, rate = 1, onEnd = null, onSyllableChange = null) {
      stopActiveAudioNodes();
      if (!webAudioCtx) {
        webAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (webAudioCtx.state === "suspended") {
        await webAudioCtx.resume().catch(() => {
        });
      }
      try {
        const buffers = [];
        for (const syl of syllables) {
          const localUrl = chrome.runtime.getURL(`audio/jyutping_female/${syl}.mp3`);
          try {
            const buf = await getAudioBuffer(localUrl);
            if (buf) buffers.push(buf);
          } catch (e) {
            console.warn("[Audio] Failed to load syllable buffer for:", syl, e);
          }
        }
        if (sessionId !== currentAudioSessionId) return false;
        if (buffers.length !== syllables.length || buffers.length === 0) {
          console.warn(`[Audio] Incomplete syllables loaded (${buffers.length}/${syllables.length}), fallback to full word TTS`);
          return false;
        }
        const mergedBuffer = concatenateAudioBuffers(buffers);
        if (!mergedBuffer) return false;
        if (sessionId !== currentAudioSessionId) return false;
        const source = webAudioCtx.createBufferSource();
        source.buffer = mergedBuffer;
        const effectiveRate = syllables.length > 1 ? (rate || 1) * 1.2 : rate || 1;
        source.playbackRate.value = effectiveRate;
        let accumulatedTimeMs = 0;
        for (let i = 0; i < buffers.length; i++) {
          const sylIndex = i;
          const startMs = accumulatedTimeMs;
          const durationMs = buffers[i].duration / effectiveRate * 1e3;
          accumulatedTimeMs += durationMs;
          setTimeout(() => {
            if (sessionId === currentAudioSessionId) {
              if (onSyllableChange) onSyllableChange(sylIndex);
            }
          }, startMs);
        }
        connectNormalized(webAudioCtx, source, source.buffer);
        source.onended = () => {
          source.onended = null;
          releaseSourceChain(source);
          const idx = activeAudioSourceNodes.indexOf(source);
          if (idx !== -1) activeAudioSourceNodes.splice(idx, 1);
          if (sessionId === currentAudioSessionId) {
            if (onSyllableChange) onSyllableChange(-1);
            if (onEnd) onEnd();
          }
        };
        activeAudioSourceNodes.push(source);
        source.start(0);
        onPlaybackActuallyStarted(mergedBuffer.duration / effectiveRate);
        return true;
      } catch (err) {
        console.warn("[Audio] Seamless syllable playback error:", err);
        return false;
      }
    }
    function startSpeakerAnimation(btn = null) {
      if (activeSpeakerBtn) {
        activeSpeakerBtn.classList.remove("speaking");
      }
      if (activeSpeakingRuby) {
        activeSpeakingRuby.classList.remove("speaking");
        activeSpeakingRuby = null;
      }
      activeSpeakerBtn = btn || (popup ? popup.querySelector(".pronunciation-section .tts-speaker-btn") : null);
      if (activeSpeakerBtn) activeSpeakerBtn.classList.add("speaking");
      if (ttsPlaybackTimer) {
        clearTimeout(ttsPlaybackTimer);
        ttsPlaybackTimer = null;
      }
    }
    function startRubySpeakingState(rubyEl) {
      if (activeSpeakingRuby) {
        activeSpeakingRuby.classList.remove("speaking");
      }
      activeSpeakingRuby = rubyEl;
      if (activeSpeakingRuby) activeSpeakingRuby.classList.add("speaking");
      if (popup && popup.classList.contains("popup-ruby-mode")) {
        const floatingText = popup.querySelector(".ruby-floating-text");
        if (floatingText) {
          floatingText.style.opacity = "1";
        }
      }
    }
    function clearSpeakerVisualState() {
      if (activeSpeakerBtn) {
        activeSpeakerBtn.classList.remove("speaking");
        activeSpeakerBtn = null;
      }
      if (activeSpeakingRuby) {
        activeSpeakingRuby.classList.remove("speaking");
        activeSpeakingRuby = null;
      }
      if (ttsPlaybackTimer) {
        clearTimeout(ttsPlaybackTimer);
        ttsPlaybackTimer = null;
      }
      if (popup) {
        popup.querySelectorAll(".syllable-item.speaking-active").forEach((el) => el.classList.remove("speaking-active"));
      }
    }
    function stopSpeakerAnimation() {
      stopActiveAudioNodes();
      clearSpeakerVisualState();
    }
    function onPlaybackActuallyStarted(realDurationSec) {
      if (ttsPlaybackTimer) {
        clearTimeout(ttsPlaybackTimer);
        ttsPlaybackTimer = null;
      }
      const hasDuration = typeof realDurationSec === "number" && isFinite(realDurationSec) && realDurationSec > 0;
      const backstopMs = hasDuration ? realDurationSec * 1e3 + 2e3 : 3e4;
      ttsPlaybackTimer = setTimeout(clearSpeakerVisualState, backstopMs);
    }
    const TARGET_PEAK = 0.85;
    const TARGET_VOICE_RMS = 0.18;
    const MAX_MAKEUP = 4;
    const MIN_GAIN = 0.25;
    const bufferGainCache = /* @__PURE__ */ new WeakMap();
    function computeNormalizedGain(audioBuffer) {
      const cached = bufferGainCache.get(audioBuffer);
      if (cached !== void 0) return cached;
      let peak = 0;
      const channels = audioBuffer.numberOfChannels;
      const dataLen = audioBuffer.length;
      const step = dataLen > 4e5 ? 4 : 1;
      for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < dataLen; i += step) {
          const abs = Math.abs(data[i]);
          if (abs > peak) peak = abs;
        }
      }
      if (peak < 1e-3) {
        bufferGainCache.set(audioBuffer, 1);
        return 1;
      }
      const threshold = Math.max(0.015, peak * 0.08);
      let voiceSumSq = 0;
      let voiceSamples = 0;
      for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < dataLen; i += step) {
          const abs = Math.abs(data[i]);
          if (abs >= threshold) {
            voiceSumSq += abs * abs;
            voiceSamples++;
          }
        }
      }
      const voiceRms = voiceSamples > 0 ? Math.sqrt(voiceSumSq / voiceSamples) : peak * 0.5;
      const byRms = TARGET_VOICE_RMS / voiceRms;
      const byPeak = TARGET_PEAK / peak;
      const gain = Math.max(MIN_GAIN, Math.min(byPeak, byRms, MAX_MAKEUP));
      bufferGainCache.set(audioBuffer, gain);
      return gain;
    }
    function connectNormalized(ctx, source, audioBuffer) {
      const gainNode = ctx.createGain();
      gainNode.gain.value = computeNormalizedGain(audioBuffer);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source._outGain = gainNode;
      return gainNode;
    }
    function releaseSourceChain(source) {
      if (!source) return;
      try {
        source.disconnect();
      } catch (_) {
      }
      if (source._outGain) {
        try {
          source._outGain.disconnect();
        } catch (_) {
        }
        source._outGain = null;
      }
    }
    function playHtmlAudioFallback(src, sessionId) {
      if (sessionId !== currentAudioSessionId) return;
      const audio = new Audio(src);
      currentHtmlAudio = audio;
      audio.volume = 0.85;
      audio.onplaying = () => {
        if (sessionId === currentAudioSessionId) onPlaybackActuallyStarted(audio.duration);
      };
      audio.ontimeupdate = () => {
        if (sessionId === currentAudioSessionId && audio.duration && audio.currentTime >= audio.duration - 0.05) stopSpeakerAnimation();
      };
      audio.onended = () => {
        if (sessionId === currentAudioSessionId) stopSpeakerAnimation();
      };
      audio.onerror = () => {
        if (sessionId === currentAudioSessionId) stopSpeakerAnimation();
      };
      audio.play().catch((err) => {
        console.warn("[Content] TTS Playback failed:", err);
        if (sessionId === currentAudioSessionId) stopSpeakerAnimation();
      });
    }
    async function speakCantonese(text, targetBtn = null, options = {}) {
      if (!ttsEnabled) return;
      unlockAudioContext();
      let textToSpeak = text;
      let entry = dictionary && dictionary[text] ? dictionary[text] : null;
      if (entry && entry.traditional) {
        textToSpeak = entry.traditional;
      }
      let jyutpingHint = typeof options === "object" && options && options.jyutping ? options.jyutping : "";
      if (!jyutpingHint && entry && entry.jyutping) {
        jyutpingHint = entry.jyutping;
      }
      const preferWordshk = Boolean(options && options.preferWordshk);
      const onSyllableChange = typeof options === "object" && options && typeof options.onSyllableChange === "function" ? options.onSyllableChange : null;
      const now = Date.now();
      const speakKey = `${textToSpeak}|${jyutpingHint}`;
      if (now - lastSpeakTime < 300 && speakKey === lastSpeakKey) {
        return;
      }
      lastSpeakTime = now;
      lastSpeakKey = speakKey;
      startSpeakerAnimation(targetBtn);
      const sessionId = ++currentAudioSessionId;
      async function fallbackToTtsEngine() {
        if (sessionId !== currentAudioSessionId) return;
        stopActiveAudioNodes();
        pendingTtsSessionId = sessionId;
        const estimatedDurationMs = (textToSpeak.length * 500 + 1e3) / ttsRate;
        const timeoutMs = Math.max(8e3, Math.min(estimatedDurationMs + 8e3, 3e4));
        ttsPlaybackTimer = setTimeout(() => {
          if (sessionId === currentAudioSessionId) clearSpeakerVisualState();
        }, timeoutMs);
        try {
          if (ttsEngine === "webSpeech") {
            speakWithWebSpeech(textToSpeak);
          } else if (ttsEngine === "chromeTts") {
            speakWithChromeTts(textToSpeak);
          } else if (ttsEngine === "edgeTts") {
            const baseUrl = edgeTtsMode === "custom" ? edgeTtsUrl : EDGE_TTS_DEFAULT_URL;
            await speakWithEdgeTts(textToSpeak, baseUrl, jyutpingHint, sessionId);
          } else if (ttsEngine === "googleTts") {
            chrome.runtime.sendMessage({
              action: "googleTtsSpeak",
              text: textToSpeak,
              rate: ttsRate,
              sessionId
            });
          } else if (ttsEngine === "azureTts") {
            if (!azureTtsKey || !azureTtsRegion) {
              throw new Error("請先在設定中配置 Azure Speech API Key 和區域");
            }
            chrome.runtime.sendMessage({
              action: "azureTtsSpeak",
              text: textToSpeak,
              jyutping: jyutpingHint,
              azureKey: azureTtsKey,
              azureRegion: azureTtsRegion,
              azureVoice: azureTtsVoice,
              rate: ttsRate,
              sessionId
            });
          }
        } catch (error) {
          if (error && error.message && error.message.includes("Extension context invalidated")) {
            console.warn("[Jyutping Extension] Extension context invalidated. Please refresh the page.");
            if (sessionId === currentAudioSessionId) stopSpeakerAnimation();
            return;
          }
          console.error("TTS error:", error);
          if (sessionId === currentAudioSessionId) stopSpeakerAnimation();
          if (!window.hasShownTtsFallbackToast) {
            showToast("🔊 語音服務連線異常，已自動降級為系統本機發音。<br>請檢查網絡或刷新網頁。", 4e3);
            window.hasShownTtsFallbackToast = true;
          }
          speakWithWebSpeech(textToSpeak);
        }
      }
      if (preferWordshk && jyutpingHint) {
        const syllables = splitJyutpingTokens(jyutpingHint.toLowerCase());
        if (syllables.length > 0) {
          const played = await playSyllablesSeamless(sessionId, syllables, ttsRate || 1, stopSpeakerAnimation, onSyllableChange);
          if (played) return;
          if (sessionId !== currentAudioSessionId) return;
        }
      }
      const cacheKey = `${ttsEngine}:${ttsRate}:${textToSpeak}:${jyutpingHint}`;
      if (["edgeTts", "googleTts", "azureTts"].includes(ttsEngine)) {
        const cachedAudio = ttsCache.get(cacheKey);
        if (cachedAudio) {
          if (sessionId !== currentAudioSessionId) return;
          stopActiveAudioNodes();
          const ctx = unlockAudioContext();
          if (ctx && ctx.state !== "closed") {
            fetch(cachedAudio).then((res) => res.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab.slice(0))).then((audioBuffer) => {
              if (sessionId !== currentAudioSessionId) return;
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              connectNormalized(ctx, source, audioBuffer);
              source.onended = () => {
                releaseSourceChain(source);
                if (sessionId === currentAudioSessionId) {
                  stopSpeakerAnimation();
                  const idx = activeAudioSourceNodes.indexOf(source);
                  if (idx !== -1) activeAudioSourceNodes.splice(idx, 1);
                }
              };
              activeAudioSourceNodes.push(source);
              source.start(0);
              onPlaybackActuallyStarted(audioBuffer.duration);
            }).catch(() => playHtmlAudioFallback(cachedAudio, sessionId));
          } else {
            playHtmlAudioFallback(cachedAudio, sessionId);
          }
          return;
        }
      }
      pendingTtsText = cacheKey;
      await fallbackToTtsEngine();
    }
    function speakWithWebSpeech(text) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-HK";
      utterance.rate = ttsRate;
      utterance.volume = 0.85;
      utterance.onend = stopSpeakerAnimation;
      utterance.onerror = stopSpeakerAnimation;
      const voices = speechSynthesis.getVoices();
      const cantoneseVoice = voices.find(
        (v) => v.lang === "zh-HK" || v.lang.startsWith("zh-HK")
      );
      if (cantoneseVoice) utterance.voice = cantoneseVoice;
      speechSynthesis.speak(utterance);
    }
    function speakWithChromeTts(text) {
      chrome.runtime.sendMessage({
        action: "chromeTtsSpeak",
        text,
        options: { lang: "zh-HK", rate: ttsRate }
      });
    }
    async function speakWithEdgeTts(text, baseUrl, jyutping = "", sessionId = 0) {
      baseUrl = baseUrl || EDGE_TTS_DEFAULT_URL;
      chrome.runtime.sendMessage({
        action: "edgeTtsSpeak",
        text,
        jyutping,
        baseUrl,
        rate: ttsRate,
        sessionId
      });
    }
    function setupEventListeners() {
      let lastX = 0, lastY = 0;
      let isThrottled = false;
      let isSelecting = false;
      document.addEventListener("mousemove", (e) => {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
        if (!isEnabled || isSelecting) return;
        loadDictionary();
        if (popup && popup.querySelector(".popup-qa-container")) return;
        if (translatePopup && translatePopup.querySelector(".popup-qa-container")) return;
        if (hasUserSelection) {
          if (isMouseOverPopup) return;
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            let isOverSelection = false;
            for (let i = 0; i < rects.length; i++) {
              const rect = rects[i];
              if (e.clientX >= rect.left - 20 && e.clientX <= rect.right + 20 && e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20) {
                isOverSelection = true;
                break;
              }
            }
            if (!isOverSelection) {
              if (canAutoHide()) {
                hidePopup(true);
              }
            }
          }
          return;
        }
        if (isMouseOverPopup) return;
        if (justNavigated) return;
        if (hasEditableFocus()) {
          return;
        }
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        if (isEditableElement2(targetElement)) {
          return;
        }
        if (isThrottled) return;
        if (Math.abs(e.clientX - lastX) < 5 && Math.abs(e.clientY - lastY) < 5) {
          return;
        }
        lastX = e.clientX;
        lastY = e.clientY;
        isThrottled = true;
        setTimeout(() => {
          isThrottled = false;
        }, 50);
        handleMouseOver(e);
      });
      document.addEventListener("mouseleave", () => {
        if (!canAutoHide()) return;
        if (hasEditableFocus()) {
          if (popup) popup.style.display = "none";
          return;
        }
        hidePopup();
      });
      document.addEventListener("mousedown", (e) => {
        if (!isEnabled) return;
        if (e.button !== 0) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.some((el) => el.id === "jyutping-shadow-host" || el.id === "cantonese-popup-dict" || el.id === "cantonese-translate-popup")) {
          return;
        }
        if (hasUserSelection) {
          const selection = window.getSelection();
          const textToSpeak = selection.toString().trim();
          if (textToSpeak.length > 1e3) return;
          if (selection.rangeCount > 0 && textToSpeak) {
            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            let clickInSelection = false;
            const pad = 10;
            for (const rect of rects) {
              if (e.clientX >= rect.left - pad && e.clientX <= rect.right + pad && e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad) {
                clickInSelection = true;
                break;
              }
            }
            if (clickInSelection) {
              e.preventDefault();
              const textToSpeak2 = selection.toString().trim();
              const rangeRect = getBestRectForRange(range);
              const btn = showSelectionSpeakerPopup(rangeRect, textToSpeak2);
              speakCantonese(textToSpeak2, btn);
              let wasSelectionLongPressTriggered = false;
              let isDragging = false;
              const startX = e.clientX;
              const startY = e.clientY;
              console.log("[AI-SelectionLongPress] isAiOn:", aiEnabled);
              if (aiEnabled) {
                if (aiLongPressTimer) {
                  clearTimeout(aiLongPressTimer);
                  cancelLongPressAnimation();
                }
                const selectedWord = selection.toString().trim();
                console.log("[AI-SelectionLongPress] Setting timers synchronously for word:", selectedWord);
                aiAnimationTimer = setTimeout(() => {
                  startLongPressAnimation(e.clientX, e.clientY);
                }, 150);
                aiLongPressTimer = setTimeout(() => {
                  aiLongPressTimer = null;
                  if (!isDragging) {
                    wasSelectionLongPressTriggered = true;
                    console.log("[AI-SelectionLongPress] Triggered AI translation for:", selectedWord);
                    if (longPressRing) {
                      longPressRing.classList.add("done");
                      setTimeout(() => {
                        longPressRing.classList.remove("done");
                        longPressRing.classList.remove("active");
                      }, 300);
                    }
                    requestAiTranslation(selectedWord, rangeRect);
                  } else {
                    cancelLongPressAnimation();
                  }
                }, 650);
              }
              const onDragMove = (moveEvt) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                if (dx * dx + dy * dy > 400) {
                  isDragging = true;
                  if (aiLongPressTimer) {
                    clearTimeout(aiLongPressTimer);
                    aiLongPressTimer = null;
                    cancelLongPressAnimation();
                  }
                  document.removeEventListener("mousemove", onDragMove);
                }
              };
              document.addEventListener("mousemove", onDragMove);
              const onSelectionClickEnd = () => {
                document.removeEventListener("mousemove", onDragMove);
                if (wasSelectionLongPressTriggered) {
                  ignoreNextRubyClick = true;
                  setTimeout(() => {
                    ignoreNextRubyClick = false;
                  }, 100);
                }
                if (transTrigger === "click" && !wasSelectionLongPressTriggered && !isDragging) {
                  requestTranslation(textToSpeak2);
                }
              };
              document.addEventListener("mouseup", onSelectionClickEnd, { once: true });
              return;
            }
          }
          hasUserSelection = false;
          window.getSelection().removeAllRanges();
          hideTranslatePopup();
          cancelLongPressAnimation();
        }
        let clickedHighlightSpan = e.target.closest && e.target.closest(".jyutping-highlight");
        let clickedRuby = e.target.closest && (e.target.closest(".jyutping-ruby-injected") || e.target.closest(".jyutping-hover-ruby"));
        let clickInHighlight = false;
        let wordToSpeak = null;
        if (clickedHighlightSpan) {
          clickInHighlight = true;
          wordToSpeak = currentWord;
        } else if (clickedRuby) {
          clickInHighlight = true;
          wordToSpeak = clickedRuby.dataset.word;
          if (wordToSpeak) {
            currentWord = wordToSpeak;
            try {
              currentRange = document.createRange();
              currentRange.selectNodeContents(clickedRuby);
            } catch (err) {
            }
          }
        } else if (currentWord && currentRange) {
          const rect = currentRange.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            clickInHighlight = true;
            wordToSpeak = currentWord;
          }
        }
        if (!clickInHighlight) {
          console.log("[AI-LongPress] Mousedown outside highlight. e.target:", e.target.tagName, e.target.className, "popup is:", popup, "popup.contains:", popup ? popup.contains(e.target) : "null");
          const previousWord = currentWord;
          handleMouseOver(e);
          const newTarget = document.elementFromPoint(e.clientX, e.clientY);
          clickedHighlightSpan = newTarget && newTarget.closest && newTarget.closest(".jyutping-highlight");
          if (clickedHighlightSpan) {
            clickInHighlight = true;
            wordToSpeak = currentWord;
          } else if (currentWord && currentRange && currentWord !== previousWord) {
            clickInHighlight = true;
            wordToSpeak = currentWord;
          } else if (currentWord && currentRange) {
            const rect = currentRange.getBoundingClientRect();
            const pad = 10;
            if (rect.width > 0 && rect.height > 0 && e.clientX >= rect.left - pad && e.clientX <= rect.right + pad && e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad) {
              clickInHighlight = true;
              wordToSpeak = currentWord;
            }
          }
        }
        if (clickInHighlight && wordToSpeak) {
          console.log("[AI-LongPress] Mousedown inside target word:", wordToSpeak);
          const startX = e.clientX;
          const startY = e.clientY;
          let isDragging = false;
          const sel = window.getSelection();
          let savedRange = null;
          if (sel.rangeCount > 0 && sel.toString().trim()) {
            savedRange = sel.getRangeAt(0).cloneRange();
          }
          pendingTranslateWord = wordToSpeak;
          speakCantonese(wordToSpeak);
          if (clickedRuby) {
            startRubySpeakingState(clickedRuby);
          }
          let wasWordLongPressTriggered = false;
          console.log("[AI-LongPress] isAiOn:", aiEnabled);
          let initialTargetRect = null;
          if (typeof currentRange !== "undefined" && currentRange) {
            initialTargetRect = getBestRectForRange(currentRange);
          }
          if (aiEnabled) {
            if (aiLongPressTimer) {
              clearTimeout(aiLongPressTimer);
              cancelLongPressAnimation();
            }
            console.log("[AI-LongPress] Setting timers synchronously.");
            aiAnimationTimer = setTimeout(() => {
              console.log("[AI-LongPress] Starting animation");
              startLongPressAnimation(startX, startY);
            }, 150);
            aiLongPressTimer = setTimeout(() => {
              console.log("[AI-LongPress] Trigger timer fired! isDragging:", isDragging);
              aiLongPressTimer = null;
              if (!isDragging) {
                wasWordLongPressTriggered = true;
                console.log("[AI-LongPress] Triggering AI translation for:", wordToSpeak);
                if (longPressRing) {
                  longPressRing.classList.add("done");
                  setTimeout(() => {
                    longPressRing.classList.remove("done");
                    longPressRing.classList.remove("active");
                  }, 300);
                }
                requestAiTranslation(wordToSpeak, initialTargetRect);
              } else {
                cancelLongPressAnimation();
              }
            }, 650);
          }
          const onDragMove = (moveEvt) => {
            const dx = moveEvt.clientX - startX;
            const dy = moveEvt.clientY - startY;
            const distSq = dx * dx + dy * dy;
            if (distSq > 400) {
              console.log("[AI-LongPress] Drag detected (distance > 20px):", Math.sqrt(distSq), "cancelling long press");
              isDragging = true;
              isSelecting = true;
              currentWord = null;
              hidePopup();
              if (aiLongPressTimer) {
                clearTimeout(aiLongPressTimer);
                aiLongPressTimer = null;
                cancelLongPressAnimation();
              }
              pendingTranslateWord = null;
              document.removeEventListener("mousemove", onDragMove);
            }
          };
          document.addEventListener("mousemove", onDragMove);
          const onDragEnd = () => {
            console.log("[AI-LongPress] Mouseup on target word. isDragging:", isDragging, "wasWordLongPressTriggered:", wasWordLongPressTriggered);
            document.removeEventListener("mousemove", onDragMove);
            if (wasWordLongPressTriggered) {
              ignoreNextRubyClick = true;
              setTimeout(() => {
                ignoreNextRubyClick = false;
              }, 100);
            }
            if (!isDragging && savedRange) {
              const s = window.getSelection();
              s.removeAllRanges();
              s.addRange(savedRange);
            }
            if (!isDragging && !wasWordLongPressTriggered && transTrigger === "click" && pendingTranslateWord) {
              requestTranslation(pendingTranslateWord);
              pendingTranslateWord = null;
            }
          };
          document.addEventListener("mouseup", onDragEnd, { once: true });
          return;
        }
        pendingTranslateWord = null;
        isSelecting = true;
        currentWord = null;
        endExpandGrace();
        if (hasEditableFocus()) {
          if (popup) popup.style.display = "none";
          return;
        }
        hidePopup();
        cancelLongPressAnimation();
      }, true);
      document.addEventListener("click", (e) => {
        if (!isEnabled) return;
        if (ignoreNextRubyClick) return;
        const ruby = e.target.closest(".jyutping-ruby-injected");
        if (ruby) {
          startRubySpeakingState(ruby);
          ruby.classList.add("jyutping-clicked-hover");
        }
      });
      document.addEventListener("dblclick", (e) => {
        if (!isEnabled) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.some((el) => el.id === "jyutping-shadow-host" || el.id === "cantonese-popup-dict" || el.id === "cantonese-translate-popup")) {
          return;
        }
        const ruby = e.target.closest(".jyutping-ruby-injected");
        if (ruby) {
          e.preventDefault();
          window.getSelection().removeAllRanges();
          let word = ruby.dataset.word;
          if (word && dictionary && dictionary[word]) {
            currentWord = word;
            try {
              currentRange = document.createRange();
              currentRange.selectNodeContents(ruby);
            } catch (err) {
            }
            const bestRect = currentRange ? getBestRectForRange(currentRange) : null;
            showPopup({ word, entry: dictionary[word] }, bestRect || ruby.getBoundingClientRect(), true);
          }
          return;
        }
        if (pendingTranslateWord) {
          e.preventDefault();
          window.getSelection().removeAllRanges();
          if (transTrigger === "dblclick") {
            requestTranslation(pendingTranslateWord);
          }
          pendingTranslateWord = null;
          return;
        }
        if (hasUserSelection) {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          if (text) {
            e.preventDefault();
            if (transTrigger === "dblclick") {
              requestTranslation(text);
            }
          }
        }
      });
      document.addEventListener("mouseup", (e) => {
        if (aiLongPressTimer) {
          console.log("[AI] mouseup 清除長按計時器");
          clearTimeout(aiLongPressTimer);
          aiLongPressTimer = null;
          cancelLongPressAnimation();
        }
        if (!isSelecting) return;
        setTimeout(() => {
          isSelecting = false;
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText.length > 1 && /[\u4e00-\u9fff]/.test(selectedText)) {
            hasUserSelection = true;
            hidePopup();
          } else {
            hasUserSelection = false;
          }
        }, 50);
      }, true);
      document.addEventListener("scroll", () => {
        if (popup && popup.querySelector(".popup-qa-container")) return;
        if (translatePopup && translatePopup.querySelector(".popup-qa-container")) return;
        hidePopup();
        const sel = window.getSelection();
        if (!sel || sel.toString().trim().length === 0) {
          hasUserSelection = false;
        }
        hideTranslatePopup();
        if (aiLongPressTimer) {
          clearTimeout(aiLongPressTimer);
          aiLongPressTimer = null;
        }
        cancelLongPressAnimation();
      }, true);
      document.addEventListener("mousedown", (e) => {
        if (!isEnabled || paragraphTransKey !== "longpress") return;
        if (e.button !== 0) return;
        if (hasUserSelection) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.some((el) => el.id === "jyutping-shadow-host" || el.id === "cantonese-popup-dict" || el.id === "cantonese-translate-popup")) return;
        const startX = e.clientX, startY = e.clientY;
        if (!findTranslatableBlock(startX, startY)) return;
        let triggered = false;
        let animTimer = setTimeout(() => {
          startLongPressAnimation(startX, startY);
        }, 150);
        let pressTimer = setTimeout(() => {
          pressTimer = null;
          triggered = true;
          if (longPressRing) {
            longPressRing.classList.add("done");
            setTimeout(() => {
              longPressRing.classList.remove("done");
              longPressRing.classList.remove("active");
            }, 300);
          }
          translateBlockAtPoint(startX, startY);
        }, 600);
        const cleanup = () => {
          if (animTimer) {
            clearTimeout(animTimer);
            animTimer = null;
          }
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            cancelLongPressAnimation();
          }
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp, true);
        };
        const onMove = (mv) => {
          const dx = mv.clientX - startX, dy = mv.clientY - startY;
          if (dx * dx + dy * dy > 64) cleanup();
        };
        const onUp = () => {
          if (triggered) {
            const onClick = (ce) => {
              ce.preventDefault();
              ce.stopPropagation();
              document.removeEventListener("click", onClick, true);
            };
            document.addEventListener("click", onClick, true);
            setTimeout(() => document.removeEventListener("click", onClick, true), 400);
          }
          cleanup();
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp, true);
      }, true);
      function isEditableElement2(target) {
        if (!target) return false;
        const tagName = target.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
        if (target.isContentEditable) return true;
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
          return true;
        }
        return false;
      }
      const lastParaKeyTapTime = {};
      let hadNonModifierKeyPressed = false;
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Shift" && e.key !== "Alt" && e.key !== "Control" && e.key !== "Meta") {
          hadNonModifierKeyPressed = true;
        } else if (!e.repeat) {
          hadNonModifierKeyPressed = false;
        }
        if (e.key === "Escape") {
          hidePopup();
          hideTranslatePopup();
          hasUserSelection = false;
        }
        const keyMap = { "alt": "Alt", "ctrl": "Control", "shift": "Shift", "meta": "Meta" };
        if (!isEditableElement2(e.target) && e.key === keyMap[hoverModifier] && currentMouseX !== 0 && currentMouseY !== 0) {
          console.log("[Debug] Trigger key pressed! Key:", e.key, "mouseX:", currentMouseX, "mouseY:", currentMouseY);
          lastX = currentMouseX;
          lastY = currentMouseY;
          handleMouseOver({
            clientX: currentMouseX,
            clientY: currentMouseY,
            altKey: e.altKey || e.key === "Alt",
            ctrlKey: e.ctrlKey || e.key === "Control",
            shiftKey: e.shiftKey || e.key === "Shift",
            metaKey: e.metaKey || e.key === "Meta",
            isTriggerKey: true
          });
          if (popupDisplayStyle === "full" && ttsEnabled && currentWord && dictionary[currentWord]) {
            speakCantonese(dictionary[currentWord].traditional || currentWord);
          }
        }
      });
      document.addEventListener("keyup", (e) => {
        if (!isEnabled || paragraphTransKey === "off" || paragraphTransKey === "longpress") return;
        if (isEditableElement2(e.target)) return;
        if (hadNonModifierKeyPressed) return;
        const now = Date.now();
        const key = e.key;
        if (paragraphTransKey === "double_shift" && key === "Shift") {
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          const last = lastParaKeyTapTime["Shift"] || 0;
          if (now - last < 350) {
            lastParaKeyTapTime["Shift"] = 0;
            translateBlockAtPoint(currentMouseX, currentMouseY);
          } else {
            lastParaKeyTapTime["Shift"] = now;
          }
        } else if (paragraphTransKey === "double_alt" && key === "Alt") {
          if (e.ctrlKey || e.shiftKey || e.metaKey) return;
          const last = lastParaKeyTapTime["Alt"] || 0;
          if (now - last < 350) {
            lastParaKeyTapTime["Alt"] = 0;
            translateBlockAtPoint(currentMouseX, currentMouseY);
          } else {
            lastParaKeyTapTime["Alt"] = now;
          }
        } else if (paragraphTransKey === "double_ctrl" && key === "Control") {
          if (e.altKey || e.shiftKey || e.metaKey) return;
          const last = lastParaKeyTapTime["Control"] || 0;
          if (now - last < 350) {
            lastParaKeyTapTime["Control"] = 0;
            translateBlockAtPoint(currentMouseX, currentMouseY);
          } else {
            lastParaKeyTapTime["Control"] = now;
          }
        } else if (paragraphTransKey === "shift" && key === "Shift") {
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            translateBlockAtPoint(currentMouseX, currentMouseY);
          }
        } else if (paragraphTransKey === "alt" && key === "Alt") {
          if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
            translateBlockAtPoint(currentMouseX, currentMouseY);
          }
        } else if (paragraphTransKey === "ctrl" && key === "Control") {
          if (!e.altKey && !e.shiftKey && !e.metaKey) {
            translateBlockAtPoint(currentMouseX, currentMouseY);
          }
        } else if (paragraphTransKey === "meta" && key === "Meta") {
          if (!e.altKey && !e.shiftKey && !e.ctrlKey) {
            translateBlockAtPoint(currentMouseX, currentMouseY);
          }
        }
      });
    }
    function handleMouseOver(e) {
      if (!isEnabled) return;
      const targetNode = e.target;
      if (targetNode && targetNode.closest && (targetNode.closest("#cantonese-popup-dict") || targetNode.closest("#cantonese-translate-popup"))) {
        return;
      }
      if (!e.isTriggerKey && popup && popup.querySelector(".popup-qa-container")) return;
      if (!e.isTriggerKey && translatePopup && translatePopup.querySelector(".popup-qa-container")) return;
      if (!e.isTriggerKey && translatePopup && translatePopup.style.display !== "none") {
        if (!isMouseOverPopup) {
          scheduleHidePopup();
        }
        return;
      }
      if (!e.isTriggerKey && isMouseOverPopup) return;
      if (!e.isTriggerKey && isInExpandGrace()) return;
      const modifierPressed = popupDisplayStyle === "compact" || hoverModifier === "none" || hoverModifier === "alt" && e.altKey || hoverModifier === "ctrl" && e.ctrlKey || hoverModifier === "shift" && e.shiftKey || hoverModifier === "meta" && e.metaKey;
      const clientX = e.clientX;
      const clientY = e.clientY;
      let originalPointerEvents = "";
      let originalTranslatePointerEvents = "";
      if (e.isTriggerKey) {
        if (popup) {
          originalPointerEvents = popup.style.pointerEvents;
          popup.style.pointerEvents = "none";
        }
        if (translatePopup) {
          originalTranslatePointerEvents = translatePopup.style.pointerEvents;
          translatePopup.style.pointerEvents = "none";
        }
      }
      const targetElement = document.elementFromPoint(clientX, clientY);
      if (e.isTriggerKey) {
        if (popup) popup.style.pointerEvents = originalPointerEvents;
        if (translatePopup) translatePopup.style.pointerEvents = originalTranslatePointerEvents;
      }
      if (!e.isTriggerKey && targetElement && (targetElement.closest("#cantonese-popup-dict") || targetElement.closest("#cantonese-translate-popup"))) {
        return;
      }
      const rubyElement = targetElement && targetElement.closest(".jyutping-ruby-injected");
      if (rubyElement) {
        cancelScheduledHide();
        const word = rubyElement.dataset.word;
        if (word && dictionary[word]) {
          justNavigated = false;
          if (currentWord !== word || highlightedRubyElement !== rubyElement) {
            removeHighlight();
            highlightedRubyElement = rubyElement;
            currentWord = word;
            currentContextSentence = word;
            currentRange = document.createRange();
            currentRange.selectNodeContents(rubyElement);
          }
          const result2 = { word, entry: dictionary[word] };
          const actualModifierPressed = hoverModifier === "alt" && e.altKey || hoverModifier === "ctrl" && e.ctrlKey || hoverModifier === "shift" && e.shiftKey || hoverModifier === "meta" && e.metaKey;
          if (actualModifierPressed) {
            const bestRect = currentRange ? getBestRectForRange(currentRange) : null;
            console.log("[Debug] hover-ruby early block actualModifierPressed. bestRect:", bestRect);
            showPopup(result2, bestRect || rubyElement.getBoundingClientRect());
          } else {
            scheduleHideIfMouseOutside();
          }
        } else {
          maybeScheduleHide();
        }
        return;
      }
      if (targetElement && (targetElement.classList.contains("jyutping-highlight") || targetElement.closest(".jyutping-hover-ruby"))) {
        if (!popup || popup.getAttribute("data-current-word") === currentWord) {
          cancelScheduledHide();
        }
        if (modifierPressed && popup && currentWord && dictionary[currentWord]) {
          console.log("[Debug] highlight early block modifierPressed=true. word:", currentWord);
          if (popup.style.display === "none" || popup.getAttribute("data-current-word") !== currentWord) {
            const result2 = { word: currentWord, entry: dictionary[currentWord] };
            const bestRect = currentRange ? getBestRectForRange(currentRange) : null;
            console.log("[Debug] highlight early block calling showPopup. bestRect:", bestRect);
            showPopup(result2, bestRect || (currentRange ? currentRange.getBoundingClientRect() : {
              left: clientX,
              right: clientX,
              top: clientY,
              bottom: clientY,
              width: 0,
              height: 0
            }));
          }
        }
        return;
      }
      if (e.isTriggerKey) {
        if (popup) popup.style.pointerEvents = "none";
        if (translatePopup) translatePopup.style.pointerEvents = "none";
      }
      let range = getCaretRangeFromPointInShadow(clientX, clientY);
      if (e.isTriggerKey) {
        if (popup) popup.style.pointerEvents = originalPointerEvents;
        if (translatePopup) translatePopup.style.pointerEvents = originalTranslatePointerEvents;
      }
      if (!range) {
        maybeScheduleHide();
        return;
      }
      const previousWord = currentWord;
      if (highlightSpans.length > 0) {
        removeHighlight();
        if (e.isTriggerKey) {
          if (popup) popup.style.pointerEvents = "none";
          if (translatePopup) translatePopup.style.pointerEvents = "none";
        }
        range = getCaretRangeFromPointInShadow(clientX, clientY);
        if (e.isTriggerKey) {
          if (popup) popup.style.pointerEvents = originalPointerEvents;
          if (translatePopup) translatePopup.style.pointerEvents = originalTranslatePointerEvents;
        }
        if (!range) {
          maybeScheduleHide();
          return;
        }
      }
      const textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) {
        maybeScheduleHide();
        return;
      }
      const offset = getAccurateOffset(textNode, clientX, clientY);
      if (offset === -1) {
        maybeScheduleHide();
        return;
      }
      const text = textNode.textContent;
      currentContextSentence = text.trim();
      const searchText = text.substring(offset, offset + 15);
      const result = lookupWord(searchText);
      if (result) {
        justNavigated = false;
        highlightText(textNode, offset, result);
        if (previousWord === result.word && popup.style.display !== "none") {
          currentWord = result.word;
          cancelScheduledHide();
          return;
        }
        currentWord = result.word;
        if (currentRange) {
          const bestRect = getBestRectForRange(currentRange);
          if (modifierPressed || popupDisplayStyle === "ruby" || popupDisplayStyle === "compact") {
            showPopup(result, bestRect || currentRange.getBoundingClientRect());
          } else {
            scheduleHideIfMouseOutside();
          }
        } else {
          if (modifierPressed || popupDisplayStyle === "ruby" || popupDisplayStyle === "compact") {
            showPopup(result, {
              left: clientX,
              right: clientX,
              top: clientY,
              bottom: clientY,
              width: 0,
              height: 0
            });
          } else {
            scheduleHideIfMouseOutside();
          }
        }
      } else {
        currentWord = null;
        maybeScheduleHide();
      }
    }
    function lookupWord(text) {
      if (!text) return null;
      if (!/[\u4e00-\u9fff]/.test(text)) {
        return null;
      }
      for (let len = Math.min(text.length, 8); len > 0; len--) {
        const word = text.substring(0, len);
        if (dictionary[word]) {
          return {
            word,
            entry: dictionary[word],
            length: len
          };
        }
      }
      return null;
    }
    function getSubwordCandidates(word) {
      if (!word || typeof word !== "string" || word.length <= 1 || !dictionary) return [];
      const candidates = [word];
      const seen = /* @__PURE__ */ new Set([word]);
      for (let len = word.length - 1; len >= 2; len--) {
        for (let i = 0; i <= word.length - len; i++) {
          const sub = word.substr(i, len);
          if (!seen.has(sub) && dictionary[sub]) {
            seen.add(sub);
            candidates.push(sub);
          }
        }
      }
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (!seen.has(char) && dictionary[char]) {
          seen.add(char);
          candidates.push(char);
        }
      }
      return candidates;
    }
    function scheduleHideFlyout() {
      if (flyoutHideTimeout) clearTimeout(flyoutHideTimeout);
      flyoutHideTimeout = setTimeout(() => {
        if (popupSubwordsFlyout) popupSubwordsFlyout.style.display = "none";
        flyoutHideTimeout = null;
      }, 200);
    }
    function cancelHideFlyout() {
      if (flyoutHideTimeout) {
        clearTimeout(flyoutHideTimeout);
        flyoutHideTimeout = null;
      }
    }
    function showSelectionSpeakerPopup(rect, textToSpeak) {
      if (!popup) return null;
      const popupMain = popup.querySelector(".popup-main");
      const popupExamples = popup.querySelector(".popup-examples");
      const popupTranslate = popup.querySelector(".popup-translate");
      const actionsWrapper = popup.querySelector(".popup-actions-wrapper");
      const reportForm = popup.querySelector(".popup-report-form");
      if (popupExamples) popupExamples.style.display = "none";
      if (popupTranslate) popupTranslate.style.display = "none";
      if (actionsWrapper) actionsWrapper.style.display = "none";
      if (reportForm) reportForm.style.display = "none";
      popup.classList.remove("expanded-mode");
      hideTranslatePopup();
      applyCompactStyles();
      popup.classList.add("compact-mode");
      popupMain.innerHTML = `
      <div class="compact-pronunciation" style="padding: 2px 8px;">
        <button class="tts-speaker-btn speaking" title="播放發音" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; margin: 0; color: var(--popup-accent);">
          <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
    `;
      const speakerBtn = popupMain.querySelector(".tts-speaker-btn");
      if (speakerBtn) {
        speakerBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          speakCantonese(textToSpeak, speakerBtn);
        });
      }
      if (rect) {
        popup.style.visibility = "hidden";
        popup.style.display = "block";
        const popupWidth = popup.offsetWidth || 44;
        const popupHeight = popup.offsetHeight || 36;
        const viewportWidth = window.innerWidth;
        const ARROW_HEIGHT = 8;
        const GAP = 2;
        let left = rect.left + rect.width / 2 - popupWidth / 2;
        if (left + popupWidth > viewportWidth - 5) left = viewportWidth - popupWidth - 5;
        if (left < 5) left = 5;
        let top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
        let arrowDirection = "down";
        if (top < 5) {
          top = rect.bottom + GAP + ARROW_HEIGHT;
          arrowDirection = "up";
        }
        popup.style.position = "absolute";
        popup.style.left = left + window.scrollX + "px";
        popup.style.top = top + window.scrollY + "px";
        if (popupArrow) {
          popupArrow.className = "popup-arrow popup-arrow-" + arrowDirection;
          const highlightCenterX = rect.left + rect.width / 2;
          let arrowCenter = highlightCenterX - left;
          arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
          popupArrow.style.left = arrowCenter + "px";
        }
        popup.style.visibility = "visible";
      } else {
        popup.style.display = "block";
        if (popupArrow) popupArrow.className = "popup-arrow popup-arrow-hidden";
      }
      popup.style.pointerEvents = "auto";
      return speakerBtn;
    }
    function applyCompactStyles() {
      if (!popup) return;
      popup.style.setProperty("width", "max-content", "important");
      popup.style.setProperty("min-width", "unset", "important");
      popup.style.setProperty("max-width", "320px", "important");
      const inner = popup.querySelector(".popup-inner");
      if (inner) {
        inner.style.setProperty("width", "auto", "important");
        inner.style.setProperty("min-width", "unset", "important");
        inner.style.setProperty("height", "auto", "important");
      }
      const container = popup.querySelector(".popup-container");
      if (container) {
        container.style.setProperty("width", "auto", "important");
      }
      const popupMain = popup.querySelector(".popup-main");
      if (popupMain) {
        popupMain.style.setProperty("width", "auto", "important");
        popupMain.style.setProperty("min-width", "unset", "important");
        popupMain.style.setProperty("padding", "2px 8px", "important");
      }
    }
    function removeCompactStyles() {
      if (!popup) return;
      popup.style.removeProperty("width");
      popup.style.removeProperty("min-width");
      popup.style.removeProperty("max-width");
      popup.style.removeProperty("background");
      popup.style.removeProperty("box-shadow");
      popup.style.removeProperty("border");
      popup.style.removeProperty("padding");
      popup.style.removeProperty("margin");
      popup.style.removeProperty("pointer-events");
      popup.classList.remove("popup-ruby-mode");
      popup.classList.remove("with-bg");
      popup.classList.remove("fade-bg");
      popup.classList.remove("dark-bg");
      const classesToRemove = [];
      popup.classList.forEach((cls) => {
        if (cls.startsWith("hl-ruby-")) {
          classesToRemove.push(cls);
        }
      });
      classesToRemove.forEach((cls) => popup.classList.remove(cls));
      const inner = popup.querySelector(".popup-inner");
      if (inner) {
        inner.style.removeProperty("width");
        inner.style.removeProperty("min-width");
        inner.style.removeProperty("height");
        inner.style.removeProperty("background");
        inner.style.removeProperty("border");
        inner.style.removeProperty("box-shadow");
        inner.style.removeProperty("padding");
        inner.style.removeProperty("margin");
      }
      const container = popup.querySelector(".popup-container");
      if (container) {
        container.style.removeProperty("width");
        container.style.removeProperty("padding");
        container.style.removeProperty("margin");
        container.style.removeProperty("background");
      }
      const popupMain = popup.querySelector(".popup-main");
      if (popupMain) {
        popupMain.style.removeProperty("width");
        popupMain.style.removeProperty("min-width");
        popupMain.style.removeProperty("padding");
        popupMain.style.removeProperty("margin");
        popupMain.style.removeProperty("background");
      }
    }
    function showCompactPopup(result, entry, pronunciation, rect) {
      if (!pronunciation) {
        hidePopup();
        return;
      }
      const popupMain = popup.querySelector(".popup-main");
      const popupExamples = popup.querySelector(".popup-examples");
      const popupTranslate = popup.querySelector(".popup-translate");
      const actionsWrapper = popup.querySelector(".popup-actions-wrapper");
      const reportForm = popup.querySelector(".popup-report-form");
      popupExamples.style.display = "none";
      popupExamples.innerHTML = "";
      if (popupTranslate) {
        popupTranslate.style.display = "none";
        popupTranslate.innerHTML = "";
      }
      if (actionsWrapper) actionsWrapper.style.display = "none";
      if (reportForm) reportForm.style.display = "none";
      popup.classList.remove("expanded-mode");
      hideTranslatePopup();
      applyCompactStyles();
      popup.classList.add("compact-mode");
      popupMain.innerHTML = `
      <div class="compact-pronunciation">
        <span class="compact-text">${pronunciation}</span>
      </div>
    `;
      if (compactExpandBtn) {
        const expandBtn = document.createElement("span");
        expandBtn.className = "compact-expand-btn";
        let iconUrl = "";
        try {
          iconUrl = chrome.runtime.getURL("icon_favicon.svg");
        } catch (e) {
          console.warn("[Content] Failed to get URL, extension might be reloaded.", e);
        }
        expandBtn.innerHTML = `<img src="${iconUrl}" style="width: 14px; height: 14px; filter: grayscale(100%); transition: filter 0.15s ease; vertical-align: middle; display: block; pointer-events: none;" />`;
        expandBtn.title = "Show full dictionary";
        expandBtn.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          beginExpandGrace();
          showPopup(result, rect, true);
        });
        const compactPron = popupMain.querySelector(".compact-pronunciation");
        if (compactPron) compactPron.appendChild(expandBtn);
      }
      const compactText = popupMain.querySelector(".compact-text");
      if (compactText) {
        compactText.style.cursor = "pointer";
        compactText.addEventListener("pointerup", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          speakCantonese(entry.traditional, null, { jyutping: entry.jyutping || "", preferWordshk: true });
          compactText.classList.remove("playing");
          void compactText.offsetWidth;
          compactText.classList.add("playing");
        });
      }
      if (rect) {
        popup.style.visibility = "hidden";
        popup.style.display = "block";
        const popupWidth = popup.offsetWidth || 120;
        const popupHeight = popup.offsetHeight || 36;
        const viewportWidth = window.innerWidth;
        const ARROW_HEIGHT = 8;
        const GAP = 2;
        let left = rect.left + rect.width / 2 - popupWidth / 2;
        if (left + popupWidth > viewportWidth - 5) left = viewportWidth - popupWidth - 5;
        if (left < 5) left = 5;
        let top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
        let arrowDirection = "down";
        if (top < 5) {
          top = rect.bottom + GAP + ARROW_HEIGHT;
          arrowDirection = "up";
        }
        popup.style.position = "absolute";
        popup.style.left = left + window.scrollX + "px";
        popup.style.top = top + window.scrollY + "px";
        if (popupArrow) {
          popupArrow.className = "popup-arrow popup-arrow-" + arrowDirection;
          const highlightCenterX = rect.left + rect.width / 2;
          let arrowCenter = highlightCenterX - left;
          arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
          popupArrow.style.left = arrowCenter + "px";
        }
        popup.style.visibility = "visible";
      } else {
        popup.style.display = "block";
        if (popupArrow) popupArrow.className = "popup-arrow popup-arrow-hidden";
      }
      popup.style.pointerEvents = "auto";
    }
    function applyRubyStyles() {
      if (!popup) return;
      popup.style.setProperty("width", "max-content", "important");
      popup.style.setProperty("min-width", "unset", "important");
      popup.style.setProperty("max-width", "320px", "important");
      popup.style.setProperty("background", "transparent", "important");
      popup.style.setProperty("box-shadow", "none", "important");
      popup.style.setProperty("border", "none", "important");
      popup.style.setProperty("padding", "0", "important");
      popup.style.setProperty("margin", "0", "important");
      const inner = popup.querySelector(".popup-inner");
      if (inner) {
        inner.style.setProperty("width", "auto", "important");
        inner.style.setProperty("min-width", "unset", "important");
        inner.style.setProperty("height", "auto", "important");
        inner.style.setProperty("background", "transparent", "important");
        inner.style.setProperty("border", "none", "important");
        inner.style.setProperty("box-shadow", "none", "important");
        inner.style.setProperty("padding", "0", "important");
        inner.style.setProperty("margin", "0", "important");
      }
      const container = popup.querySelector(".popup-container");
      if (container) {
        container.style.setProperty("width", "auto", "important");
        container.style.setProperty("padding", "0", "important");
        container.style.setProperty("margin", "0", "important");
        container.style.setProperty("background", "transparent", "important");
      }
      const popupMain = popup.querySelector(".popup-main");
      if (popupMain) {
        popupMain.style.setProperty("width", "auto", "important");
        popupMain.style.setProperty("min-width", "unset", "important");
        popupMain.style.setProperty("padding", "0", "important");
        popupMain.style.setProperty("margin", "0", "important");
        popupMain.style.setProperty("background", "transparent", "important");
      }
    }
    function showRubyFloatingPopup(result, entry, pronunciation, rect) {
      if (!pronunciation) {
        hidePopup();
        return;
      }
      const popupMain = popup.querySelector(".popup-main");
      const popupExamples = popup.querySelector(".popup-examples");
      const popupTranslate = popup.querySelector(".popup-translate");
      const actionsWrapper = popup.querySelector(".popup-actions-wrapper");
      const reportForm = popup.querySelector(".popup-report-form");
      popupExamples.style.display = "none";
      popupExamples.innerHTML = "";
      if (popupTranslate) {
        popupTranslate.style.display = "none";
        popupTranslate.innerHTML = "";
      }
      if (actionsWrapper) actionsWrapper.style.display = "none";
      if (reportForm) reportForm.style.display = "none";
      popup.classList.remove("expanded-mode");
      popup.classList.remove("compact-mode");
      hideTranslatePopup();
      applyRubyStyles();
      popup.classList.add("popup-ruby-mode");
      popup.classList.remove("with-bg", "fade-bg");
      if (rubyRtBackground === "solid") {
        popup.classList.add("with-bg");
      } else if (rubyRtBackground === "fade") {
        popup.classList.add("fade-bg");
      }
      let isDark = false;
      let bgColor = "rgba(255, 255, 255, 0.9)";
      if (currentRange && currentRange.startContainer) {
        const parent = currentRange.startContainer.nodeType === Node.TEXT_NODE ? currentRange.startContainer.parentElement : currentRange.startContainer;
        const detectedColor = getElementBackgroundColor(parent);
        if (detectedColor) {
          bgColor = detectedColor;
        }
        isDark = isElementOnDarkBackground(parent);
      }
      if (isDark) {
        popup.classList.add("dark-bg");
      } else {
        popup.classList.remove("dark-bg");
      }
      const hoverColorClass = "hl-ruby-" + (rubyHoverStyle || "ruby-red");
      const classesToRemove = [];
      popup.classList.forEach((cls) => {
        if (cls.startsWith("hl-ruby-")) {
          classesToRemove.push(cls);
        }
      });
      classesToRemove.forEach((cls) => popup.classList.remove(cls));
      popup.classList.add(hoverColorClass);
      let hoverColorVal = "#8A1C1C";
      if (isDark) {
        hoverColorVal = "#FFD54F";
      } else {
        switch (rubyHoverStyle) {
          case "ruby-red":
            hoverColorVal = "#8A1C1C";
            break;
          case "ruby-blue":
            hoverColorVal = "#1565C0";
            break;
          case "ruby-green":
            hoverColorVal = "#2E7D32";
            break;
          case "ruby-orange":
            hoverColorVal = "#E65100";
            break;
          case "ruby-purple":
            hoverColorVal = "#6A1B9A";
            break;
        }
      }
      popup.style.setProperty("--ruby-hover-color", hoverColorVal, "important");
      popupMain.innerHTML = `
      <span class="ruby-floating-text" style="cursor: pointer;">${pronunciation}</span>
    `;
      const rubyText = popupMain.querySelector(".ruby-floating-text");
      if (rubyText) {
        rubyText.addEventListener("pointerup", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          speakCantonese(entry.traditional, null, { jyutping: entry.jyutping || "", preferWordshk: true });
          rubyText.style.opacity = "0.5";
          setTimeout(() => rubyText.style.opacity = "1", 200);
        });
      }
      popup.style.pointerEvents = "auto";
      if (rect) {
        popup.style.visibility = "hidden";
        popup.style.display = "block";
        const popupWidth = popup.offsetWidth || 60;
        const popupHeight = popup.offsetHeight || 16;
        const viewportWidth = window.innerWidth;
        let left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(5, Math.min(left, viewportWidth - popupWidth - 5));
        const floatingText = popupMain.querySelector(".ruby-floating-text");
        const textHeight = floatingText ? floatingText.offsetHeight : popupHeight;
        let top;
        if (rubyRtBackground === "solid") {
          top = rect.top - textHeight - 4;
        } else {
          top = rect.top - textHeight - 5;
        }
        if (top < 2) {
          top = rect.bottom + (rubyRtBackground === "solid" ? 2 : 1);
        }
        popup.style.position = "absolute";
        popup.style.left = left + window.scrollX + "px";
        popup.style.top = top + window.scrollY + "px";
        if (popupArrow) popupArrow.className = "popup-arrow popup-arrow-hidden";
        popup.style.visibility = "visible";
        if (rubyRtBackground === "fade") {
          showRubyFadeMask(left + window.scrollX, top + window.scrollY, popupWidth, textHeight, bgColor);
        } else {
          hideRubyFadeMask();
        }
      } else {
        popup.style.display = "block";
        if (popupArrow) popupArrow.className = "popup-arrow popup-arrow-hidden";
      }
    }
    function showRubyFadeMask(x, y, w, h, bgColor) {
      if (!rubyFadeMask) {
        rubyFadeMask = document.createElement("div");
        rubyFadeMask.id = "jyutping-ruby-fade-mask";
        document.body.appendChild(rubyFadeMask);
      }
      const padX = 8;
      const padTop = 0;
      const padBottom = 2;
      const maskW = w + padX * 2;
      const maskH = h + padTop + padBottom;
      let solidBgColor = bgColor;
      if (bgColor.startsWith("rgba")) {
        solidBgColor = bgColor.replace(/rgba\((.*?),\s*[\d.]+\)/, "rgb($1)");
      }
      rubyFadeMask.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 2147483644;
      background-color: ${solidBgColor};
      border: none;
      left: ${x - padX}px;
      top: ${y - padTop + 4}px;
      width: ${maskW}px;
      height: ${maskH}px;
      -webkit-mask-image:
        linear-gradient(to right, transparent, black ${padX}px, black calc(100% - ${padX}px), transparent),
        linear-gradient(to bottom, transparent, black ${padTop}px, black calc(100% - ${padBottom}px), transparent);
      -webkit-mask-composite: destination-in;
      mask-image:
        linear-gradient(to right, transparent, black ${padX}px, black calc(100% - ${padX}px), transparent),
        linear-gradient(to bottom, transparent, black ${padTop}px, black calc(100% - ${padBottom}px), transparent);
      mask-composite: intersect;
      display: block;
    `;
    }
    function hideRubyFadeMask() {
      if (rubyFadeMask) {
        rubyFadeMask.style.display = "none";
      }
    }
    async function requestYueDefTranslation(text, targetLang, engine) {
      try {
        const bgPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Background timeout")), 4e3);
          chrome.runtime.sendMessage({
            action: "translateYueDef",
            text,
            targetLang,
            engine
          }, (resp) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          });
        });
        const bgResp = await bgPromise;
        if (bgResp && bgResp.success && bgResp.translation) {
          return bgResp.translation;
        }
      } catch (bgErr) {
        console.warn("[Popup] Background translation failed/timed out, trying direct client fetch:", bgErr);
      }
      try {
        let googleTo = "zh-CN";
        if (targetLang === "en") googleTo = "en";
        else if (targetLang === "ja") googleTo = "ja";
        else if (targetLang === "ko") googleTo = "ko";
        else if (targetLang === "zh-Hant" || targetLang === "zh-TW" || targetLang === "zh-HK") googleTo = "zh-TW";
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${googleTo}&dt=t&q=${encodeURIComponent(text)}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data[0] && Array.isArray(data[0])) {
            const directRes = data[0].map((item) => item[0]).filter(Boolean).join("");
            if (directRes) return directRes;
          }
        }
      } catch (directErr) {
        console.warn("[Popup] Direct Google GTX failed:", directErr);
      }
      try {
        let target = targetLang || "zh-CN";
        if (target === "zh-Hans") target = "zh-CN";
        else if (target === "zh-Hant" || target === "zh-HK") target = "zh-TW";
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-HK|${target}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.responseData && data.responseData.translatedText) return data.responseData.translatedText;
        }
      } catch (myMemErr) {
        console.warn("[Popup] Direct MyMemory failed:", myMemErr);
      }
      throw new Error("All translation channels failed");
    }
    function getTargetLangLabel(targetLang) {
      switch (targetLang) {
        case "zh-Hans":
        case "zh-CN":
          return "普";
        case "zh-Hant":
        case "zh-TW":
        case "zh-HK":
          return "書";
        case "en":
          return "英";
        case "ja":
          return "日";
        case "ko":
          return "韓";
        default:
          return "譯";
      }
    }
    async function translateBadgeElement(badgeEl, defItemEl) {
      const text = badgeEl.dataset.text;
      if (!text) return;
      const targetLang = autoTranslateYueDefsTargetLang || "zh-Hans";
      const engine = autoTranslateYueDefsEngine || "google";
      const mode = yueDefDisplayMode || "expand";
      const cacheKey = `${engine}_${targetLang}_${text}`;
      const cached = yueDefTranslationCache.get(cacheKey);
      const langLabel = getTargetLangLabel(targetLang);
      const yueIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
      const toggleIconSvg = `<svg class="trans-toggle-icon" viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>`;
      if (mode === "replace") {
        const textSpan = defItemEl.querySelector(".def-content-text");
        if (!textSpan) return;
        if (defItemEl.dataset.isReplaced === "true") {
          defItemEl.dataset.isReplaced = "false";
          badgeEl.className = "badge-yue";
          badgeEl.innerHTML = `粵${yueIconSvg}`;
          badgeEl.title = chrome.i18n.getMessage("badgeClickToTranslate") || "點擊翻譯此釋義";
          textSpan.textContent = text;
          return;
        }
        if (cached) {
          defItemEl.dataset.isReplaced = "true";
          badgeEl.className = "badge-trans-lang badge-clickable";
          badgeEl.innerHTML = `${langLabel}${toggleIconSvg}`;
          badgeEl.title = chrome.i18n.getMessage("badgeClickToRestore") || "點擊切換回粵語原文";
          textSpan.textContent = cached;
          return;
        }
        const originalBadgeHtml = badgeEl.innerHTML;
        const originalBadgeClass = badgeEl.className;
        badgeEl.classList.add("loading");
        textSpan.textContent = chrome.i18n.getMessage("badgeTranslating") || "翻譯中...";
        try {
          const translation = await requestYueDefTranslation(text, targetLang, engine);
          badgeEl.classList.remove("loading");
          if (translation) {
            yueDefTranslationCache.set(cacheKey, translation);
            defItemEl.dataset.isReplaced = "true";
            badgeEl.className = "badge-trans-lang badge-clickable";
            badgeEl.innerHTML = `${langLabel}${toggleIconSvg}`;
            badgeEl.title = chrome.i18n.getMessage("badgeClickToRestore") || "點擊切換回粵語原文";
            textSpan.textContent = translation;
          } else {
            badgeEl.className = originalBadgeClass;
            badgeEl.innerHTML = originalBadgeHtml;
            textSpan.textContent = text;
          }
        } catch (e) {
          badgeEl.classList.remove("loading");
          badgeEl.className = originalBadgeClass;
          badgeEl.innerHTML = originalBadgeHtml;
          textSpan.textContent = text;
        }
      } else {
        let transEl = defItemEl.querySelector(".yue-def-translation");
        if (transEl) {
          transEl.style.display = transEl.style.display === "none" ? "flex" : "none";
          return;
        }
        const langBadgeHtml = `<span class="badge-trans-lang">${langLabel}</span>`;
        transEl = document.createElement("div");
        transEl.className = "yue-def-translation";
        transEl.addEventListener("click", (e) => e.stopPropagation());
        defItemEl.appendChild(transEl);
        if (cached) {
          transEl.innerHTML = `${langBadgeHtml}<span>${cached}</span>`;
          return;
        }
        const translatingText = chrome.i18n.getMessage("badgeTranslating") || "翻譯中...";
        transEl.classList.add("loading");
        transEl.innerHTML = `${langBadgeHtml}<span>${translatingText}</span>`;
        try {
          const translation = await requestYueDefTranslation(text, targetLang, engine);
          transEl.classList.remove("loading");
          if (translation) {
            yueDefTranslationCache.set(cacheKey, translation);
            transEl.innerHTML = `${langBadgeHtml}<span>${translation}</span>`;
          } else {
            transEl.innerHTML = `${langBadgeHtml}<span style="color: var(--popup-text-muted); opacity: 0.7;">${chrome.i18n.getMessage("badgeTranslationError") || "翻譯失敗"}</span>`;
          }
        } catch (e) {
          transEl.classList.remove("loading");
          transEl.innerHTML = `${langBadgeHtml}<span style="color: var(--popup-text-muted); opacity: 0.7;">${chrome.i18n.getMessage("badgeTranslationError") || "翻譯失敗"}</span>`;
        }
      }
    }
    function showPopup(result, rect, forceFull = false) {
      console.log("[Debug] showPopup called. word:", result.word, "rect:", rect, "forceFull:", forceFull);
      cancelScheduledHide();
      lastPopupShowTime = Date.now();
      if (activePopupRubyElement) {
        activePopupRubyElement.classList.remove("jyutping-popup-active");
        activePopupRubyElement = null;
      }
      if (currentRange && currentRange.commonAncestorContainer) {
        const container = currentRange.commonAncestorContainer;
        const ruby = container.nodeType === Node.TEXT_NODE ? container.parentElement.closest("ruby") : container.closest ? container.closest("ruby") : null;
        if (ruby) {
          activePopupRubyElement = ruby;
          activePopupRubyElement.classList.add("jyutping-popup-active");
        }
      }
      const entry = result.entry;
      if (popup) popup.setAttribute("data-current-word", result.word);
      hideTranslatePopup();
      lastPopupResult = result;
      if (rect) lastPopupRect = rect;
      if (!justNavigated || !currentSubwordCandidates.includes(result.word)) {
        _currentSubwordRoot = result.word;
        currentSubwordCandidates = getSubwordCandidates(result.word);
      }
      activeQAContext.word = result.word || (result.entry ? result.entry.traditional : "");
      activeQAContext.sentence = getSurroundingSentence(currentRange) || "";
      activeQAContext.originalTranslation = result.entry && result.entry.english ? result.entry.english.join("; ") : "";
      activeQAContext.history = [];
      let pronunciation = displayMode === "yale" ? jyutpingToYale(entry.jyutping) : entry.jyutping;
      if (pronunciation && toneStyle === "superscript" && displayMode !== "yale") {
        pronunciation = convertToSuperscriptTone(pronunciation);
      }
      if (popupDisplayStyle === "ruby" && !forceFull) {
        showRubyFloatingPopup(result, entry, pronunciation, rect);
        return;
      }
      if (popupDisplayStyle === "compact" && !forceFull) {
        showCompactPopup(result, entry, pronunciation, rect);
        return;
      }
      let parentElem = null;
      if (currentRange && currentRange.startContainer) {
        parentElem = currentRange.startContainer.nodeType === Node.TEXT_NODE ? currentRange.startContainer.parentElement : currentRange.startContainer;
      }
      applyPopupTheme(null, parentElem);
      const posEntries = entry.entries && Array.isArray(entry.entries) && entry.entries.length > 0 ? entry.entries : [
        {
          id: 0,
          pos: "",
          pronunciations: [
            {
              jyutping: entry.jyutping || "",
              yale: entry.yale || ""
            }
          ],
          defs: (entry.english || []).map((e, idx) => ({
            yue: e.startsWith("[粵]") ? e.slice(3).trim() : "",
            eng: e.startsWith("[粵]") ? "" : e,
            egs: entry.examples?.[idx] || []
          }))
        }
      ];
      let currentActiveEntryIndex = 0;
      let currentEntryObj = posEntries[0];
      function updateActiveContext(curEntry) {
        const activePr = curEntry.pronunciations?.[0] || { jyutping: entry.jyutping || "", yale: entry.yale || "" };
        const activeEnglish = [];
        (curEntry.defs || []).forEach((d) => {
          if (d.yue) activeEnglish.push(`[粵] ${d.yue}`);
          if (d.eng) activeEnglish.push(d.eng);
        });
        currentActiveReading = {
          word: result.word,
          jyutping: activePr.jyutping || entry.jyutping || "",
          yale: jyutpingToYale(activePr.jyutping || entry.jyutping || ""),
          english: activeEnglish
        };
        activeQAContext.originalTranslation = activeEnglish.join("; ");
      }
      updateActiveContext(currentEntryObj);
      function generatePronunciationHtml(entryObj) {
        const prs = entryObj.pronunciations || [];
        if (prs.length === 0 && entry.jyutping) {
          prs.push({ jyutping: entry.jyutping, yale: entry.yale || "" });
        }
        if (prs.length === 0) return "";
        const label = displayMode === "yale" ? "Yale" : pt("jyutpingLabel") || "粵拼";
        const buttonsHtml = prs.map((pr, idx) => {
          let p = displayMode === "yale" ? jyutpingToYale(pr.jyutping || entry.jyutping) : pr.jyutping;
          if (p && toneStyle === "superscript" && displayMode !== "yale") {
            p = convertToSuperscriptTone(p);
          }
          return `
          <button type="button" class="reading-speaker-btn" data-jyutping="${pr.jyutping}" data-pr-index="${idx}" title="${pt("speakThisPr") || "點擊朗讀此讀音"}">
            <span class="reading-pr-text">${wrapSyllablesInSpans(p)}</span>
            <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        `;
        }).join('<span class="reading-separator">/</span>');
        return `
        <div class="pronunciation-section">
          <span class="pronunciation-label">${label}:</span>
          <div class="reading-speaker-list">
            ${buttonsHtml}
          </div>
        </div>
      `;
      }
      function generateDefinitionHtml(entryObj) {
        if (!entryObj || !entryObj.defs || entryObj.defs.length === 0) return "";
        const badgeTitle = pt("badgeClickToTranslate") || "點擊翻譯此釋義";
        const defItems = entryObj.defs.slice(0, 8).map((d, index) => {
          let className = "def-item";
          const hasExamples = Boolean(d.egs && Array.isArray(d.egs) && d.egs.length > 0);
          if (hasExamples) className += " has-examples";
          let innerHtml = "";
          if (d.yue) {
            className += " def-yue";
            const rawText = d.yue.trim();
            const cleanTranslateText = rawText.replace(/<[^>]+>/g, "").trim();
            innerHtml = `
            <div class="def-main-row">
              <span class="badge-yue" data-text="${cleanTranslateText.replace(/"/g, "&quot;")}" title="${badgeTitle}" role="button">粵<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></span>
              <span class="def-content-text">${rawText}</span>
              ${hasExamples ? '<span class="example-arrow-icon"> ▷</span>' : ""}
            </div>
            ${d.eng ? `<div class="def-eng-row">${d.eng}</div>` : ""}
          `;
          } else if (d.eng) {
            innerHtml = `
            <div class="def-main-row">
              <span class="def-content-text">${d.eng}</span>
              ${hasExamples ? '<span class="example-arrow-icon"> ▷</span>' : ""}
            </div>
          `;
          }
          return `<div class="${className}" ${hasExamples ? `data-example-index="${index}"` : ""}>${innerHtml}</div>`;
        }).join("");
        return `<div class="definition-section">${defItems}</div>`;
      }
      function generatePosTabsHtml(entries, activeIdx) {
        if (!entries || entries.length <= 1) return "";
        const pillsHtml = entries.map((e, idx) => {
          const posLabel = `${idx + 1} ${translatePos(e.pos)}`;
          return `
          <button type="button" class="pos-tab-pill ${idx === activeIdx ? "active" : ""}" data-entry-index="${idx}">
            ${posLabel}
          </button>
        `;
        }).join("");
        return `
        <div class="pos-tabs-bar">
          ${pillsHtml}
        </div>
      `;
      }
      const hasSubwords = currentSubwordCandidates && currentSubwordCandidates.length > 1;
      let html = `
      <div class="word-section ${hasSubwords ? "has-subwords" : ""}">
        <span class="word-text">${entry.traditional}${hasSubwords ? `<span class="word-subwords-hint" title="${pt("hoverSubwords") || "懸停查看相關詞與單字"}">◂</span>` : ""}</span>
        ${entry.simplified !== entry.traditional ? `<span class="word-simplified">${entry.simplified}</span>` : ""}
      </div>
      ${generatePronunciationHtml(currentEntryObj)}
      ${generateDefinitionHtml(currentEntryObj)}
    `;
      const refLines = [];
      if (entry.sims && entry.sims.length > 0) {
        const simLinks = entry.sims.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">${pt("seeAlsoSynonym")}</span>${simLinks}</div>`);
      }
      if (entry.ants && entry.ants.length > 0) {
        const antLinks = entry.ants.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">${pt("seeAlsoAntonym")}</span>${antLinks}</div>`);
      }
      if (entry.see_also && entry.see_also.length > 0) {
        const seeLinks = entry.see_also.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">${pt("seeAlsoVariant")}</span>${seeLinks}</div>`);
      }
      if (entry.cantonese && entry.cantonese.length > 0) {
        const yueLinks = entry.cantonese.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">${pt("seeAlsoCantonese")}</span>${yueLinks}</div>`);
      }
      if (entry.mandarin && entry.mandarin.length > 0) {
        const manTexts = entry.mandarin.slice(0, 8).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">${pt("seeAlsoMandarin")}</span>${manTexts}</div>`);
      }
      if (refLines.length > 0) {
        html += `<div class="see-also-section">${refLines.join("")}</div>`;
      }
      html += generatePosTabsHtml(posEntries, currentActiveEntryIndex);
      const popupMain = popup.querySelector(".popup-main");
      const popupExamples = popup.querySelector(".popup-examples");
      const popupTranslate = popup.querySelector(".popup-translate");
      popupExamples.style.display = "none";
      popupExamples.innerHTML = "";
      if (popupTranslate) {
        popupTranslate.style.display = "none";
        popupTranslate.innerHTML = "";
      }
      popupMain.innerHTML = "";
      popup.classList.remove("expanded-mode");
      popup.classList.remove("compact-mode");
      removeCompactStyles();
      popup.style.width = "320px";
      const actionsWrapper = popup.querySelector(".popup-actions-wrapper");
      if (actionsWrapper) actionsWrapper.style.display = "flex";
      const reportForm = popup.querySelector(".popup-report-form");
      if (reportForm) reportForm.style.display = "none";
      popupMain.innerHTML = html;
      function bindPronunciationEvents(container, curEntry) {
        container.querySelectorAll(".reading-speaker-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const jp = btn.dataset.jyutping;
            const prEl = btn.querySelector(".reading-pr-text");
            speakCantonese(entry.traditional, btn, {
              jyutping: jp,
              preferWordshk: true,
              onSyllableChange: (sylIdx) => highlightSpeakingSyllable(prEl, sylIdx)
            });
          });
        });
      }
      function bindDefinitionEvents(container, curEntry) {
        container.querySelectorAll(".badge-yue").forEach((badge) => {
          badge.addEventListener("click", (e) => {
            e.stopPropagation();
            const defItem = badge.closest(".def-item");
            if (defItem) translateBadgeElement(badge, defItem);
          });
        });
        if (enableAutoTranslateYueDefs) {
          container.querySelectorAll(".badge-yue").forEach((badge) => {
            const defItem = badge.closest(".def-item");
            if (defItem) translateBadgeElement(badge, defItem);
          });
        }
        container.querySelectorAll(".has-examples").forEach((el) => {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (el.classList.contains("active")) {
              el.classList.remove("active");
              popupExamples.style.display = "none";
              popup.classList.remove("expanded-mode");
              popup.style.width = "320px";
              adjustPopupPosition();
              return;
            }
            container.querySelectorAll(".def-item").forEach((d) => d.classList.remove("active"));
            el.classList.add("active");
            const index = parseInt(el.dataset.exampleIndex, 10);
            const examples = curEntry.defs?.[index]?.egs;
            if (examples && examples.length > 0) {
              renderExamples(examples);
              popupExamples.style.display = "block";
              popup.classList.add("expanded-mode");
              popup.style.width = "640px";
              adjustPopupPosition();
            }
          });
        });
        container.querySelectorAll(".see-also-link").forEach((link) => {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const word = link.dataset.word;
            if (dictionary[word]) {
              isMouseOverPopup = true;
              justNavigated = true;
              currentWord = word;
              showPopup({ word, entry: dictionary[word], length: word.length }, null);
              isMouseOverPopup = true;
            }
          });
        });
      }
      function bindPosTabsEvents(container) {
        container.querySelectorAll(".pos-tab-pill").forEach((pill) => {
          pill.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = parseInt(pill.dataset.entryIndex, 10);
            lastTabSwitchTime = Date.now();
            isMouseOverPopup = true;
            currentActiveEntryIndex = idx;
            const targetEntry = posEntries[idx];
            updateActiveContext(targetEntry);
            if (popupExamples) {
              popupExamples.style.display = "none";
              popupExamples.innerHTML = "";
            }
            popup.classList.remove("expanded-mode");
            popup.style.width = "320px";
            popup.style.minHeight = "";
            container.querySelectorAll(".pos-tab-pill").forEach((p) => p.classList.remove("active"));
            pill.classList.add("active");
            const oldPrSec = popupMain.querySelector(".pronunciation-section");
            if (oldPrSec) {
              const tempWrapper = document.createElement("div");
              tempWrapper.innerHTML = generatePronunciationHtml(targetEntry);
              const newPrSec = tempWrapper.firstElementChild;
              if (newPrSec) {
                oldPrSec.replaceWith(newPrSec);
                bindPronunciationEvents(newPrSec, targetEntry);
              }
            }
            const oldDefSec = popupMain.querySelector(".definition-section");
            if (oldDefSec) {
              const tempWrapper = document.createElement("div");
              tempWrapper.innerHTML = generateDefinitionHtml(targetEntry);
              const newDefSec = tempWrapper.firstElementChild;
              if (newDefSec) {
                oldDefSec.replaceWith(newDefSec);
                bindDefinitionEvents(newDefSec, targetEntry);
              }
            }
            const targetRect = rect || lastPopupRect;
            if (targetRect && popupArrow && popupArrow.classList.contains("popup-arrow-down")) {
              const ARROW_HEIGHT = 8;
              const GAP = 2;
              const newHeight = popup.offsetHeight;
              popup.style.top = targetRect.top - newHeight - GAP - ARROW_HEIGHT + window.scrollY + "px";
            }
            const firstPr = targetEntry.pronunciations?.[0];
            if (firstPr && firstPr.jyutping) {
              const firstBtn = popupMain.querySelector(".reading-speaker-btn");
              const prEl = firstBtn ? firstBtn.querySelector(".reading-pr-text") : null;
              speakCantonese(entry.traditional, firstBtn, {
                jyutping: firstPr.jyutping,
                preferWordshk: true,
                onSyllableChange: (sylIdx) => highlightSpeakingSyllable(prEl, sylIdx)
              });
            }
          });
        });
      }
      const prSection = popupMain.querySelector(".pronunciation-section");
      if (prSection) {
        bindPronunciationEvents(prSection, currentEntryObj);
      }
      const defSection = popupMain.querySelector(".definition-section");
      if (defSection) {
        bindDefinitionEvents(defSection, currentEntryObj);
      }
      const posTabsBar = popupMain.querySelector(".pos-tabs-bar");
      if (posTabsBar) {
        bindPosTabsEvents(posTabsBar);
      }
      isWordSaved(result.word).then((saved) => {
        updateBookmarkBtnState(saved);
      });
      const wordSection = popupMain.querySelector(".word-section");
      if (wordSection) {
        wordSection.style.cursor = "pointer";
        wordSection.addEventListener("click", (e) => {
          e.stopPropagation();
          const activePr = posEntries[currentActiveEntryIndex]?.pronunciations?.[0];
          const curJp = activePr ? activePr.jyutping : entry.jyutping || "";
          const firstBtn = popupMain.querySelector(".reading-speaker-btn");
          speakCantonese(entry.traditional, firstBtn, {
            jyutping: curJp,
            preferWordshk: false
          });
        });
      }
      if (popupSubwordsFlyout) {
        if (hasSubwords) {
          popupSubwordsFlyout.innerHTML = currentSubwordCandidates.map((w) => `
          <div class="subword-item ${w === result.word ? "active" : ""}" data-word="${w}">${w}</div>
        `).join("");
          popupSubwordsFlyout.querySelectorAll(".subword-item").forEach((item) => {
            item.addEventListener("click", (e) => {
              e.stopPropagation();
              const targetWord = item.dataset.word;
              if (dictionary[targetWord] && targetWord !== currentWord) {
                isMouseOverPopup = true;
                justNavigated = true;
                currentWord = targetWord;
                showPopup({ word: targetWord, entry: dictionary[targetWord], length: targetWord.length }, null);
                isMouseOverPopup = true;
                if (popupSubwordsFlyout) {
                  popupSubwordsFlyout.querySelectorAll(".subword-item").forEach((el) => {
                    if (el.dataset.word === targetWord) {
                      el.classList.add("active");
                    } else {
                      el.classList.remove("active");
                    }
                  });
                  popupSubwordsFlyout.style.display = "block";
                }
              }
            });
          });
          if (wordSection) {
            wordSection.addEventListener("mouseenter", () => {
              cancelHideFlyout();
              popupSubwordsFlyout.style.display = "block";
              popupSubwordsFlyout.classList.remove("flyout-right");
              const flyoutWidth = popupSubwordsFlyout.offsetWidth || 80;
              const popupRect = popup.getBoundingClientRect();
              const viewportWidth = window.innerWidth;
              const popupWidth = popup.offsetWidth;
              const requiredLeftSpace = flyoutWidth + 6 + 10;
              if (popupRect.left < requiredLeftSpace) {
                const shiftX = requiredLeftSpace - popupRect.left;
                const maxAllowedLeft = viewportWidth - popupWidth - 10;
                const newClientLeft = Math.min(popupRect.left + shiftX, maxAllowedLeft);
                if (newClientLeft >= requiredLeftSpace) {
                  popup.style.left = newClientLeft + window.scrollX + "px";
                  const targetRect = rect || lastPopupRect;
                  if (popupArrow && targetRect) {
                    const highlightCenterX = targetRect.left + targetRect.width / 2;
                    let arrowCenter = highlightCenterX - newClientLeft;
                    arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
                    popupArrow.style.left = arrowCenter + "px";
                  }
                } else if (newClientLeft < 60) {
                  popupSubwordsFlyout.classList.add("flyout-right");
                }
              }
            });
            wordSection.addEventListener("mouseleave", () => {
              scheduleHideFlyout();
            });
          }
          popupSubwordsFlyout.addEventListener("mouseenter", () => {
            cancelHideFlyout();
            isMouseOverPopup = true;
          });
          popupSubwordsFlyout.addEventListener("mouseleave", () => {
            scheduleHideFlyout();
          });
        } else {
          popupSubwordsFlyout.style.display = "none";
        }
      }
      popup.querySelectorAll(".see-also-link").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const word = link.dataset.word;
          if (dictionary[word]) {
            isMouseOverPopup = true;
            justNavigated = true;
            currentWord = word;
            showPopup({ word, entry: dictionary[word], length: word.length }, null);
            isMouseOverPopup = true;
          }
        });
      });
      if (rect) {
        popup.style.visibility = "hidden";
        popup.style.display = "block";
        const popupWidth = popup.offsetWidth || (popup.classList.contains("expanded-mode") ? 640 : 320);
        const popupHeight = popup.offsetHeight || 150;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let left, top;
        let arrowDirection = "up";
        const ARROW_HEIGHT = 8;
        const GAP = 2;
        const highlightCenterX = rect.left + rect.width / 2;
        left = highlightCenterX - popupWidth / 2;
        let estimatedFlyoutWidth = 75;
        if (hasSubwords && currentSubwordCandidates) {
          const maxLen = Math.max(...currentSubwordCandidates.map((w) => w.length), 2);
          estimatedFlyoutWidth = Math.max(80, maxLen * 16 + 36);
        }
        const minLeftMargin = hasSubwords ? estimatedFlyoutWidth + 16 : 5;
        if (left < minLeftMargin) {
          left = minLeftMargin;
        }
        if (left + popupWidth > viewportWidth - 5) {
          left = viewportWidth - popupWidth - 5;
        }
        if (rect.bottom + GAP + ARROW_HEIGHT + popupHeight <= viewportHeight) {
          top = rect.bottom + GAP + ARROW_HEIGHT;
          arrowDirection = "up";
        } else {
          top = rect.top - popupHeight - GAP - ARROW_HEIGHT;
          arrowDirection = "down";
          if (top < 5) {
            top = 5;
            arrowDirection = "up";
          }
        }
        popup.style.position = "absolute";
        popup.style.left = left + window.scrollX + "px";
        popup.style.top = top + window.scrollY + "px";
        if (popupArrow) {
          popupArrow.className = "popup-arrow popup-arrow-" + arrowDirection;
          const highlightCenterX2 = rect.left + rect.width / 2;
          let arrowCenter = highlightCenterX2 - left;
          arrowCenter = Math.max(16, Math.min(arrowCenter, popupWidth - 16));
          popupArrow.style.left = arrowCenter + "px";
        }
        popup.style.visibility = "visible";
      } else {
        popup.style.display = "block";
        if (popupArrow) popupArrow.className = "popup-arrow popup-arrow-hidden";
      }
      popup.style.pointerEvents = "auto";
    }
    function renderExamples(examples) {
      const popupExamples = popup.querySelector(".popup-examples");
      const loadingText = paragraphTransEngine === "bing" ? "使用 Bing 翻譯中…" : "使用 AI 翻譯中…";
      let html = `<div class="example-title">${pt("examples") || "例句"}</div>`;
      examples.forEach((eg, i) => {
        const engPart = eg.eng ? `<div class="example-eng">${eg.eng}</div>` : "";
        html += `
        <div class="example-item">
          <div class="example-yue">
            <span class="example-yue-text">${eg.yue}</span>
            <button class="tts-speaker-btn example-tts-btn" data-index="${i}" title="${pt("playExample") || "播放例句"}" aria-label="${pt("playExample") || "播放例句"}">
              <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
          </div>
          ${engPart}
        </div>
      `;
      });
      popupExamples.innerHTML = html;
      const exampleBtns = popupExamples.querySelectorAll(".example-tts-btn");
      exampleBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = btn.getAttribute("data-index");
          if (examples[index] && examples[index].yue) {
            speakCantonese(examples[index].yue, btn);
          }
        });
      });
    }
    function adjustPopupPosition() {
      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const targetWidth = 640;
      if (rect.left + targetWidth > viewportWidth) {
        let newLeft = viewportWidth - targetWidth - 10;
        if (newLeft < 5) newLeft = 5;
        popup.style.left = newLeft + "px";
      }
    }
    function cancelScheduledHide() {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    }
    function beginExpandGrace() {
      expandGraceUntil = performance.now() + EXPAND_GRACE_MS;
    }
    function endExpandGrace() {
      expandGraceUntil = 0;
    }
    function isInExpandGrace() {
      return performance.now() < expandGraceUntil;
    }
    function canAutoHide() {
      if (isInExpandGrace()) return false;
      if (popup && popup.querySelector(".popup-qa-container")) return false;
      if (translatePopup && translatePopup.querySelector(".popup-qa-container")) return false;
      if (popup && popup.classList.contains("jyutping-popup-pinned")) return false;
      if (translatePopup && translatePopup.classList.contains("jyutping-popup-pinned")) return false;
      return true;
    }
    function maybeScheduleHide() {
      if (!justNavigated) scheduleHidePopup();
    }
    function scheduleHideIfMouseOutside() {
      if (popup && popup.style.display !== "none" && !isMouseOverPopup) {
        scheduleHidePopup();
      }
    }
    function scheduleHidePopup(delay = 150) {
      cancelScheduledHide();
      if (!canAutoHide()) return;
      let actualDelay = delay;
      if (translatePopup && translatePopup.style.display !== "none") {
        actualDelay = Math.max(actualDelay, 300);
      }
      hideTimeout = setTimeout(() => {
        if (!isMouseOverPopup) {
          hidePopup();
        }
        hideTimeout = null;
      }, actualDelay);
    }
    function hidePopup(keepHighlight = false) {
      currentActiveReading = null;
      if (activePopupRubyElement) {
        activePopupRubyElement.classList.remove("jyutping-popup-active");
        activePopupRubyElement = null;
      }
      if (popupSubwordsFlyout) {
        popupSubwordsFlyout.style.display = "none";
      }
      cancelHideFlyout();
      _currentSubwordRoot = "";
      currentSubwordCandidates = [];
      if (popup) {
        popup.classList.remove("jyutping-popup-pinned");
        popup.style.display = "none";
        popup.style.minHeight = "";
        lastTabSwitchTime = 0;
        hideRubyFadeMask();
        removeCompactStyles();
        const qaContainer = popup.querySelector(".popup-qa-container");
        if (qaContainer) {
          qaContainer.remove();
        }
        const qaUpperDisplay = popup.querySelector(".qa-upper-display");
        if (qaUpperDisplay) {
          qaUpperDisplay.remove();
        }
        const inner = popup.querySelector(".popup-inner");
        if (inner) {
          Array.from(inner.children).forEach((child) => {
            if (child.className !== "popup-qa-container" && child.className !== "qa-upper-display") {
              child.style.display = "";
            }
          });
        }
      }
      hideTranslatePopup();
      if (!hasUserSelection && !keepHighlight) {
        currentWord = null;
        removeHighlight();
      }
      clearQAContext();
    }
    function highlightText(textNode, offset, result) {
      try {
        removeHighlight();
        const length = result.length;
        const end = Math.min(offset + length, textNode.textContent.length);
        const originalText = textNode.textContent.substring(offset, end);
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, end);
        let wrapper;
        if (popupDisplayStyle === "ruby") {
          wrapper = document.createElement("ruby");
          wrapper.className = "jyutping-hover-ruby hl-" + (rubyHoverStyle || "ruby-red");
          console.log("[Jyutping] Creating hover ruby. rubyRtBackground:", rubyRtBackground, "rubyHoverStyle:", rubyHoverStyle);
          if (rubyRtBackground === "solid") {
            wrapper.classList.add("with-bg");
          } else if (rubyRtBackground === "fade") {
            wrapper.classList.add("fade-bg");
          }
          if (isElementOnDarkBackground(textNode.parentElement)) {
            wrapper.classList.add("dark-bg");
          }
          wrapper.dataset.originalText = originalText;
          wrapper.dataset.word = result.word;
          wrapper.appendChild(document.createTextNode(originalText));
          range.deleteContents();
          range.insertNode(wrapper);
        } else {
          wrapper = document.createElement("span");
          wrapper.className = "jyutping-highlight hl-" + (highlightStyle || "yellow");
          range.surroundContents(wrapper);
        }
        highlightSpans.push(wrapper);
        currentRange = document.createRange();
        currentRange.selectNodeContents(wrapper);
      } catch (e) {
        console.log("Highlight failed:", e);
        try {
          const range = document.createRange();
          range.setStart(textNode, offset);
          range.setEnd(textNode, Math.min(offset + result.length, textNode.textContent.length));
          currentRange = range;
        } catch (e2) {
          console.log("Fallback range also failed:", e2);
        }
      }
    }
    function removeHighlight() {
      highlightSpans.forEach((span) => {
        if (span && span.parentNode) {
          const parent = span.parentNode;
          if (span.tagName === "RUBY") {
            const originalText = span.dataset.originalText || span.textContent.replace(/[a-zA-Z0-9\u200A]+/g, "");
            const textNode = document.createTextNode(originalText);
            parent.insertBefore(textNode, span);
          } else {
            while (span.firstChild) {
              parent.insertBefore(span.firstChild, span);
            }
          }
          parent.removeChild(span);
          parent.normalize();
        }
      });
      highlightSpans = [];
      if (highlightedRubyElement) {
        highlightedRubyElement.classList.remove("jyutping-highlight", "jyutping-clicked-hover");
        highlightedRubyElement.classList.remove("hl-yellow", "hl-blue", "hl-red", "hl-green", "hl-gray", "hl-underline-dashed", "hl-border-dashed");
        highlightedRubyElement = null;
      }
      currentRange = null;
    }
    function findTranslatableBlock(x, y) {
      let el = document.elementFromPoint(x, y);
      if (!el) return null;
      if (el.closest("#cantonese-popup-dict, #cantonese-translate-popup, .jyutping-cantonese-trans")) return null;
      if (isEditableElement(el)) return null;
      const BLOCK_TAGS = /* @__PURE__ */ new Set([
        "P",
        "LI",
        "BLOCKQUOTE",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "DD",
        "DT",
        "FIGCAPTION",
        "TD",
        "TH",
        "ARTICLE",
        "SECTION",
        "DIV",
        "PRE"
      ]);
      let node = el;
      while (node && node !== document.body && node.nodeType === 1) {
        const disp = window.getComputedStyle(node).display;
        const isBlock = BLOCK_TAGS.has(node.tagName) || /block|list-item|table-cell|flow-root/.test(disp);
        if (isBlock && node.textContent.trim().length > 0) return node;
        node = node.parentElement;
      }
      return null;
    }
    function translateBlockAtPoint(x, y) {
      if (x === 0 && y === 0) return;
      const block = findTranslatableBlock(x, y);
      if (!block) return;
      const existingId = block.getAttribute("data-jyutping-trans-id");
      if (existingId) {
        removeBlockTranslation(block);
        return;
      }
      const id = ++paraTransSeq;
      const container = document.createElement("div");
      const ALLOWED_INLINE_TAGS = /* @__PURE__ */ new Set(["span", "a", "b", "strong", "i", "em", "sup", "sub", "font", "ruby", "rt", "br", "label", "time", "mark", "q", "cite", "code"]);
      let hasTextContent = false;
      for (const child of block.childNodes) {
        if (child.nodeType === 3) {
          if (child.textContent.trim()) hasTextContent = true;
          container.appendChild(child.cloneNode(true));
        } else if (child.nodeType === 1) {
          const tag = child.tagName.toLowerCase();
          if (ALLOWED_INLINE_TAGS.has(tag)) {
            if (child.textContent.trim()) hasTextContent = true;
            container.appendChild(child.cloneNode(true));
          }
        }
      }
      const html = container.innerHTML;
      const tempContainer = container.cloneNode(true);
      tempContainer.querySelectorAll("br").forEach((br) => br.replaceWith("\\n"));
      const textContent = tempContainer.textContent.trim();
      if (!html || !hasTextContent) return;
      const hasComplexMedia = !!block.querySelector('video, iframe, [data-module-type="video"], [class*="video"]');
      const isReplaceMode = paragraphTransMode === "replace" && !hasComplexMedia;
      const translationEl = createTranslationPlaceholder(block);
      block.setAttribute("data-jyutping-trans-id", String(id));
      pendingParaTrans.set(id, { block, translationEl, isReplaceMode });
      chrome.runtime.sendMessage({ action: "aiTranslateParagraph", id, html, textContent, direction: paragraphTransDirection });
    }
    function createTranslationPlaceholder(block) {
      const loadingText = paragraphTransEngine === "bing" ? "使用 Bing 翻译" : "使用 AI 翻译";
      const clone = document.createElement("span");
      clone.style.display = "inline-block";
      clone.style.marginLeft = "8px";
      clone.style.fontSize = "0.95em";
      clone.classList.add("jyutping-cantonese-trans", "notranslate", "jyutping-loading-container");
      clone.setAttribute("translate", "no");
      clone.innerHTML = `<span class="jyutping-cantonese-trans-loading"><span class="jyutping-loading-spinner"></span>${loadingText}</span>`;
      let insertBeforeNode = null;
      const childNodes = Array.from(block.childNodes);
      for (let i = childNodes.length - 1; i >= 0; i--) {
        const node = childNodes[i];
        if (node.nodeType === 3 && node.textContent.trim().length > 0) break;
        if (node.nodeType === 1) {
          const tag = node.tagName.toLowerCase();
          if (["span", "a", "sup", "sub", "strong", "em", "b", "i", "font"].includes(tag)) break;
        }
        insertBeforeNode = node;
      }
      if (insertBeforeNode) {
        block.insertBefore(clone, insertBeforeNode);
      } else {
        block.appendChild(clone);
      }
      return clone;
    }
    function removeBlockTranslation(block) {
      const id = block.getAttribute("data-jyutping-trans-id");
      block.removeAttribute("data-jyutping-trans-id");
      const origDisplay = block.getAttribute("data-jyutping-original-display");
      if (origDisplay !== null) {
        block.style.display = origDisplay;
        block.removeAttribute("data-jyutping-original-display");
      }
      if (id && pendingParaTrans.has(Number(id))) {
        const entry = pendingParaTrans.get(Number(id));
        if (entry.translationEl && entry.translationEl.parentNode) entry.translationEl.remove();
        pendingParaTrans.delete(Number(id));
        return;
      }
      const sib = block.nextElementSibling;
      if (sib && sib.classList.contains("jyutping-cantonese-trans")) sib.remove();
      const child = block.querySelector(":scope > .jyutping-cantonese-trans");
      if (child) child.remove();
    }
    function applyParagraphTranslation(id, success, payloadHtml, error, isPlainText = false) {
      const entry = pendingParaTrans.get(id);
      if (!entry) return;
      pendingParaTrans.delete(id);
      const { block, translationEl, isReplaceMode } = entry;
      if (!translationEl || !translationEl.parentNode) {
        if (block) block.removeAttribute("data-jyutping-trans-id");
        return;
      }
      if (success && payloadHtml) {
        let finalTargetEl = translationEl;
        if (isReplaceMode) {
          const tag = block.tagName;
          let replaceClone;
          if (tag === "TD" || tag === "TH" || tag === "LI" || tag === "DT" || tag === "DD") {
            replaceClone = document.createElement("div");
          } else {
            replaceClone = block.cloneNode(false);
          }
          replaceClone.classList.add("jyutping-cantonese-trans", "notranslate", "jyutping-cantonese-trans-replace");
          replaceClone.setAttribute("translate", "no");
          replaceClone.removeAttribute("id");
          replaceClone.removeAttribute("data-jyutping-trans-id");
          block.setAttribute("data-jyutping-original-display", block.style.display || "");
          block.style.display = "none";
          if (block.nextSibling) {
            block.parentNode.insertBefore(replaceClone, block.nextSibling);
          } else {
            block.parentNode.appendChild(replaceClone);
          }
          translationEl.remove();
          finalTargetEl = replaceClone;
        } else {
          finalTargetEl.classList.remove("jyutping-loading-container");
          finalTargetEl.innerHTML = "";
          finalTargetEl.style.display = "block";
          finalTargetEl.style.marginTop = "6px";
          finalTargetEl.style.paddingTop = "6px";
          finalTargetEl.style.marginLeft = "0";
        }
        if (isPlainText) {
          finalTargetEl.textContent = payloadHtml;
          finalTargetEl.style.whiteSpace = "pre-wrap";
        } else {
          finalTargetEl.innerHTML = sanitizeTranslatedHtml(payloadHtml);
        }
        const speakerIcon = document.createElement("button");
        speakerIcon.className = "jyutping-speaker-btn";
        speakerIcon.innerHTML = `
        <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      `;
        speakerIcon.title = paragraphTransDirection === "target_to_yue" ? "朗讀粵語翻譯" : "朗讀翻譯";
        speakerIcon.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const textToSpeak = finalTargetEl.textContent.trim();
          speakCantonese(textToSpeak, speakerIcon);
        });
        finalTargetEl.appendChild(speakerIcon);
      } else {
        translationEl.remove();
        if (block) block.removeAttribute("data-jyutping-trans-id");
        showToast("粵語翻譯失敗：" + (error || "未知錯誤"));
      }
    }
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggleEnabled") {
        isEnabled = request.enabled;
        if (!isEnabled) {
          hidePopup();
          if (isFullPageRubyActive) removeRubyAnnotations(document.body);
        } else {
          if (isFullPageRubyActive) injectRubyAnnotations(document.body);
        }
      } else if (request.action === "changeHoverModifier") {
        hoverModifier = request.modifier;
        if (hoverModifier !== "none" && popup && !isMouseOverPopup) {
          hidePopup();
        }
      } else if (request.action === "changeDisplayMode") {
        displayMode = request.mode;
      } else if (request.action === "changeToneStyle") {
        toneStyle = request.style;
      } else if (request.action === "changePopupDisplayStyle") {
        popupDisplayStyle = request.style;
      } else if (request.action === "changeCompactExpandBtn") {
        compactExpandBtn = request.enabled;
      } else if (request.action === "changeRubyRtBackground") {
        rubyRtBackground = request.value;
      } else if (request.action === "changeHighlightStyle") {
        if (request.style && request.style.startsWith("ruby-")) {
          rubyHoverStyle = request.style;
        } else {
          highlightStyle = request.style;
        }
      } else if (request.action === "changePopupTheme") {
        popupTheme = request.theme;
        applyPopupTheme(popupTheme);
      } else if (request.action === "changePopupThemeMode") {
        popupThemeMode = request.mode;
        applyPopupTheme();
      } else if (request.action === "changePopupThemeDay") {
        popupThemeDay = request.theme;
        applyPopupTheme();
      } else if (request.action === "changePopupThemeNight") {
        popupThemeNight = request.theme;
        applyPopupTheme();
      } else if (request.action === "changePopupThemeDayStart") {
        popupThemeDayStart = request.val;
        applyPopupTheme();
      } else if (request.action === "changePopupThemeNightStart") {
        popupThemeNightStart = request.val;
        applyPopupTheme();
      } else if (request.action === "changeCustomFont") {
        if (request.customZhFont !== void 0) customZhFont = request.customZhFont;
        if (request.customEnFont !== void 0) {
          customEnFont = request.customEnFont;
          if (rubyTextStyle !== "dictionary") {
            if (customEnFont) {
              document.documentElement.style.setProperty("--jyutping-rt-font", customEnFont, "important");
            } else {
              document.documentElement.style.removeProperty("--jyutping-rt-font");
            }
          }
        }
        applyPopupTheme();
      } else if (request.action === "changeTtsEnabled") {
        ttsEnabled = request.ttsEnabled;
        if (ttsEnabled) attachAudioUnlockListeners();
        else releaseAudioContext();
      } else if (request.action === "changeTtsEngine") {
        ttsEngine = request.ttsEngine;
      } else if (request.action === "changeEdgeTtsUrl") {
        edgeTtsUrl = request.edgeTtsUrl;
      } else if (request.action === "changeEdgeTtsMode") {
        edgeTtsMode = request.edgeTtsMode;
      } else if (request.action === "changeAzureTtsKey") {
        azureTtsKey = request.azureTtsKey;
      } else if (request.action === "changeAzureTtsRegion") {
        azureTtsRegion = request.azureTtsRegion;
      } else if (request.action === "changeAzureTtsVoice") {
        azureTtsVoice = request.azureTtsVoice;
      } else if (request.action === "changeTtsRate") {
        ttsRate = request.ttsRate;
      } else if (request.action === "changeTransLangs") {
        transLangs = request.transLangs;
      } else if (request.action === "changeTransLang") {
        let tls = request.transLang;
        if (tls === "both") transLangs = ["zh-Hans", "en"];
        else if (tls === "mandarin") transLangs = ["zh-Hans"];
        else if (tls === "english") transLangs = ["en"];
      } else if (request.action === "changeTransTrigger") {
        transTrigger = request.transTrigger;
      } else if (request.action === "changeTransHoverEngine") {
        transHoverEngine = request.transHoverEngine;
      } else if (request.action === "changeEnableAutoTranslateYueDefs") {
        enableAutoTranslateYueDefs = request.enableAutoTranslateYueDefs === true;
      } else if (request.action === "changeAutoTranslateYueDefsTargetLang") {
        autoTranslateYueDefsTargetLang = request.autoTranslateYueDefsTargetLang;
      } else if (request.action === "changeAutoTranslateYueDefsEngine") {
        autoTranslateYueDefsEngine = request.autoTranslateYueDefsEngine;
      } else if (request.action === "changeYueDefDisplayMode") {
        yueDefDisplayMode = request.yueDefDisplayMode || "expand";
      } else if (request.action === "playAudio") {
        const rawAudioData = request.audioData;
        if (!rawAudioData) {
          console.warn("[Content] playAudio received empty audioData");
          return;
        }
        const audioSrc = rawAudioData.startsWith("data:") ? createBlobUrlFromDataUri(rawAudioData) : rawAudioData;
        if (pendingTtsText) {
          if (ttsCache.size >= TTS_CACHE_MAX) {
            const firstKey = ttsCache.keys().next().value;
            const oldAudioSrc = ttsCache.get(firstKey);
            if (oldAudioSrc && oldAudioSrc.startsWith("blob:")) {
              URL.revokeObjectURL(oldAudioSrc);
            }
            ttsCache.delete(firstKey);
          }
          ttsCache.set(pendingTtsText, audioSrc);
          pendingTtsText = "";
        }
        if (request.sessionId && request.sessionId !== currentAudioSessionId) {
          return;
        }
        if (pendingTtsSessionId !== -1 && pendingTtsSessionId !== currentAudioSessionId) {
          return;
        }
        const sessionId = request.sessionId || (pendingTtsSessionId !== -1 ? pendingTtsSessionId : ++currentAudioSessionId);
        pendingTtsSessionId = -1;
        stopActiveAudioNodes();
        try {
          const ctx = unlockAudioContext();
          let abPromise;
          if (rawAudioData && rawAudioData.startsWith("data:")) {
            const ab = base64ToArrayBuffer(rawAudioData);
            if (ab) {
              abPromise = Promise.resolve(ab);
            } else {
              abPromise = fetch(audioSrc).then((res) => res.arrayBuffer());
            }
          } else {
            abPromise = fetch(audioSrc).then((res) => res.arrayBuffer());
          }
          abPromise.then((ab) => ctx.decodeAudioData(ab.slice(0))).then((audioBuffer) => {
            if (sessionId !== currentAudioSessionId) return;
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            connectNormalized(ctx, source, audioBuffer);
            source.onended = () => {
              releaseSourceChain(source);
              if (sessionId === currentAudioSessionId) {
                stopSpeakerAnimation();
                const idx = activeAudioSourceNodes.indexOf(source);
                if (idx !== -1) activeAudioSourceNodes.splice(idx, 1);
              }
            };
            activeAudioSourceNodes.push(source);
            source.start(0);
            onPlaybackActuallyStarted(audioBuffer.duration);
          }).catch((err) => {
            console.warn("[Content] Web Audio decode failed, falling back to HTML Audio:", err);
            playHtmlAudioFallback(audioSrc, sessionId);
          });
        } catch (err) {
          console.warn("[Content] Web Audio failed, falling back to HTML Audio:", err);
          playHtmlAudioFallback(audioSrc, sessionId);
        }
      } else if (request.action === "translateResult") {
        if (request.success) {
          let trans = request.translations;
          if (!trans && (request.mandarin || request.english)) {
            trans = {};
            if (request.mandarin) trans["zh-Hans"] = request.mandarin;
            if (request.english) trans["en"] = request.english;
          }
          showTranslatePopup(null, trans, false);
        } else {
          showTranslatePopup(null, { "zh-Hans": "❌ " + request.error }, false);
          showToast("翻譯失敗: " + request.error);
        }
      } else if (request.action === "aiTranslateResult") {
        if (request.success) {
          showAiResult(request.word, request.explanation, activeQAContext.targetRect);
          if (activeQAContext.word === request.word) {
            activeQAContext.originalTranslation = request.explanation;
          }
        } else {
          showAiResult(request.word, "❌ " + request.error, activeQAContext.targetRect);
          if (activeQAContext.word === request.word) {
            activeQAContext.originalTranslation = "❌ " + request.error;
          }
        }
      } else if (request.action === "changeAiEnabled") {
        aiEnabled = request.aiEnabled;
      } else if (request.action === "toggleRuby") {
        console.log("[Content] Received toggleRuby message from background");
        toggleRubyAnnotations();
      } else if (request.action === "addToWordbook") {
        const text = (request.text || "").trim();
        if (text) {
          const entry = dictionary && dictionary[text];
          const reading = currentActiveReading && currentActiveReading.word === text ? currentActiveReading : null;
          addWord({
            character: text,
            simplified: entry ? entry.simplified : text,
            jyutping: reading ? reading.jyutping : entry ? entry.jyutping : "",
            yale: reading ? reading.yale || jyutpingToYale(reading.jyutping) : entry ? jyutpingToYale(entry.jyutping) : "",
            english: reading ? reading.english || [] : entry ? entry.english || [] : [],
            sourceUrl: window.location.href,
            sourceTitle: document.title
          }).then((result) => {
            if (result.isNew) {
              showToast(pt("wordbookSaved"), 1500, "success");
            } else {
              showToast(pt("wordbookExists"), 1500, "success");
            }
          }).catch(() => {
            showToast(pt("wordbookSaveFailed"), 1500, "error");
          });
        }
      } else if (request.action === "ttsEnded") {
        stopSpeakerAnimation();
      } else if (request.action === "aiTranslateParagraphResult") {
        applyParagraphTranslation(request.id, request.success, request.html, request.error, request.isPlainText);
      } else if (request.action === "changeParagraphTransKey") {
        paragraphTransKey = request.paragraphTransKey || "off";
      } else if (request.action === "changeParagraphTransMode") {
        paragraphTransMode = request.paragraphTransMode || "below";
      } else if (request.action === "updateParagraphTransEngine") {
        paragraphTransEngine = request.paragraphTransEngine || "bing";
      } else if (request.action === "changeParagraphTransDirection") {
        paragraphTransDirection = request.value || "yue_to_target";
      } else if (request.action === "aiTranslateSentenceLangResult") {
        let row = null;
        if (translatePopup && translatePopup.style.display !== "none") {
          row = translatePopup.querySelector(`.translate-row[data-key="${request.key}"]`);
        }
        if (!row && popup && popup.style.display !== "none") {
          row = popup.querySelector(`.translate-row[data-key="${request.key}"]`);
        }
        if (row) {
          const textEl = row.querySelector(".translate-text");
          const labelEl = row.querySelector(".translate-label");
          if (textEl) {
            if (request.success) {
              textEl.textContent = request.translation;
              textEl.style.opacity = "1";
              if (labelEl) {
                let labelName = "AI";
                if (request.key === "zh-Hans") labelName = pt("mandarin");
                else if (request.key === "en") labelName = pt("english");
                else if (request.key === "ja") labelName = pt("japanese");
                else if (request.key === "ko") labelName = pt("korean");
                labelEl.textContent = labelName;
                labelEl.title = "點擊使用 Bing 重新翻譯";
                labelEl.classList.add("translate-label-ai");
              }
            } else {
              textEl.textContent = "❌ " + request.error;
              textEl.style.opacity = "1";
              if (labelEl) {
                labelEl.textContent = "錯誤";
                labelEl.title = "AI 翻譯失敗，點擊使用 Bing 重新翻譯";
                labelEl.style.cursor = "pointer";
              }
            }
          }
        }
      } else if (request.action === "bingTranslateSentenceLangResult") {
        let row = null;
        if (translatePopup && translatePopup.style.display !== "none") {
          row = translatePopup.querySelector(`.translate-row[data-key="${request.key}"]`);
        }
        if (!row && popup && popup.style.display !== "none") {
          row = popup.querySelector(`.translate-row[data-key="${request.key}"]`);
        }
        if (row) {
          const textEl = row.querySelector(".translate-text");
          const labelEl = row.querySelector(".translate-label");
          if (textEl) {
            if (request.success) {
              textEl.textContent = request.result;
              textEl.style.opacity = "1";
              if (labelEl) {
                if (request.key === "zh-Hans") labelEl.textContent = pt("mandarin");
                else if (request.key === "en") labelEl.textContent = pt("english");
                else if (request.key === "ja") labelEl.textContent = pt("japanese");
                else if (request.key === "ko") labelEl.textContent = pt("korean");
                labelEl.title = "點擊使用 AI 重新翻譯";
                labelEl.classList.remove("translate-label-ai");
              }
            } else {
              textEl.textContent = "❌ " + request.error;
              textEl.style.opacity = "1";
              if (labelEl) {
                labelEl.textContent = "錯誤";
                labelEl.title = "Bing 翻譯失敗，點擊使用 AI 重新翻譯";
                labelEl.style.cursor = "pointer";
              }
            }
          }
        }
      }
    });
    let isFullPageRubyActive = sessionStorage.getItem("jyutping_full_page_ruby") === "true";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (isFullPageRubyActive) {
          toggleRubyAnnotations();
        }
      }
      if (e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (!currentWord) return;
        if (isEditableElement(document.activeElement) || hasEditableFocus()) return;
        if (!popup || popup.style.display === "none") return;
        e.preventDefault();
        e.stopPropagation();
        saveCurrentWordToWordbook();
      }
    });
    async function toggleRubyAnnotations() {
      console.log("[Content] toggleRubyAnnotations called. isEnabled:", isEnabled, "isFullPageRubyActive:", isFullPageRubyActive);
      if (!isEnabled) {
        console.log("[Content] Extension is disabled, aborting toggle.");
        return;
      }
      if (!dictionary || Object.keys(dictionary).length === 0) {
        showToast("正在加載粵語詞典，請稍候...", 1500);
        await loadDictionary();
      }
      isFullPageRubyActive = !isFullPageRubyActive;
      sessionStorage.setItem("jyutping_full_page_ruby", isFullPageRubyActive ? "true" : "false");
      if (isFullPageRubyActive) {
        console.log("[Content] Jyutping Full Page Ruby: ON");
        injectRubyAnnotations(document.body);
        startRubyObserver();
        showToast(tt("toastRubyEnabled"), 2e3, "success");
      } else {
        console.log("Jyutping Full Page Ruby: OFF");
        stopRubyObserver();
        removeRubyAnnotations(document.body);
        showToast(tt("toastRubyDisabled"), 2e3, "error");
      }
    }
    let rubyMutationTimer = null;
    let rubyMutationObserver = null;
    function startRubyObserver() {
      if (rubyMutationObserver) return;
      rubyMutationObserver = new MutationObserver((mutations) => {
        if (!isFullPageRubyActive) return;
        let shouldTrigger = false;
        for (const m of mutations) {
          if (m.type === "childList") {
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === "RUBY" && node.classList.contains("jyutping-ruby-injected")) continue;
                if (node.tagName === "RT") continue;
                if (node.id === "jyutping-toast-container" || node.id === "jyutping-popup") continue;
                if (["script", "style", "noscript"].includes(node.tagName.toLowerCase())) continue;
                shouldTrigger = true;
                break;
              } else if (node.nodeType === Node.TEXT_NODE) {
                if (/[\\u4e00-\\u9fff]/.test(node.textContent)) {
                  if (node.parentElement && node.parentElement.closest("ruby.jyutping-ruby-injected")) continue;
                  shouldTrigger = true;
                  break;
                }
              }
            }
          } else if (m.type === "characterData") {
            if (/[\\u4e00-\\u9fff]/.test(m.target.textContent)) {
              if (m.target.parentElement && m.target.parentElement.closest("ruby.jyutping-ruby-injected")) continue;
              shouldTrigger = true;
              break;
            }
          }
          if (shouldTrigger) break;
        }
        if (shouldTrigger) {
          clearTimeout(rubyMutationTimer);
          rubyMutationTimer = setTimeout(() => {
            if (isFullPageRubyActive) {
              injectRubyAnnotations(document.body);
            }
          }, 500);
        }
      });
      rubyMutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    function stopRubyObserver() {
      if (rubyMutationObserver) {
        rubyMutationObserver.disconnect();
        rubyMutationObserver = null;
      }
      clearTimeout(rubyMutationTimer);
    }
    function removeRubyAnnotations(rootElement) {
      const rubies = rootElement.querySelectorAll("ruby.jyutping-ruby-injected");
      rubies.forEach((ruby) => {
        const wordText = ruby.dataset.word || "";
        if (wordText) {
          const textNode = document.createTextNode(wordText);
          if (ruby.parentNode) {
            ruby.parentNode.replaceChild(textNode, ruby);
          }
        }
      });
      const parents = rootElement.querySelectorAll(".jyutping-ruby-parent");
      parents.forEach((p) => {
        if (!p.querySelector("ruby.jyutping-ruby-injected")) {
          p.classList.remove("jyutping-ruby-parent");
          const originalLh = p.getAttribute("data-jp-original-lh");
          if (originalLh !== null) {
            if (originalLh === "") {
              p.style.removeProperty("line-height");
            } else {
              p.style.setProperty("line-height", originalLh);
            }
            p.removeAttribute("data-jp-original-lh");
          }
        }
      });
      const expandedAncestors = rootElement.querySelectorAll(".jyutping-ruby-expanded");
      expandedAncestors.forEach((p) => {
        if (!p.querySelector("ruby.jyutping-ruby-injected")) {
          p.classList.remove("jyutping-ruby-expanded");
          const origHeight = p.getAttribute("data-jp-original-height");
          if (origHeight !== null) {
            if (origHeight === "") p.style.removeProperty("height");
            else p.style.setProperty("height", origHeight);
            p.removeAttribute("data-jp-original-height");
          }
          const origMinHeight = p.getAttribute("data-jp-original-min-height");
          if (origMinHeight !== null) {
            if (origMinHeight === "") p.style.removeProperty("min-height");
            else p.style.setProperty("min-height", origMinHeight);
            p.removeAttribute("data-jp-original-min-height");
          }
        }
      });
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 500);
    }
    let currentToastTimeout = null;
    let currentToastRemoveTimeout = null;
    function showToast(message, duration = 2e3, type = "") {
      if (window !== window.top) return;
      let container = document.getElementById("jyutping-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "jyutping-toast-container";
        document.body.appendChild(container);
      }
      container.innerHTML = "";
      if (currentToastTimeout) clearTimeout(currentToastTimeout);
      if (currentToastRemoveTimeout) clearTimeout(currentToastRemoveTimeout);
      const toast = document.createElement("div");
      toast.className = "jyutping-toast" + (type ? " jyutping-toast-" + type : "");
      const iconSvg = type === "success" ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : type === "error" ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : "";
      toast.innerHTML = iconSvg + "<span>" + message + "</span>";
      container.appendChild(toast);
      toast.offsetHeight;
      toast.classList.add("show");
      currentToastTimeout = setTimeout(() => {
        toast.classList.remove("show");
        currentToastRemoveTimeout = setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
          if (container.childNodes.length === 0 && container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }, 300);
      }, duration);
    }
    function injectRubyAnnotations(rootElement) {
      console.log("[Content] injectRubyAnnotations started on element:", rootElement);
      if (!dictionary || Object.keys(dictionary).length === 0) {
        console.warn("[Content] Dictionary not loaded or empty! Cannot inject rubies.");
        return;
      }
      console.log("[Content] Dictionary seems valid, total entries:", Object.keys(dictionary).length);
      const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          const parent = node.parentNode;
          if (!parent || !parent.tagName) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toLowerCase();
          if (["script", "style", "noscript", "textarea", "input", "code", "pre", "ruby", "rt", "rp", "option", "optgroup", "title"].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("#jyutping-toast-container, #jyutping-popup")) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.isContentEditable) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!/[\u4e00-\u9fff]/.test(node.textContent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodesToProcess = [];
      let currentNode;
      while (currentNode = walker.nextNode()) {
        nodesToProcess.push(currentNode);
      }
      console.log(`[Content] Found ${nodesToProcess.length} text nodes containing Chinese characters.`);
      let replacedWordsCount = 0;
      const BATCH_SIZE = 50;
      function processNode(node) {
        const text = node.textContent;
        const fragment = document.createDocumentFragment();
        let currentIndex = 0;
        let nonChineseBuffer = "";
        while (currentIndex < text.length) {
          const char = text[currentIndex];
          if (/[\u4e00-\u9fff]/.test(char)) {
            if (nonChineseBuffer) {
              fragment.appendChild(document.createTextNode(nonChineseBuffer));
              nonChineseBuffer = "";
            }
            const remainingText = text.substring(currentIndex);
            try {
              const match = lookupWord(remainingText);
              if (match && match.length > 0) {
                const wordText = match.word;
                const entry = match.entry;
                let jpString = "";
                if (displayMode === "jyutping") {
                  jpString = entry.jyutping ? Array.isArray(entry.jyutping) ? entry.jyutping[0] : entry.jyutping : "";
                } else {
                  const baseJp = entry.jyutping ? Array.isArray(entry.jyutping) ? entry.jyutping[0] : entry.jyutping : "";
                  jpString = jyutpingToYale(baseJp);
                }
                if (jpString) {
                  if (toneDisplayStyle === "superscript") {
                    jpString = convertToSuperscriptTone(jpString);
                  } else if (toneDisplayStyle === "hidden") {
                    jpString = jpString.replace(/\d/g, "");
                  }
                  jpString = jpString.replace(/ /g, " ");
                  const ruby = document.createElement("ruby");
                  ruby.className = "jyutping-ruby-injected";
                  if (isElementOnDarkBackground(node.parentElement || node)) ruby.classList.add("dark-bg");
                  ruby.dataset.word = wordText;
                  const chars = wordText.split("");
                  const pinyins = jpString.split(" ");
                  if (chars.length === pinyins.length) {
                    for (let i = 0; i < chars.length; i++) {
                      ruby.appendChild(document.createTextNode(chars[i]));
                      const rt = document.createElement("rt");
                      rt.textContent = pinyins[i];
                      ruby.appendChild(rt);
                    }
                  } else {
                    ruby.appendChild(document.createTextNode(wordText));
                    const rt = document.createElement("rt");
                    rt.textContent = jpString;
                    ruby.appendChild(rt);
                  }
                  fragment.appendChild(ruby);
                  replacedWordsCount++;
                } else {
                  fragment.appendChild(document.createTextNode(wordText));
                }
                currentIndex += match.length;
              } else {
                nonChineseBuffer += char;
                currentIndex++;
              }
            } catch (err) {
              console.error("lookupWord error:", err);
              nonChineseBuffer += char;
              currentIndex++;
            }
          } else {
            nonChineseBuffer += char;
            currentIndex++;
          }
        }
        if (nonChineseBuffer) {
          fragment.appendChild(document.createTextNode(nonChineseBuffer));
        }
        if (node.parentNode) {
          const parent = node.parentNode;
          parent.replaceChild(fragment, node);
          if (parent.tagName && parent.tagName.toLowerCase() !== "body") {
            parent.classList.add("jyutping-ruby-parent");
            if (!parent.hasAttribute("data-jp-original-lh")) {
              parent.setAttribute("data-jp-original-lh", parent.style.lineHeight || "");
              parent.style.setProperty("line-height", "2.2", "important");
            }
          }
        }
      }
      function processBatch(startIndex) {
        const endIndex = Math.min(startIndex + BATCH_SIZE, nodesToProcess.length);
        for (let i = startIndex; i < endIndex; i++) {
          processNode(nodesToProcess[i]);
        }
        if (endIndex < nodesToProcess.length) {
          setTimeout(() => processBatch(endIndex), 0);
        } else {
          console.log(`[Content] Finished injecting ruby annotations. Replacements made:`, replacedWordsCount);
          setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
          }, 50);
          setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
          }, 500);
        }
      }
      if (nodesToProcess.length > 0) {
        processBatch(0);
      }
    }
    function showPopupQA(activePopup) {
      const styleId = "cantonese-qa-style";
      if (!shadowRoot.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
        .qa-loading-dots {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          padding: 2px 0;
          height: 10px;
          box-sizing: border-box;
        }
        .qa-loading-dots span {
          width: 6px;
          height: 6px;
          background-color: var(--popup-accent, var(--popup-text-label));
          border-radius: 50%;
          display: inline-block;
          animation: qa-dot-bounce 1.2s infinite ease-in-out both;
        }
        .qa-loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        .qa-loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes qa-dot-bounce {
          0%, 80%, 100% { 
            transform: translateY(0);
            opacity: 0.35;
          } 
          40% { 
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `;
        shadowRoot.appendChild(style);
      }
      try {
        window.getSelection().removeAllRanges();
      } catch (e) {
      }
      const existingQA = activePopup.querySelector(".popup-qa-container");
      if (existingQA) {
        const textarea2 = existingQA.querySelector(".qa-input-textarea");
        if (textarea2) textarea2.focus();
        return;
      }
      if (activePopup.id === "cantonese-popup-dict" && activePopup.classList.contains("compact-mode")) {
        beginExpandGrace();
        const savedStyle = popupDisplayStyle;
        popupDisplayStyle = "full";
        showPopup(lastPopupResult, lastPopupRect);
        popupDisplayStyle = savedStyle;
      }
      activePopup.style.setProperty("width", "320px", "important");
      activePopup.style.setProperty("min-width", "320px", "important");
      activePopup.style.setProperty("max-width", "320px", "important");
      const inner = activePopup.querySelector(".popup-inner");
      if (!inner) return;
      inner.style.setProperty("width", "100%", "important");
      inner.style.setProperty("max-width", "100%", "important");
      inner.style.setProperty("min-width", "100%", "important");
      inner.style.setProperty("box-sizing", "border-box", "important");
      const isTranslate = activePopup.id === "cantonese-translate-popup";
      const marginStyle = isTranslate ? "margin: 0 -12px -8px -12px;" : "margin: 0;";
      const upperMarginStyle = isTranslate ? "margin: -8px -12px 0 -12px;" : "margin: 0;";
      const paddingLeft = isTranslate ? "12px" : "16px";
      const qaUpperDisplay = document.createElement("div");
      qaUpperDisplay.className = "qa-upper-display";
      qaUpperDisplay.style.cssText = `max-height: 180px; overflow-y: auto; font-size: 13px; color: var(--popup-text); line-height: 1.4; white-space: pre-wrap; display: none; width: auto; box-sizing: border-box; ${upperMarginStyle}`;
      const qaContainer = document.createElement("div");
      qaContainer.className = "popup-qa-container";
      qaContainer.style.cssText = `border-top: 1px solid var(--popup-divider); padding: 0; display: flex; flex-direction: column; box-sizing: border-box; background: var(--popup-bg); ${marginStyle} width: auto;`;
      qaContainer.innerHTML = `
      <div class="qa-input-wrapper" style="display: flex; width: 100%; margin: 0;">
        <textarea class="qa-input-textarea" placeholder="${pt("aiInputPlaceholder") || "輸入追問... (Enter 發送)"}" rows="1" style="width: 100%; min-height: 38px; max-height: 100px; padding: 10px ${paddingLeft}; border: none; background: transparent; color: var(--popup-text); font-size: 13px; resize: none; outline: none; box-sizing: border-box; font-family: inherit; line-height: 1.4; margin: 0; display: block;"></textarea>
      </div>
      <div class="qa-loading-wrapper" style="display: none; width: 100%; margin: 0; padding: 14px ${paddingLeft}; box-sizing: border-box; min-height: 38px; align-items: center; justify-content: flex-start;">
        <div class="qa-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
      inner.appendChild(qaUpperDisplay);
      inner.appendChild(qaContainer);
      if (activePopup.id === "cantonese-translate-popup" && lastTranslateRect) {
        positionTranslatePopup(lastTranslateRect);
      }
      const textarea = qaContainer.querySelector(".qa-input-textarea");
      const inputWrapper = qaContainer.querySelector(".qa-input-wrapper");
      const loadingWrapper = qaContainer.querySelector(".qa-loading-wrapper");
      textarea.value = "";
      textarea.addEventListener("input", () => {
        if (textarea.value.startsWith(" ") || textarea.value.startsWith("\n")) {
          textarea.value = textarea.value.trimStart();
        }
        textarea.style.height = "auto";
        textarea.style.height = Math.min(100, textarea.scrollHeight) + "px";
        adjustPopupVerticalPosition(activePopup);
      });
      let lastShiftState = false;
      textarea.addEventListener("keydown", (e) => {
        lastShiftState = e.shiftKey;
        if (!e.isComposing && e.keyCode !== 229 && (e.code === "Enter" || e.code === "NumpadEnter") && !e.shiftKey) {
          e.preventDefault();
          setTimeout(() => sendMsg(), 10);
        }
      });
      textarea.addEventListener("input", (e) => {
        if (e.inputType === "insertLineBreak" && !lastShiftState) {
          textarea.value = textarea.value.replace(/\n$/, "");
          sendMsg();
        }
      });
      setTimeout(() => {
        textarea.focus();
      }, 50);
      adjustPopupVerticalPosition(activePopup);
      function sendMsg() {
        const text = textarea.value.trim();
        if (!text) return;
        textarea.value = "";
        textarea.style.height = "auto";
        inputWrapper.style.display = "none";
        loadingWrapper.style.display = "flex";
        adjustPopupVerticalPosition(activePopup);
        chrome.runtime.sendMessage({
          action: "aiChatQuery",
          word: activeQAContext.word,
          sentence: activeQAContext.sentence,
          originalTranslation: activeQAContext.originalTranslation,
          question: text,
          history: activeQAContext.history
        }, (response) => {
          loadingWrapper.style.display = "none";
          inputWrapper.style.display = "flex";
          Array.from(inner.children).forEach((child) => {
            if (child !== qaContainer && child !== qaUpperDisplay) {
              child.style.display = "none";
            }
          });
          qaUpperDisplay.style.display = "block";
          qaUpperDisplay.style.padding = `10px ${paddingLeft}`;
          if (chrome.runtime.lastError) {
            qaUpperDisplay.innerHTML = `<div style="color: var(--popup-text-muted); font-size: 13px; line-height: 1.4;">❌ 錯誤: ${chrome.runtime.lastError.message}</div>`;
            adjustPopupVerticalPosition(activePopup);
            setTimeout(() => {
              textarea.focus();
            }, 50);
            return;
          }
          if (response && response.success) {
            activeQAContext.history.push({ role: "user", content: text });
            activeQAContext.history.push({ role: "assistant", content: response.reply });
            qaUpperDisplay.innerHTML = `<div style="font-size: 13px; color: var(--popup-text); line-height: 1.4; white-space: pre-wrap;">${renderMarkdown(response.reply)}</div>`;
          } else {
            qaUpperDisplay.innerHTML = `<div style="color: var(--popup-text-muted); font-size: 13px; line-height: 1.4;">❌ 錯誤: ${response ? response.error : "未知錯誤"}</div>`;
          }
          qaUpperDisplay.scrollTop = 0;
          adjustPopupVerticalPosition(activePopup);
          setTimeout(() => {
            textarea.focus();
          }, 50);
        });
      }
    }
    function adjustPopupVerticalPosition(activePopup) {
      const rect = activePopup.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.bottom > viewportHeight - 10) {
        const overflow = rect.bottom - (viewportHeight - 10);
        const currentTop = parseFloat(activePopup.style.top) || rect.top;
        activePopup.style.top = Math.max(5, currentTop - overflow) + "px";
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
