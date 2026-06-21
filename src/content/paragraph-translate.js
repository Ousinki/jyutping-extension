// Whitelist HTML sanitizer for AI-returned paragraph translations.
//
// The translated markup comes back from an external model and is injected
// into the live page DOM, so it must be treated as untrusted. We parse it in
// an inert <template> (no scripts run, no resources load), then keep only a
// small whitelist of inline tags/attributes; unknown tags are unwrapped
// (their text kept) and dangerous tags are dropped wholesale.

const ALLOWED_TAGS = new Set([
  'A', 'B', 'I', 'EM', 'STRONG', 'SPAN', 'BR', 'CODE', 'SUB', 'SUP',
  'MARK', 'U', 'S', 'SMALL', 'DEL', 'INS', 'ABBR', 'WBR', 'BDI', 'BDO',
  'Q', 'CITE', 'TIME', 'RUBY', 'RT', 'RP'
]);

// Dropped together with their entire subtree.
const DROP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE',
  'FORM', 'INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'OPTION', 'SVG', 'MATH',
  'NOSCRIPT', 'TEMPLATE', 'CANVAS', 'AUDIO', 'VIDEO', 'SOURCE', 'TRACK'
]);

const ALLOWED_ATTRS = { A: new Set(['href', 'title']) };
const EMPTY = new Set();

function isSafeHref(value) {
  const v = (value || '').trim().toLowerCase();
  // Block script-bearing / data URLs; allow normal http(s), mailto, relative, anchors.
  return !(v.startsWith('javascript:') || v.startsWith('data:') || v.startsWith('vbscript:'));
}

export function sanitizeTranslatedHtml(html) {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;

  // Snapshot all elements up front; we mutate the tree as we go.
  const elements = Array.from(root.querySelectorAll('*'));
  for (const el of elements) {
    // Skip nodes already detached by a dropped/unwrapped ancestor.
    if (!root.contains(el)) continue;

    const tag = el.tagName;

    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: keep children/text, discard the tag itself.
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      continue;
    }

    // Allowed tag: strip every attribute outside its whitelist.
    const allowed = ALLOWED_ATTRS[tag] || EMPTY;
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed.has(name) || (name === 'href' && !isSafeHref(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === 'A' && el.hasAttribute('href')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return template.innerHTML;
}
