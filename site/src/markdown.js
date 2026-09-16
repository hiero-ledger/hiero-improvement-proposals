const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => HTML_ESCAPES[character]);
}

export function renderMermaidCode({ text, lang }) {
  const language = String(lang || '').trim().split(/\s+/, 1)[0].toLowerCase();
  if (language !== 'mermaid') return false;

  return `<div class="mermaid">${escapeHtml(String(text || '').trim())}</div>\n`;
}
