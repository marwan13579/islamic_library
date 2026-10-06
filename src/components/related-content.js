/**
 * Related Content Component - Smart content relationships without AI
 * Uses tags, categories, keywords to link related content
 * @module components/related-content
 */


function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}