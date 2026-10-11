/**
 * Composant BookCard
 * @param {Object} book - Données du livre
 * @param {Function} onClick - Callback au clic
 */

import { resolveAssetUrl } from '../core/api.js';

const PLACEHOLDER_ICON = `
  <svg class="w-12 h-12 text-primary-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477
      5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477
      4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
  </svg>`;

const STAR_FILLED = `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;

export function createBookCard(book, onClick) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.setAttribute('role', 'article');
  card.setAttribute('tabindex', '0');
  card.dataset.bookId = book.id;

  const isAvailable = book.availableCopies > 0;
  const coverSrc = resolveAssetUrl(book.coverUrl);

  const starsHtml = book.avgRating
    ? `<div class="stars">${Array.from({ length: 5 }, (_, i) =>
        `<span class="star ${i < Math.round(book.avgRating) ? 'filled' : ''}">${STAR_FILLED}</span>`
      ).join('')}<span class="text-xs text-slate-500 ml-1">${book.avgRating}</span></div>`
    : '';

  const categoryTags = (book.categories || []).slice(0, 2)
    .map((bc) => `<span class="tag" style="background:${bc.category.color}22;color:${bc.category.color};border-color:${bc.category.color}44">${bc.category.nameFr}</span>`)
    .join('');

  card.innerHTML = `
    <div class="book-card__cover">
      ${coverSrc
        ? `<img src="${coverSrc}" alt="Couverture de ${book.title}" loading="lazy">`
        : `<div class="book-card__cover-placeholder">${PLACEHOLDER_ICON}</div>`
      }
      <div class="absolute top-2 right-2">
        <span class="${isAvailable ? 'badge-available' : 'badge-unavailable'} badge text-xs">
          ${isAvailable ? '✓ Disponible' : '✗ Emprunté'}
        </span>
      </div>
    </div>
    <div class="book-card__body">
      <h3 class="book-card__title">${book.title}</h3>
      <p class="book-card__author">${book.author}${book.year ? ` · ${book.year}` : ''}</p>
      ${starsHtml}
      <div class="book-card__footer mt-3">
        <div class="flex flex-wrap gap-1">${categoryTags}</div>
        ${!isAvailable ? `<span class="text-xs text-slate-500">${book._count?.reservations || 0} en attente</span>` : ''}
      </div>
    </div>
  `;

  // Image de couverture indisponible → on affiche le placeholder.
  // (Écouteur ajouté en JS, pas d'attribut inline : respecte la CSP script-src-attr 'none'.)
  const coverImg = card.querySelector('.book-card__cover img');
  if (coverImg) {
    coverImg.addEventListener('error', () => {
      const parent = coverImg.parentElement;
      if (parent) parent.innerHTML = `<div class="book-card__cover-placeholder">${PLACEHOLDER_ICON}</div>`;
    });
  }

  const handleClick = () => onClick?.(book);
  card.addEventListener('click', handleClick);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } });

  return card;
}

/**
 * Génère des cartes skeleton pour le chargement
 */
export function createSkeletonCards(count = 8) {
  return Array.from({ length: count }, () => {
    const el = document.createElement('div');
    el.className = 'book-card';
    el.innerHTML = `
      <div class="skeleton aspect-[2/3] w-full"></div>
      <div class="p-4 space-y-3">
        <div class="skeleton h-4 w-3/4 rounded"></div>
        <div class="skeleton h-3 w-1/2 rounded"></div>
        <div class="skeleton h-3 w-1/3 rounded"></div>
      </div>
    `;
    return el;
  });
}

export default { createBookCard, createSkeletonCards };
