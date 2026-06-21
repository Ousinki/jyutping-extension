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
  function getElementBackgroundColor(element) {
    try {
      let el = element;
      while (el && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
          return bg;
        }
        el = el.parentElement;
      }
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent") {
        return bodyBg;
      }
    } catch (e) {
    }
    return "rgb(255, 255, 255)";
  }
  function checkIsDarkColor(bgColorStr) {
    if (!bgColorStr) return false;
    const match = bgColorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
    return false;
  }
  function isElementOnDarkBackground(element) {
    return checkIsDarkColor(getElementBackgroundColor(element));
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

  // src/content/index.js
  (function() {
    "use strict";
    const contentScriptId = Math.random().toString(36).slice(2);
    document.documentElement.setAttribute("data-jyutping-tts-owner", contentScriptId);
    let dictionary = {};
    let popup = null;
    let popupArrow = null;
    let isEnabled = true;
    let displayMode = "jyutping";
    let uiTheme = "auto";
    let toneStyle = "superscript";
    let popupDisplayStyle = "full";
    let popupTheme = "classic";
    let ttsEnabled = true;
    let ttsEngine = "edgeTts";
    let edgeTtsMode = "default";
    let edgeTtsUrl = "";
    const EDGE_TTS_DEFAULT_URL = "http://114.55.243.162:8090";
    let azureTtsMode = "default";
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
    let currentContextSentence = "";
    let hoverModifier = "none";
    let isMouseOverPopup = false;
    let hideTimeout = null;
    let justNavigated = false;
    let compactExpandBtn = true;
    let expandLockTimer = null;
    let waitingForMouseToEnterAfterExpand = false;
    let rubyFadeMask = null;
    let lastPopupResult = null;
    let lastPopupRect = null;
    let lastTranslateRect = null;
    let currentMouseX = 0;
    let currentMouseY = 0;
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
        cantConnect: "無法連接字典伺服器"
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
        cantConnect: "Cannot connect to server"
      }
    };
    let currentLang = "zh-HK";
    chrome.storage.local.get(["extensionLang"], (res) => {
      if (res.extensionLang) currentLang = res.extensionLang;
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.extensionLang) currentLang = changes.extensionLang.newValue;
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
          "--popup-text": "#333333",
          "--popup-text-muted": "#555555",
          "--popup-text-label": "#777777",
          "--popup-accent": "#2196f3",
          "--popup-accent-hover": "#1976d2",
          "--popup-word-color": "#1a1a1a",
          "--popup-def-color": "#444444",
          "--popup-def-yue": "#b8860b",
          "--popup-divider": "rgba(0, 0, 0, 0.06)",
          "--popup-divider-strong": "rgba(0, 0, 0, 0.08)",
          "--popup-example-bg": "rgba(255, 255, 255, 0.5)",
          "--popup-btn-bg": "rgba(0, 0, 0, 0.06)",
          "--popup-btn-hover": "rgba(0, 0, 0, 0.1)",
          "--popup-btn-speaking": "#2196f3",
          "--popup-btn-speaking-text": "#ffffff",
          "--popup-shadow": "0 8px 32px rgba(0, 0, 0, 0.12)",
          "--popup-active-bg": "rgba(33, 150, 243, 0.08)"
        }
      }
    };
    function isDarkMode() {
      return uiTheme === "dark" || uiTheme === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function applyPopupTheme(themeName) {
      if (!popup) return;
      const theme = POPUP_THEMES[themeName] || POPUP_THEMES.classic;
      for (const [prop, value] of Object.entries(theme.vars)) {
        popup.style.setProperty(prop, value);
        if (translatePopup) translatePopup.style.setProperty(prop, value);
      }
      popup.classList.remove("popup-theme-glass");
      if (translatePopup) translatePopup.classList.remove("popup-theme-glass");
      if (themeName === "glass") {
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
        position: fixed; top: 20px; right: 20px; z-index: 2147483647;
        display: flex; flex-direction: column; gap: 10px; pointer-events: none;
      }
      .jyutping-toast {
        background: #ffffff; color: #333333; border: 1px solid #d0d0d0;
        border-left: 4px solid #f44336; border-radius: 8px; padding: 12px 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 14px;
        line-height: 1.4; max-width: 300px; word-wrap: break-word; pointer-events: auto;
        opacity: 0; transform: translateX(100%);
        transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .jyutping-toast.show { opacity: 1; transform: translateX(0); }
      .jyutping-toast-success { border-left-color: #4CAF50 !important; }
      .jyutping-toast-error { border-left-color: #f44336 !important; }

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
    `;
      document.head.appendChild(hostStyle);
      document.body.appendChild(host);
    }
    async function init() {
      await createShadowHost();
      createPopup();
      createTranslatePopup();
      await loadDictionary();
      loadSettings();
      setupEventListeners();
      if (isFullPageRubyActive && isEnabled) {
        console.log("[Content] Auto-restoring Jyutping Full Page Ruby from sessionStorage");
        injectRubyAnnotations(document.body);
      }
    }
    let hasUserSelection = false;
    function createTranslatePopup() {
      translatePopup = document.createElement("div");
      translatePopup.id = "cantonese-translate-popup";
      translatePopup.style.display = "none";
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
      if (!range) return null;
      const rects = Array.from(range.getClientRects());
      if (rects.length === 0) return null;
      if (rects.length === 1) return rects[0];
      if (currentMouseX === 0 && currentMouseY === 0) {
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
      const fullRect = range.getBoundingClientRect();
      return {
        left: minX,
        right: maxX,
        top: fullRect.top,
        bottom: fullRect.bottom,
        width: maxX - minX,
        height: fullRect.bottom - fullRect.top
      };
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
      const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length;
      if (chineseRatio < 0.3) return;
      showTranslatePopup(text, null, true);
      chrome.runtime.sendMessage({
        action: "translate",
        text,
        transLangs
      });
    }
    function showTranslatePopup(originalText, translations, loading) {
      cancelScheduledHide();
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
                if (key === "zh-Hans") label = pt("mandarin");
                else if (key === "en") label = pt("english");
                else if (key === "ja") label = pt("japanese");
                else if (key === "ko") label = pt("korean");
                rows += `<div class="translate-row"><span class="translate-label translate-label-${key}">${label}</span><span class="translate-text">${translations[key] || ""}</span></div>`;
              }
            }
            translateDiv.innerHTML = rows;
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
            if (key === "zh-Hans") label = pt("mandarin");
            else if (key === "en") label = pt("english");
            else if (key === "ja") label = pt("japanese");
            else if (key === "ko") label = pt("korean");
            rows += `<div class="translate-row"><span class="translate-label translate-label-${key}">${label}</span><span class="translate-text">${translations[key] || ""}</span></div>`;
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
    function createPopup() {
      let existingPopup = document.getElementById("cantonese-popup-dict");
      if (existingPopup) {
        existingPopup.remove();
      }
      popup = document.createElement("div");
      popup.id = "cantonese-popup-dict";
      popup.style.display = "none";
      popupArrow = document.createElement("div");
      popupArrow.className = "popup-arrow";
      popup.innerHTML = `
      <div class="popup-inner" style="border-radius: inherit; overflow: hidden; width: 100%; height: 100%; display: flex; flex-direction: column; position: relative;">
        <!-- 右上角操作按鈕區（包含報告和設定） -->
        <div class="popup-actions-wrapper" style="position: absolute; top: 10px; right: 10px; display: flex; align-items: center; z-index: 10;">
          <!-- 報告錯誤按鈕 (預設隱藏，hover wrapper 時滑出) -->
          <div class="popup-report-btn" title="報告錯誤" style="cursor: pointer; opacity: 0; width: 0; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; height: 24px; border-radius: 4px; background-color: var(--popup-divider); margin-right: 0; color: var(--popup-text); font-size: 12px; white-space: nowrap; padding: 0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <span style="transform: translateY(-0.5px)">報告</span>
          </div>
          <!-- 設定按鈕 -->
          <div class="popup-settings-btn" title="設定" style="cursor: pointer; opacity: 0.4; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--popup-text, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <span>報告錯誤</span>
            <span class="report-cancel-icon" style="cursor: pointer; opacity: 0.6;">✕</span>
          </div>
          <div style="font-size: 13px; color: var(--popup-text-muted); background: var(--popup-bg); padding: 6px; border-radius: 4px; border: 1px solid var(--popup-divider);">
            <div><strong>詞語：</strong><span class="report-word-preview"></span></div>
            <div style="margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>句子：</strong><span class="report-sentence-preview"></span></div>
          </div>
          <textarea class="report-textarea" placeholder="請描述具体的错误（例如读音不正确、释义有误等）..." style="width: 100%; height: 60px; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; background: var(--popup-bg); color: var(--popup-text); font-size: 13px; resize: none; outline: none !important; box-shadow: none !important; -webkit-appearance: none; box-sizing: border-box;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button class="report-cancel-btn" style="padding: 4px 10px; border: 1px solid var(--popup-border); background: transparent; color: var(--popup-text); border-radius: 4px; cursor: pointer; font-size: 12px;">取消</button>
            <button class="report-send-btn" style="padding: 4px 10px; border: none; background: var(--popup-accent); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">呼叫郵件發送</button>
          </div>
        </div>
      </div>
    `;
      popup.appendChild(popupArrow);
      shadowRoot.appendChild(popup);
      const actionsWrapper = popup.querySelector(".popup-actions-wrapper");
      const settingsBtn = popup.querySelector(".popup-settings-btn");
      const reportBtn = popup.querySelector(".popup-report-btn");
      const popupContainer = popup.querySelector(".popup-container");
      const popupTranslate = popup.querySelector(".popup-translate");
      const reportForm = popup.querySelector(".popup-report-form");
      actionsWrapper.addEventListener("mouseenter", () => {
        if (reportForm.style.display === "flex") return;
        settingsBtn.style.opacity = "1";
        settingsBtn.style.backgroundColor = "var(--popup-divider)";
        reportBtn.style.opacity = "1";
        reportBtn.style.width = "60px";
        reportBtn.style.padding = "0 8px";
        reportBtn.style.marginRight = "4px";
      });
      actionsWrapper.addEventListener("mouseleave", () => {
        settingsBtn.style.opacity = "0.4";
        settingsBtn.style.backgroundColor = "transparent";
        reportBtn.style.opacity = "0";
        reportBtn.style.width = "0";
        reportBtn.style.padding = "0";
        reportBtn.style.marginRight = "0";
        reportBtn.style.backgroundColor = "var(--popup-divider)";
      });
      reportBtn.addEventListener("mouseenter", () => {
        reportBtn.style.backgroundColor = "var(--popup-divider-strong)";
      });
      reportBtn.addEventListener("mouseleave", () => {
        reportBtn.style.backgroundColor = "var(--popup-divider)";
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
        waitingForMouseToEnterAfterExpand = false;
        cancelScheduledHide();
      });
      popup.addEventListener("mouseleave", () => {
        isMouseOverPopup = false;
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
    let rubyTextFont = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    let rubyTextStyle = "default";
    let rubyDictionaryColor = "#999999";
    function loadSettings() {
      chrome.storage.sync.get([
        "enabled",
        "displayMode",
        "toneStyle",
        "rubyRtBackground",
        "hoverModifier",
        "popupDisplayStyle",
        "popupTheme",
        "customZhFont",
        "customEnFont",
        "highlightStyle",
        "rubyHoverStyle",
        "compactExpandBtn",
        "ttsEnabled",
        "ttsEngine",
        "edgeTtsMode",
        "edgeTtsUrl",
        "azureTtsMode",
        "azureTtsKey",
        "azureTtsRegion",
        "azureTtsVoice",
        "ttsRate",
        "toneDisplayStyle",
        "rubyTextOpacity",
        "rubyTextFont",
        "rubyTextStyle",
        "rubyDictionaryColor",
        "transLang",
        "transLangs",
        "transTrigger",
        "uiTheme"
      ], (result) => {
        if (result.enabled !== void 0) isEnabled = result.enabled !== false;
        displayMode = result.displayMode || "jyutping";
        toneStyle = result.toneStyle || "superscript";
        if (result.rubyRtBackground === true) rubyRtBackground = "solid";
        else if (result.rubyRtBackground === false || !result.rubyRtBackground) rubyRtBackground = "none";
        else rubyRtBackground = result.rubyRtBackground;
        hoverModifier = result.hoverModifier || "none";
        popupDisplayStyle = result.popupDisplayStyle || "full";
        uiTheme = result.uiTheme || "auto";
        popupTheme = result.popupTheme || "classic";
        customZhFont = result.customZhFont || "";
        customEnFont = result.customEnFont || "";
        highlightStyle = result.highlightStyle || "yellow";
        rubyHoverStyle = result.rubyHoverStyle || "ruby-red";
        compactExpandBtn = result.compactExpandBtn !== false;
        applyPopupTheme(popupTheme);
        ttsEnabled = result.ttsEnabled !== false;
        ttsEngine = result.ttsEngine || "edgeTts";
        edgeTtsMode = result.edgeTtsMode || "default";
        edgeTtsUrl = result.edgeTtsUrl || "";
        azureTtsMode = result.azureTtsMode || "default";
        azureTtsKey = result.azureTtsKey || "";
        azureTtsRegion = result.azureTtsRegion || "";
        azureTtsVoice = result.azureTtsVoice || "zh-HK-HiuMaanNeural";
        ttsRate = result.ttsRate || 0.9;
        toneDisplayStyle = result.toneDisplayStyle || "normal";
        rubyTextOpacity = result.rubyTextOpacity || "0.85";
        rubyTextFont = result.rubyTextFont || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        rubyTextStyle = result.rubyTextStyle || "default";
        rubyDictionaryColor = result.rubyDictionaryColor || "#999999";
        let tls = result.transLangs;
        if (!tls && result.transLang) {
          if (result.transLang === "both") tls = ["zh-Hans", "en"];
          else if (result.transLang === "mandarin") tls = ["zh-Hans"];
          else if (result.transLang === "english") tls = ["en"];
        }
        if (!tls) tls = ["zh-Hans", "en"];
        transLangs = tls;
        transTrigger = result.transTrigger || "dblclick";
        document.documentElement.style.setProperty("--jyutping-rt-opacity", rubyTextStyle === "dictionary" ? "1" : rubyTextOpacity, "important");
        if (rubyTextStyle === "dictionary") {
          document.documentElement.style.setProperty("--jyutping-rt-font", '"Chiron Hei HK WS", "Microsoft YaHei", sans-serif', "important");
          document.documentElement.style.setProperty("--jyutping-rt-font-style", "italic", "important");
          document.documentElement.style.setProperty("--jyutping-rt-color", rubyDictionaryColor, "important");
          document.documentElement.style.setProperty("--jyutping-rt-font-weight", "normal", "important");
          document.documentElement.style.setProperty("-webkit-font-smoothing", "antialiased", "important");
        } else {
          if (rubyTextFont) {
            document.documentElement.style.setProperty("--jyutping-rt-font", rubyTextFont, "important");
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
        if (changes.uiTheme) {
          uiTheme = changes.uiTheme.newValue;
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
        if (changes.rubyTextFont) {
          rubyTextFont = changes.rubyTextFont.newValue;
          if (rubyTextFont) {
            document.documentElement.style.setProperty("--jyutping-rt-font", rubyTextFont, "important");
          } else {
            document.documentElement.style.removeProperty("--jyutping-rt-font");
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
            if (rubyTextFont) {
              document.documentElement.style.setProperty("--jyutping-rt-font", rubyTextFont, "important");
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
        }
      } else if (area === "local") {
        if (changes.aiEnabled) {
          aiEnabled = changes.aiEnabled.newValue === true;
          console.log("[AI] Dynamic update from storage.onChanged (local), aiEnabled:", aiEnabled);
        }
      }
    });
    let lastSpeakTime = 0;
    let ttsPlaybackTimer = null;
    let activeSpeakerBtn = null;
    let activeSpeakingRuby = null;
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
      if (ttsPlaybackTimer) clearTimeout(ttsPlaybackTimer);
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
    function stopSpeakerAnimation() {
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
    }
    async function speakCantonese(text, targetBtn = null) {
      if (!ttsEnabled) return;
      try {
        const dummyAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        dummyAudio.volume = 0;
        dummyAudio.play().catch((e) => console.log("Dummy audio unlock failed:", e));
      } catch (e) {
        console.error("Audio unlock error:", e);
      }
      let textToSpeak = text;
      if (dictionary && dictionary[text] && dictionary[text].traditional) {
        textToSpeak = dictionary[text].traditional;
      }
      const now = Date.now();
      console.trace(`speakCantonese called for "${textToSpeak}". Time diff: ${now - lastSpeakTime}ms`);
      if (now - lastSpeakTime < 300) {
        console.log("speakCantonese blocked by debounce");
        return;
      }
      lastSpeakTime = now;
      console.log("speakCantonese proceeding, engine:", ttsEngine);
      startSpeakerAnimation(targetBtn);
      const estimatedDurationMs = (textToSpeak.length * 500 + 1e3) / ttsRate;
      const timeoutMs = Math.max(2e3, Math.min(estimatedDurationMs, 1e4));
      ttsPlaybackTimer = setTimeout(stopSpeakerAnimation, timeoutMs);
      const cacheKey = `${ttsEngine}:${ttsRate}:${textToSpeak}`;
      if (["edgeTts", "azureTts", "bertVits2"].includes(ttsEngine)) {
        const cachedAudio = ttsCache.get(cacheKey);
        if (cachedAudio) {
          console.log("TTS cache hit:", textToSpeak);
          const audio = new Audio(cachedAudio);
          audio.ontimeupdate = () => {
            if (audio.duration && audio.currentTime >= audio.duration - 0.05) stopSpeakerAnimation();
          };
          audio.onended = stopSpeakerAnimation;
          audio.onerror = stopSpeakerAnimation;
          audio.play();
          return;
        }
      }
      pendingTtsText = cacheKey;
      try {
        if (ttsEngine === "webSpeech") {
          speakWithWebSpeech(textToSpeak);
        } else if (ttsEngine === "chromeTts") {
          speakWithChromeTts(textToSpeak);
        } else if (ttsEngine === "edgeTts") {
          const baseUrl = edgeTtsMode === "custom" ? edgeTtsUrl : EDGE_TTS_DEFAULT_URL;
          await speakWithEdgeTts(textToSpeak, baseUrl);
        } else if (ttsEngine === "bertVits2") {
          await speakWithBertVits2(textToSpeak);
        } else if (ttsEngine === "azureTts") {
          if (azureTtsMode === "custom") {
            chrome.runtime.sendMessage({
              action: "azureTtsSpeak",
              text: textToSpeak,
              azureKey: azureTtsKey,
              azureRegion: azureTtsRegion,
              azureVoice: azureTtsVoice,
              rate: ttsRate
            });
          } else {
            chrome.runtime.sendMessage({
              action: "azureTtsProxySpeak",
              text: textToSpeak,
              azureVoice: azureTtsVoice,
              rate: ttsRate
            });
          }
        }
      } catch (error) {
        console.error("TTS error:", error);
        stopSpeakerAnimation();
        if (!window.hasShownTtsFallbackToast) {
          showToast("🔊 語音服務連線異常，已自動降級為系統本機發音。<br>請檢查網絡或刷新網頁。", 4e3);
          window.hasShownTtsFallbackToast = true;
        }
        speakWithWebSpeech(textToSpeak);
      }
    }
    function speakWithWebSpeech(text) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-HK";
      utterance.rate = ttsRate;
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
    async function speakWithEdgeTts(text, baseUrl) {
      baseUrl = baseUrl || EDGE_TTS_DEFAULT_URL;
      chrome.runtime.sendMessage({
        action: "edgeTtsSpeak",
        text,
        baseUrl,
        rate: ttsRate
      });
    }
    async function speakWithBertVits2(text) {
      chrome.runtime.sendMessage({
        action: "bertVits2Speak",
        text,
        rate: ttsRate
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
              hidePopup(true);
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
        if (isEditableElement(targetElement)) {
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
        if (hasEditableFocus()) {
          if (popup) popup.style.display = "none";
          return;
        }
        if (popup && popup.querySelector(".popup-qa-container")) return;
        if (translatePopup && translatePopup.querySelector(".popup-qa-container")) return;
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
          if (selection.rangeCount > 0 && selection.toString().trim()) {
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
              const textToSpeak = selection.toString().trim();
              const rangeRect = getBestRectForRange(range);
              const btn = showSelectionSpeakerPopup(rangeRect, textToSpeak);
              speakCantonese(textToSpeak, btn);
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
                  requestTranslation(textToSpeak);
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
        waitingForMouseToEnterAfterExpand = false;
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
          let word = ruby.dataset.word;
          if (word) {
            speakCantonese(word);
            startRubySpeakingState(ruby);
            ruby.classList.add("jyutping-clicked-hover");
          }
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
            const rect = ruby.getBoundingClientRect();
            currentWord = word;
            try {
              currentRange = document.createRange();
              currentRange.selectNodeContents(ruby);
            } catch (err) {
            }
            showPopup({ word, entry: dictionary[word] }, rect, true);
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
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          hidePopup();
          hideTranslatePopup();
          hasUserSelection = false;
        }
        const keyMap = { "alt": "Alt", "ctrl": "Control", "shift": "Shift", "meta": "Meta" };
        if (e.key === keyMap[hoverModifier] && currentMouseX !== 0 && currentMouseY !== 0) {
          lastX = currentMouseX;
          lastY = currentMouseY;
          handleMouseOver({
            clientX: currentMouseX,
            clientY: currentMouseY,
            altKey: e.altKey || e.key === "Alt",
            ctrlKey: e.ctrlKey || e.key === "Control",
            shiftKey: e.shiftKey || e.key === "Shift",
            metaKey: e.metaKey || e.key === "Meta"
          });
          if (popupDisplayStyle === "full" && ttsEnabled && currentWord && dictionary[currentWord]) {
            speakCantonese(dictionary[currentWord].traditional || currentWord);
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
      if (popup && popup.querySelector(".popup-qa-container")) return;
      if (translatePopup && translatePopup.querySelector(".popup-qa-container")) return;
      if (translatePopup && translatePopup.style.display !== "none") {
        if (!isMouseOverPopup) {
          scheduleHidePopup();
        }
        return;
      }
      if (isMouseOverPopup) return;
      if (expandLockTimer) return;
      if (waitingForMouseToEnterAfterExpand) return;
      const modifierPressed = popupDisplayStyle === "compact" || hoverModifier === "none" || hoverModifier === "alt" && e.altKey || hoverModifier === "ctrl" && e.ctrlKey || hoverModifier === "shift" && e.shiftKey || hoverModifier === "meta" && e.metaKey;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const targetElement = document.elementFromPoint(clientX, clientY);
      if (targetElement && (targetElement.closest("#cantonese-popup-dict") || targetElement.closest("#cantonese-translate-popup"))) {
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
            showPopup(result2, rubyElement.getBoundingClientRect());
          } else {
            scheduleHideIfMouseOutside();
          }
        } else {
          maybeScheduleHide();
        }
        return;
      }
      if (targetElement && (targetElement.classList.contains("jyutping-highlight") || targetElement.closest(".jyutping-hover-ruby"))) {
        cancelScheduledHide();
        if (modifierPressed && popup && popup.style.display === "none" && currentWord && dictionary[currentWord]) {
          const result2 = { word: currentWord, entry: dictionary[currentWord] };
          showPopup(result2, currentRange ? currentRange.getBoundingClientRect() : {
            left: clientX,
            right: clientX,
            top: clientY,
            bottom: clientY,
            width: 0,
            height: 0
          });
        }
        return;
      }
      let range = getCaretRangeFromPointInShadow(clientX, clientY);
      if (!range) {
        maybeScheduleHide();
        return;
      }
      const previousWord = currentWord;
      if (highlightSpans.length > 0) {
        removeHighlight();
        range = getCaretRangeFromPointInShadow(clientX, clientY);
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
          if (modifierPressed) {
            showPopup(result, bestRect || currentRange.getBoundingClientRect());
          } else {
            scheduleHideIfMouseOutside();
          }
        } else {
          if (modifierPressed) {
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
    function speakText(text) {
      if (!ttsEnabled) return;
      if (ttsEngine === "chromeTts") {
        chrome.runtime.sendMessage({
          action: "chromeTtsSpeak",
          text,
          options: { lang: "zh-HK", rate: ttsRate }
        });
      } else if (ttsEngine === "edgeTts") {
        const baseUrl = edgeTtsMode === "custom" ? edgeTtsUrl : EDGE_TTS_DEFAULT_URL;
        chrome.runtime.sendMessage({
          action: "edgeTtsSpeak",
          text,
          baseUrl,
          rate: ttsRate
        });
      } else if (ttsEngine === "bertVits2") {
        chrome.runtime.sendMessage({
          action: "bertVits2Speak",
          text,
          rate: ttsRate
        });
      } else if (ttsEngine === "azureTts") {
        if (azureTtsMode === "custom") {
          chrome.runtime.sendMessage({
            action: "azureTtsSpeak",
            text,
            azureKey: azureTtsKey,
            azureRegion: azureTtsRegion,
            azureVoice: azureTtsVoice,
            rate: ttsRate
          });
        } else {
          chrome.runtime.sendMessage({
            action: "azureTtsProxySpeak",
            text,
            azureVoice: azureTtsVoice,
            rate: ttsRate
          });
        }
      } else {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "zh-HK";
        utterance.rate = ttsRate;
        speechSynthesis.speak(utterance);
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
          waitingForMouseToEnterAfterExpand = true;
          if (expandLockTimer) clearTimeout(expandLockTimer);
          expandLockTimer = setTimeout(() => {
            expandLockTimer = null;
          }, 400);
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
          speakCantonese(entry.traditional);
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
          isDark = checkIsDarkColor(detectedColor);
        }
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
          speakCantonese(entry.traditional);
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
    function showPopup(result, rect, forceFull = false) {
      cancelScheduledHide();
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
      hideTranslatePopup();
      lastPopupResult = result;
      if (rect) lastPopupRect = rect;
      activeQAContext.word = result.word || (result.entry ? result.entry.traditional : "");
      activeQAContext.sentence = getSurroundingSentence(currentRange) || "";
      activeQAContext.originalTranslation = result.entry && result.entry.english ? result.entry.english.join("; ") : "";
      activeQAContext.history = [];
      let pronunciation = displayMode === "yale" ? entry.yale || entry.jyutping : entry.jyutping;
      if (pronunciation && toneStyle === "superscript" && popupDisplayStyle === "compact" && !forceFull) {
        pronunciation = pronunciation.replace(/(\d+)/g, '<sup class="jyutping-tone">$1</sup>');
      }
      if (pronunciation && toneStyle === "superscript" && popupDisplayStyle === "ruby" && !forceFull) {
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
      let html = `
      <div class="word-section">
        <span class="word-text">${entry.traditional}</span>
        ${entry.simplified !== entry.traditional ? `<span class="word-simplified">${entry.simplified}</span>` : ""}
      </div>
    `;
      if (pronunciation) {
        html += `
        <div class="pronunciation-section">
          <span class="pronunciation-label">${displayMode === "yale" ? "Yale" : "粵拼"}:</span>
          <span class="pronunciation-text">${pronunciation}</span>
          <button class="tts-speaker-btn" title="播放發音" aria-label="播放發音">
            <svg class="tts-speaker-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path class="tts-wave tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path class="tts-wave tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>
        </div>
      `;
      }
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
      if (entry.english && entry.english.length > 0) {
        const defItems = entry.english.slice(0, 5).map((def, index) => {
          let className = "def-item";
          let hasExamples = false;
          if (entry.examples && entry.examples[index] && entry.examples[index].length > 0) {
            className += " has-examples";
            hasExamples = true;
          }
          if (def.startsWith("[粵]")) {
            className += " def-yue";
          }
          return `<div class="${className}" ${hasExamples ? `data-example-index="${index}"` : ""}>${def}</div>`;
        }).join("");
        html += `
        <div class="definition-section">
          ${defItems}
        </div>
      `;
      }
      const refLines = [];
      if (entry.sims && entry.sims.length > 0) {
        const simLinks = entry.sims.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">近義：</span>${simLinks}</div>`);
      }
      if (entry.ants && entry.ants.length > 0) {
        const antLinks = entry.ants.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">反義：</span>${antLinks}</div>`);
      }
      if (entry.see_also && entry.see_also.length > 0) {
        const seeLinks = entry.see_also.map(
          (w) => `<span class="see-also-link" data-word="${w}">${w}</span>`
        ).join("、");
        refLines.push(`<div class="ref-line"><span class="see-also-label">異體：</span>${seeLinks}</div>`);
      }
      if (refLines.length > 0) {
        html += `<div class="see-also-section">${refLines.join("")}</div>`;
      }
      popupMain.innerHTML = html;
      const wordSection = popupMain.querySelector(".word-section");
      if (wordSection) {
        wordSection.style.cursor = "pointer";
        wordSection.addEventListener("click", (e) => {
          e.stopPropagation();
          speakCantonese(entry.traditional);
        });
      }
      const pronunciationText = popupMain.querySelector(".pronunciation-text");
      const speakerBtn = popupMain.querySelector(".tts-speaker-btn");
      function triggerTTS(e) {
        e.stopPropagation();
        speakCantonese(entry.traditional, speakerBtn);
      }
      if (pronunciationText) {
        pronunciationText.style.cursor = "pointer";
        pronunciationText.addEventListener("click", triggerTTS);
      }
      if (speakerBtn) {
        speakerBtn.addEventListener("click", triggerTTS);
      }
      if (entry.examples) {
        popupMain.querySelectorAll(".has-examples").forEach((el) => {
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
            popupMain.querySelectorAll(".def-item").forEach((d) => d.classList.remove("active"));
            el.classList.add("active");
            const index = parseInt(el.dataset.exampleIndex);
            const examples = entry.examples[index];
            if (examples && examples.length > 0) {
              renderExamples(examples);
              popupExamples.style.display = "block";
              popup.classList.add("expanded-mode");
              popup.style.width = "640px";
              adjustPopupPosition();
            }
          });
        });
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
        const x = rect.left;
        const y = rect.bottom;
        const ARROW_HEIGHT = 8;
        const GAP = 2;
        const highlightCenterX = rect.left + rect.width / 2;
        left = highlightCenterX - popupWidth / 2;
        if (left + popupWidth > viewportWidth - 5) {
          left = viewportWidth - popupWidth - 5;
        }
        if (left < 5) {
          left = 5;
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
      let html = '<div class="example-title">例句</div>';
      examples.forEach((eg, i) => {
        const engPart = eg.eng ? `<div class="example-eng">${eg.eng}</div>` : "";
        html += `
        <div class="example-item">
          <div class="example-yue">
            <span class="example-yue-text">${eg.yue}</span>
            <button class="tts-speaker-btn example-tts-btn" data-index="${i}" title="播放例句" aria-label="播放例句">
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
      if (expandLockTimer) return;
      if (waitingForMouseToEnterAfterExpand) return;
      if (popup && popup.querySelector(".popup-qa-container")) return;
      if (translatePopup && translatePopup.querySelector(".popup-qa-container")) return;
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
      if (activePopupRubyElement) {
        activePopupRubyElement.classList.remove("jyutping-popup-active");
        activePopupRubyElement = null;
      }
      if (popup) {
        popup.style.display = "none";
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
          const entry = result.entry;
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
      } else if (request.action === "changeCustomFont") {
        if (request.customZhFont !== void 0) customZhFont = request.customZhFont;
        if (request.customEnFont !== void 0) customEnFont = request.customEnFont;
        applyPopupTheme(popupTheme);
      } else if (request.action === "changeTtsEnabled") {
        ttsEnabled = request.ttsEnabled;
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
      } else if (request.action === "changeAzureTtsMode") {
        azureTtsMode = request.azureTtsMode;
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
      } else if (request.action === "playAudio") {
        const myId = document.documentElement.getAttribute("data-jyutping-tts-owner");
        if (myId !== contentScriptId) return;
        const audioSrc = request.audioData.startsWith("data:") ? createBlobUrlFromDataUri(request.audioData) : request.audioData;
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
        const audio = new Audio(audioSrc);
        audio.ontimeupdate = () => {
          if (audio.duration && audio.currentTime >= audio.duration - 0.05) stopSpeakerAnimation();
        };
        audio.onended = stopSpeakerAnimation;
        audio.onerror = stopSpeakerAnimation;
        audio.play().catch((err) => {
          console.warn("[Content] TTS Playback failed (NotAllowedError or missing interaction):", err);
          stopSpeakerAnimation();
        });
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
      } else if (request.action === "ttsEnded") {
        stopSpeakerAnimation();
      }
    });
    let isFullPageRubyActive = sessionStorage.getItem("jyutping_full_page_ruby") === "true";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (isFullPageRubyActive) {
          toggleRubyAnnotations();
        }
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
        showToast(tt("toastRubyEnabled"), 2e3, "success");
      } else {
        console.log("Jyutping Full Page Ruby: OFF");
        removeRubyAnnotations(document.body);
        showToast(tt("toastRubyDisabled"), 2e3, "error");
      }
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
      toast.innerHTML = message;
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
                  jpString = entry.yale ? Array.isArray(entry.yale) ? entry.yale[0] : entry.yale : "";
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
        waitingForMouseToEnterAfterExpand = true;
        if (expandLockTimer) clearTimeout(expandLockTimer);
        expandLockTimer = setTimeout(() => {
          expandLockTimer = null;
        }, 400);
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
        <textarea class="qa-input-textarea" placeholder="輸入追問... (Enter 發送)" rows="1" style="width: 100%; min-height: 38px; max-height: 100px; padding: 10px ${paddingLeft}; border: none; background: transparent; color: var(--popup-text); font-size: 13px; resize: none; outline: none; box-sizing: border-box; font-family: inherit; line-height: 1.4; margin: 0; display: block;"></textarea>
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
