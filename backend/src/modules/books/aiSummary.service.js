/**
 * Résumé automatique d'un livre via l'IA gratuite Google Gemini.
 * Supporte plusieurs clés (rotation) pour contourner le quota gratuit.
 */

function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(',').forEach((k) => {
      const t = k.trim();
      if (t) keys.push(t);
    });
  }
  if (process.env.GEMINI_API_KEY_1) keys.push(process.env.GEMINI_API_KEY_1.trim());
  if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2.trim());
  if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3.trim());
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  // dédoublonnage
  return [...new Set(keys.filter(Boolean))];
}

async function generateBookSummary({ title, author, year, summary }) {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    const err = new Error(
      "IA non configurée : ajoute au moins une clé GEMINI_API_KEY (ou GEMINI_API_KEYS / GEMINI_API_KEY_1/2/3) gratuite depuis https://aistudio.google.com/apikey dans .env puis redémarre le serveur."
    );
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const candidates = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-flash-latest',
  ].filter((m, i, arr) => m && String(m).trim() && arr.indexOf(m) === i);

  const prompt = [
    'Tu es un bibliothécaire catholique qui rédige de courtes présentations de livres en français.',
    'Rédige un résumé factuel de 3 à 5 phrases pour le livre suivant :',
    `- Titre : ${title || 'inconnu'}`,
    author ? `- Auteur(s) : ${author}` : '',
    year ? `- Année : ${year}` : '',
    summary
      ? `- Description brute disponible : ${summary}`
      : '- Aucune description disponible : base-toi sur tes connaissances, reste sobre et prudent.',
    "Contraintes : renvoie UNIQUEMENT le résumé, en français, sans HTML, sans titre d'introduction, sans guillemets décoratifs.",
  ].filter(Boolean).join('\n');

  let lastReason = '';
  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    for (const model of candidates) {
      let res;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 350 },
            }),
          }
        );
      } catch (e) {
        lastReason = "Impossible de joindre l'IA (vérifiez la connexion internet du serveur).";
        continue;
      }

      const data = await res.json().catch(() => null);
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ') || '';

      if (res.ok && text) {
        return text.trim();
      }
      lastReason = data?.error?.message || `Réponse IA inattendue (HTTP ${res.status}).`;

      const retryable = /no longer available|not found|do not exist|not supported|high demand|overloaded|temporarily|rate limit|quota|resource.?exhausted|429|500|503|404|invalid api key|permission denied|api key not valid/i.test(lastReason);
      if (!retryable) break;
      // Si clé invalide ou quota épuisé, on passe à la clé suivante
      if (/invalid api key|permission denied|api key not valid/i.test(lastReason)) break;
      if (/not found|is not supported|generateContent/i.test(lastReason) && !/rate limit|quota|429/i.test(lastReason)) {
        // Essayer le modèle suivant sans passer à la clé
        continue;
      }
    }
  }

  const err = new Error(`L'IA n'a pas pu générer le résumé : ${lastReason}`);
  err.statusCode = 502;
  throw err;
}

module.exports = { generateBookSummary };
