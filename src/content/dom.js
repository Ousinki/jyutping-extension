// DOM traversal / hit-testing helpers used by hover detection.
// Pure: DOM reads only, no shared extension state.

export function isEditableElement(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();

  // 輸入框和文本域
  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }

  // contenteditable 元素
  if (element.isContentEditable) {
    return true;
  }

  // 檢查父元素是否可編輯（對於嵌套元素）
  let parent = element.parentElement;
  while (parent) {
    if (parent.isContentEditable) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

export function hasEditableFocus() {
  const activeEl = document.activeElement;
  if (!activeEl) return false;

  // 如果焦點在我們自己的彈窗輸入框內，不視為外部可編輯元素獲得焦點
  if (activeEl.closest && (activeEl.closest('#cantonese-popup-dict') || activeEl.closest('#cantonese-translate-popup'))) {
    return false;
  }

  return (
    activeEl.tagName === 'INPUT' ||
    activeEl.tagName === 'TEXTAREA' ||
    activeEl.isContentEditable ||
    activeEl.getAttribute('contenteditable') === 'true' ||
    (activeEl.closest && activeEl.closest('[contenteditable="true"]'))
  );
}

export function getDeepestElementAtPoint(x, y) {
  let element = document.elementFromPoint(x, y);
  if (!element) return null;

  // 遞歸穿透 Shadow DOM
  while (element && element.shadowRoot) {
    const shadowElement = element.shadowRoot.elementFromPoint(x, y);
    if (!shadowElement || shadowElement === element) break;
    element = shadowElement;
  }

  return element;
}

export function getCaretRangeFromPointInShadow(x, y) {
  // 首先嘗試標準方法
  let range = document.caretRangeFromPoint(x, y);
  if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
    return range;
  }

  // 如果標準方法失敗，嘗試穿透 Shadow DOM
  const element = getDeepestElementAtPoint(x, y);
  if (!element) return null;

  // 獲取元素所在的根（可能是 ShadowRoot 或 document）
  const root = element.getRootNode();

  // 如果是 ShadowRoot，使用它的 caretRangeFromPoint（如果支持）
  if (root && root !== document && typeof root.caretRangeFromPoint === 'function') {
    range = root.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      return range;
    }
  }

  // 回退方案：遍歷元素的文字節點
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

export function getTextNodesIn(element) {
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

export function getAccurateOffset(textNode, clientX, clientY) {
  const text = textNode.textContent;
  if (!text) return -1;

  const range = document.createRange();

  // 遍歷每個字符，檢查光標是否直接在其上面
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 只考慮中文字符
    if (!/[一-鿿]/.test(char)) continue;

    try {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const rect = range.getBoundingClientRect();

      // 跳過不可見的字符
      if (rect.width === 0 || rect.height === 0) continue;

      // 只有光標直接在字符範圍內才返回
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        return i;
      }
    } catch (e) {
      // 忽略 range 操作錯誤
    }
  }

  // 光標不在任何中文字符上，不顯示
  return -1;
}
