/**
 * App shell: sidebar builder, hash router, IntersectionObserver active-nav,
 * mobile drawer toggle.
 */

import { SECTIONS } from './sections.js';

declare const __LIBRARY_VERSION__: string;

// ─── DOM ──────────────────────────────────────────────────────────────────────

const sidebar = document.getElementById('sidebar')!;
const docMain = document.getElementById('doc-main')!;
const menuToggle = document.getElementById('menu-toggle')!;
const backdrop = document.getElementById('backdrop')!;
const versionEl = document.getElementById('lib-version');

// ─── Version ──────────────────────────────────────────────────────────────────

if (versionEl) versionEl.textContent = `v${__LIBRARY_VERSION__}`;

// ─── Build sidebar nav ────────────────────────────────────────────────────────

const groups: Record<string, { title: string; items: typeof SECTIONS }> = {};
for (const s of SECTIONS) {
  if (!groups[s.group]) groups[s.group] = { title: s.group, items: [] };
  groups[s.group]!.items.push(s);
}

const navEl = document.createElement('nav');
navEl.className = 'sidebar-nav';
navEl.setAttribute('aria-label', 'Documentation navigation');

for (const group of Object.values(groups)) {
  const grpEl = document.createElement('div');
  grpEl.className = 'nav-group';

  const grpLabel = document.createElement('div');
  grpLabel.className = 'nav-group-label';
  grpLabel.textContent = group.title;
  grpEl.appendChild(grpLabel);

  for (const section of group.items) {
    const a = document.createElement('a');
    a.href = `#${section.id}`;
    a.className = 'nav-item';
    a.dataset['section'] = section.id;
    a.textContent = section.title;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(section.id);
      closeSidebar();
    });
    grpEl.appendChild(a);
  }

  navEl.appendChild(grpEl);
}

sidebar.appendChild(navEl);

// ─── Build all sections ───────────────────────────────────────────────────────

for (const section of SECTIONS) {
  section.build(docMain);
}

// ─── Hash router ──────────────────────────────────────────────────────────────

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Offset for fixed top bar
  const top = el.getBoundingClientRect().top + window.scrollY - 64;
  window.scrollTo({ top, behavior: 'smooth' });
  history.replaceState(null, '', `#${id}`);
  setActiveNavItem(id);
}

function setActiveNavItem(id: string) {
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset['section'] === id);
    a.setAttribute('aria-current', a.dataset['section'] === id ? 'true' : 'false');
  });
}

// Handle hash on load
if (location.hash) {
  const id = location.hash.slice(1);
  requestAnimationFrame(() => scrollToSection(id));
} else {
  setActiveNavItem('getting-started');
}

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id) setActiveNavItem(id);
});

// ─── IntersectionObserver — active nav on scroll ──────────────────────────────

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveNavItem(entry.target.id);
        history.replaceState(null, '', `#${entry.target.id}`);
      }
    }
  },
  { rootMargin: '-64px 0px -55% 0px', threshold: 0 }
);

document.querySelectorAll<HTMLElement>('.doc-section').forEach(sec => observer.observe(sec));

// ─── Mobile sidebar toggle ────────────────────────────────────────────────────

function openSidebar() {
  sidebar.classList.add('open');
  backdrop.hidden = false;
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close navigation');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  backdrop.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
}

menuToggle.addEventListener('click', () => {
  if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
});

backdrop.addEventListener('click', closeSidebar);

// Keyboard: Escape closes sidebar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
});
