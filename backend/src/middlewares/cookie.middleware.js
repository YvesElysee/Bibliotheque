/**
 * Parseur de cookies minimal (remplace cookie-parser).
 * Renseigne req.cookies à partir de l'en-tête Cookie.
 */
const parseCookies = (req, _res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      const raw = part.slice(idx + 1).trim();
      if (!key) continue;
      try {
        req.cookies[key] = decodeURIComponent(raw);
      } catch {
        req.cookies[key] = raw;
      }
    }
  }
  next();
};

module.exports = parseCookies;
