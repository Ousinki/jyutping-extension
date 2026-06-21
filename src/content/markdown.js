// Markdown -> HTML renderer used by the AI/QA popups.
// Pure: no DOM access, no shared extension state. Output is inline-styled
// HTML so it renders correctly inside the shadow-DOM popup.

export function renderMarkdown(md) {
  if (!md) return '';

  // 轉義 HTML 標記防止 XSS
  let escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split(/\r?\n/);
  let htmlResult = '';
  const listStack = [];
  let inTable = false;
  let isTableHeader = false;

  function parseInlineMarkdown(text) {
    if (!text) return '';
    let html = text;
    // 粗體: **bold** 或 __bold__
    html = html.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
    // 斜體: *italic* 或 _italic_
    html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
    // 行內代碼: `code`
    html = html.replace(/`(.*?)`/g, '<code style="font-family: monospace; background: var(--popup-divider, rgba(0,0,0,0.06)); padding: 2px 4px; border-radius: 4px; font-size: 0.9em; word-break: break-all;">$1</code>');
    // 超連結: [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: var(--popup-accent, var(--popup-text-label)); text-decoration: underline; cursor: pointer;">$1</a>');
    return html;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 表格解析
    const isTableLine = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;

    if (!isTableLine && inTable) {
      inTable = false;
      htmlResult += '</tbody></table></div>';
    }

    if (isTableLine) {
      if (!inTable) {
        while (listStack.length > 0) {
          const top = listStack.pop();
          htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
        }
        inTable = true;
        isTableHeader = true;
        htmlResult += '<div style="overflow-x: auto; margin: 8px 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.95em; color: var(--popup-text);"><tbody>';
      }

      // 跳過分隔線 |---|---|
      if (trimmed.replace(/\|/g, '').replace(/-/g, '').replace(/:/g, '').trim() === '') {
        isTableHeader = false;
        continue;
      }

      const cells = trimmed.split('|').slice(1, -1).map(cell => parseInlineMarkdown(cell.trim()));
      htmlResult += '<tr>';
      cells.forEach(cell => {
        if (isTableHeader) {
          htmlResult += `<th style="border: 1px solid var(--popup-divider, rgba(0,0,0,0.15)); padding: 6px 10px; background: var(--popup-active-bg, rgba(0,0,0,0.03)); font-weight: bold; text-align: left; line-height: 1.4;">${cell}</th>`;
        } else {
          htmlResult += `<td style="border: 1px solid var(--popup-divider, rgba(0,0,0,0.15)); padding: 6px 10px; line-height: 1.4;">${cell}</td>`;
        }
      });
      htmlResult += '</tr>';

      isTableHeader = false;
      continue;
    }

    // 1. 分割線 (Horizontal Rule)
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      while (listStack.length > 0) {
        const top = listStack.pop();
        htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
      }
      htmlResult += '<hr style="border: none; border-top: 1px solid var(--popup-divider, rgba(0,0,0,0.1)); margin: 8px 0;" />';
      continue;
    }

    // 2. 標題 (Headers)
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      while (listStack.length > 0) {
        const top = listStack.pop();
        htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
      }
      const level = headerMatch[1].length;
      const content = parseInlineMarkdown(headerMatch[2]);
      const fontSize = 1.3 - (level - 1) * 0.08;
      htmlResult += `<h${level} style="margin: 8px 0 4px 0; font-weight: bold; color: var(--popup-text); line-height: 1.3; font-size: ${fontSize}em;">${content}</h${level}>`;
      continue;
    }

    // 3. 引用 (Blockquotes)
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      while (listStack.length > 0) {
        const top = listStack.pop();
        htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
      }
      const content = parseInlineMarkdown(quoteMatch[1]);
      htmlResult += `<blockquote style="border-left: 3px solid var(--popup-divider, rgba(0,0,0,0.1)); padding-left: 8px; margin: 6px 0; color: var(--popup-text-muted, #666); font-style: italic;">${content}</blockquote>`;
      continue;
    }

    // 4. 列表項 (List Items)
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (ulMatch || olMatch) {
      const isUl = !!ulMatch;
      const match = isUl ? ulMatch : olMatch;
      const indent = match[1].length;
      const content = parseInlineMarkdown(match[2]);
      const listType = isUl ? 'ul' : 'ol';

      // 調整縮進層級
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
        const top = listStack.pop();
        htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
      }

      if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
        // 開啟新列表
        listStack.push({ type: listType, indent: indent });
        const level = listStack.length;
        let listStyle = '';
        if (listType === 'ul') {
          const bulletType = level === 1 ? 'disc' : (level === 2 ? 'circle' : 'square');
          listStyle = `list-style-type: ${bulletType};`;
        } else {
          const numType = level === 1 ? 'decimal' : (level === 2 ? 'lower-alpha' : 'lower-roman');
          listStyle = `list-style-type: ${numType};`;
        }
        htmlResult += `<${listType} style="margin: 4px 0; padding-left: 20px; ${listStyle}">`;
      } else if (listStack[listStack.length - 1].type !== listType) {
        // 縮進相同但類型改變 (ul -> ol 或 ol -> ul)
        const top = listStack.pop();
        htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
        listStack.push({ type: listType, indent: indent });
        const level = listStack.length;
        let listStyle = '';
        if (listType === 'ul') {
          const bulletType = level === 1 ? 'disc' : (level === 2 ? 'circle' : 'square');
          listStyle = `list-style-type: ${bulletType};`;
        } else {
          const numType = level === 1 ? 'decimal' : (level === 2 ? 'lower-alpha' : 'lower-roman');
          listStyle = `list-style-type: ${numType};`;
        }
        htmlResult += `<${listType} style="margin: 4px 0; padding-left: 20px; ${listStyle}">`;
      }

      htmlResult += `<li style="margin-bottom: 3px; line-height: 1.5;">${content}</li>`;
      continue;
    }

    // 5. 空白行
    if (trimmed === '') {
      while (listStack.length > 0) {
        const top = listStack.pop();
        htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
      }
      htmlResult += '<div style="height: 6px;"></div>';
      continue;
    }

    // 6. 普通段落文字
    while (listStack.length > 0) {
      const top = listStack.pop();
      htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
    }
    const parsedContent = parseInlineMarkdown(line);
    htmlResult += `<div style="margin-bottom: 4px; line-height: 1.5;">${parsedContent}</div>`;
  }

  // 關閉剩餘的列表或表格
  while (listStack.length > 0) {
    const top = listStack.pop();
    htmlResult += (top.type === 'ul' ? '</ul>' : '</ol>');
  }
  if (inTable) {
    htmlResult += '</tbody></table></div>';
  }

  return htmlResult;
}
