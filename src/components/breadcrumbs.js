/**
 * Breadcrumbs Component - Navigation breadcrumbs for encyclopedia
 * RTL, accessible, structured data ready
 * @module components/breadcrumbs
 */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function generateBreadcrumbsFromUrl() {
  const segments = window.location.pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/');

  const labels = {
    '': 'الرئيسية',
    'encyclopedia': 'الموسوعة الإسلامية',
    'encyclopedia.html': 'الموسوعة الإسلامية',
  };

  const breadcrumbs = [{ label: 'الرئيسية', href: '/index.html', icon: '🏠' }];

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    currentPath += '/' + segments[i];
    const segment = segments[i];
    if (segment.endsWith('.html')) {
      const label = labels[segment] || segment.replace('.html', '').replace(/-/g, ' ');
      breadcrumbs.push({ label, href: currentPath, icon: '📄' });
    } else if (segment) {
      const label = labels[segment] || segment.replace(/-/g, ' ');
      breadcrumbs.push({ label, href: currentPath || '/index.html', icon: '📁' });
    }
  }

  const last = breadcrumbs[breadcrumbs.length - 1];
  if (last && !last.href.includes(window.location.pathname)) {
    last.href = window.location.pathname;
  }

  return breadcrumbs;
}

export function initBreadcrumbs(container, breadcrumbs) {
  if (!breadcrumbs || !breadcrumbs.length) return;

  container.innerHTML = '';

  const nav = document.createElement('nav');
  nav.className = 'breadcrumbs';
  nav.setAttribute('aria-label', 'مسار التنقل');

  const ol = document.createElement('ol');
  ol.className = 'breadcrumbs-list';

  breadcrumbs.forEach((bc, i) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';
    const isLast = i === breadcrumbs.length - 1;

    if (isLast) {
      li.setAttribute('aria-current', 'page');
      li.innerHTML = `<span class="breadcrumb-current">${escapeHtml(bc.label)}</span>`;
    } else {
      li.innerHTML = `<a href="${escapeHtml(bc.href)}" class="breadcrumb-link">${escapeHtml(bc.label)}</a>`;
    }

    ol.appendChild(li);
  });

  nav.appendChild(ol);
  container.appendChild(nav);
  return nav;
}
