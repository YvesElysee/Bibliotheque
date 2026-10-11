const fs = require('fs');
const path = require('path');
const { logger } = require('../../utils/logger');

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');

const LANG_MAP = {
  fr: 'FR', 'fr-fr': 'FR', en: 'EN', 'en-us': 'EN', 'en-gb': 'EN',
  la: 'LA', es: 'ES', 'es-es': 'ES', it: 'IT', 'it-it': 'IT', de: 'DE', 'de-de': 'DE',
};

const normalizeIsbn = (raw) => String(raw || '').replace(/[-\s]/g, '').toUpperCase();
const isValidIsbn = (isbn) => /^\d{13}$/.test(isbn) || /^\d{9}[\dX]$/.test(isbn);

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Bibliotheque-Congregation)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

/**
 * Télécharge une image de couverture et la stocke en local (/uploads/covers/).
 * Renvoie le chemin local relatif, ou null si le téléchargement échoue.
 */
async function downloadCoverLocally(url, hint) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Bibliotheque-Congregation)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 4 * 1024 * 1024) return null; // max ~4 Mo
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : contentType.includes('gif') ? 'gif' : 'jpg';
    fs.mkdirSync(COVERS_DIR, { recursive: true });
    const safe = String(hint || 'cover').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${Date.now()}-${safe || 'cover'}.${ext}`;
    fs.writeFileSync(path.join(COVERS_DIR, filename), buffer);
    logger.info(`Couverture téléchargée : /uploads/covers/${filename}`);
    return `/uploads/covers/${filename}`;
  } catch (e) {
    return null;
  }
}

const pickCover = (urls) => (urls || []).filter(Boolean).map((u) => u.replace(/^http:/i, 'https:')).find(Boolean) || null;

/**
 * Recherche un livre par ISBN (Google Books + Open Library), fusionne les données
 * et tente de télécharger la couverture en local.
 */
async function lookupBookByIsbn(rawIsbn) {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isValidIsbn(isbn)) {
    const err = new Error('Format ISBN invalide : attendu 10 ou 13 chiffres.');
    err.statusCode = 400;
    throw err;
  }

  const result = { isbn, title: null, author: null, publishingHouse: null, year: null, pageCount: null, language: null, summary: null, coverUrl: null };

  // 1) Google Books — le plus riche (description notamment).
  // Sans clé API, le quota public peut être saturé (429) : on passe alors à
  // Open Library. Une clé (GOOGLE_BOOKS_API_KEY, gratuite) garantit la fiabilité.
  try {
    const gbKey = process.env.GOOGLE_BOOKS_API_KEY;
    const gbUrl =
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1&country=FR` +
      (gbKey ? `&key=${encodeURIComponent(gbKey)}` : '');
    const gb = await fetchJson(gbUrl);
    const info = gb?.items?.[0]?.volumeInfo;
    if (info) {
      if (info.title) result.title = info.title + (info.subtitle ? ` : ${info.subtitle}` : '');
      if (info.authors?.length) result.author = info.authors.join(', ');
      result.publishingHouse = info.publisher || null;
      if (info.publishedDate) {
        const m = String(info.publishedDate).match(/\d{4}/);
        if (m) result.year = parseInt(m[0], 10);
      }
      result.pageCount = info.pageCount || null;
      result.language = LANG_MAP[(info.language || '').toLowerCase()] || null;
      result.googleCover = pickCover([info.imageLinks?.large, info.imageLinks?.medium, info.imageLinks?.thumbnail]);
      if (info.description) {
        result.summary = info.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2600);
      }
    }
  } catch (e) { /* source indisponible, on continue */ }

  // 2) Open Library — complète les champs manquants + couverture fiable
  let openLibraryCover = null;
  try {
    const ol = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`);
    const data = ol?.[`ISBN:${isbn}`];
    if (data) {
      if (!result.title && data.title) result.title = data.title;
      if (!result.author && data.authors?.length) result.author = data.authors.map((a) => a.name).join(', ');
      if (!result.publishingHouse && data.publishers?.length) result.publishingHouse = data.publishers[0].name;
      if (!result.year && data.publish_date) {
        const m = String(data.publish_date).match(/\d{4}/);
        if (m) result.year = parseInt(m[0], 10);
      }
      if (!result.pageCount && data.number_of_pages) result.pageCount = data.number_of_pages;
      openLibraryCover = data.cover?.large || data.cover?.medium || null;
    }
  } catch (e) { /* source indisponible, on continue */ }

  if (!result.title) {
    const err = new Error('ISBN non répertorié dans Google Books / Open Library. Renseignez le livre manuellement.');
    err.statusCode = 404;
    throw err;
  }

  // 3) Couverture : Open Library d'abord (fiable), sinon Google Books.
  //    On la télécharge EN LOCAL quand c'est possible (fonctionne sous CSP).
  let externalCover = openLibraryCover || result.googleCover || null;
  let localUrl = null;
  if (externalCover) {
    localUrl = await downloadCoverLocally(externalCover, isbn);
  } else {
    // Secours : couverture Open Library directement par ISBN (si elle existe)
    localUrl = await downloadCoverLocally(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, isbn);
  }
  result.coverUrl = localUrl || externalCover;

  delete result.googleCover;
  return result;
}

module.exports = { lookupBookByIsbn, downloadCoverLocally };