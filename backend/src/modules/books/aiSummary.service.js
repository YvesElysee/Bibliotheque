/**
 * Résumé automatique d'un livre via l'IA gratuite Google Gemini.
 * Version optimisée pour éviter la surcharge "high demand".
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
  return [...new Set(keys.filter(Boolean))];
}

async function generateBookSummary({ title, author, year, summary }) {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    const err = new Error(
      "IA non configurée : ajoute au moins une clé GEMINI_API_KEY_1/2/3 depuis https://aistudio.google.com/apikey"
    );
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  // Modèles les plus légers en priorité (moins de surcharge)
  const models = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
  ];

  const prompt = [
    'Résume ce livre en français en 60 à 80 mots, 4 à 5 phrases.',
    'Sois concis, factuel, sans introduction ni conclusion.',
    `Titre: ${title || 'inconnu'}`,
    author ? `Auteur: ${author}` : '',
    year ? `Année: ${year}` : '',
    summary ? `Infos: ${summary}` : ''
  ].filter(Boolean).join('\n');

  let lastReason = '';

  // Essayer TOUTES les combinaisons (clé + modèle)
  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    for (let mi = 0; mi < models.length; mi++) {
      const model = models[mi];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 280,
                topP: 0.8
              }
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeout);
        const data = await res.json().catch(() => null);
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').replace(/\s+/g, ' ') || '';

        if (res.ok && text) {
          return text.trim();
        }

        lastReason = data?.error?.message || `HTTP ${res.status}`;
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') {
          lastReason = 'Délai dépassé';
        } else {
          lastReason = 'Erreur réseau';
        }
        continue;
      }

      // Si c'est une surcharge ou quota -> passer DIRECTEMENT à la clé suivante
      if (/high demand|overloaded|unavailable|temporarily|quota|resource exhausted|429/i.test(lastReason)) {
        break;
      }

      // Si clé invalide -> passer à la clé suivante
      if (/invalid api key|api key not valid|permission denied/i.test(lastReason)) {
        break;
      }

      // Si modèle non trouvé -> essayer le modèle suivant avec la même clé
      if (/not found|not supported|is not found/i.test(lastReason)) {
        continue;
      }

      // Autre erreur -> essayer quand même le modèle suivant
      continue;
    }
  }

  const err = new Error(`L'IA n'a pas pu générer le résumé. Essaie dans un instant.`);
  err.statusCode = 502;
  throw err;
}

module.exports = { generateBookSummary };
