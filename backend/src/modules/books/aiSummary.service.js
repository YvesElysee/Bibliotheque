/**
 * Résumé automatique d'un livre via l'IA gratuite Google Gemini.
 * Ne nécessite qu'une clé gratuite : https://aistudio.google.com/apikey
 * (variable d'environnement GEMINI_API_KEY). Sans clé, le service renvoie 503.
 */
async function generateBookSummary({ title, author, year, summary }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const err = new Error(
      "IA non configurée : ajoute GEMINI_API_KEY (clé gratuite https://aistudio.google.com/apikey) dans .env puis redémarre le serveur."
    );
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  // Modèles disponibles (du plus récent au plus ancien). Google retire parfois
  // un modèle ; on essaie automatiquement le suivant si le premier est retiré.
  const candidates = [
    process.env.GEMINI_MODEL,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const prompt = [
    'Tu es un bibliothécaire catholique qui rédige de courtes présentations de livres en français.',
    'Rédige un résumé factuel de 3 à 5 phrases pour le livre suivant :',
    `- Titre : ${title || 'inconnu'}`,
    author ? `- Auteur(s) : ${author}` : '',
    year ? `- Année : ${year}` : '',
    summary
      ? `- Description brute disponible : ${summary}`
      : '- Aucune description disponible : base-toi sur tes connaissances, reste sobre et prudent.',
    'Contraintes : renvoie UNIQUEMENT le résumé, en français, sans HTML, sans titre d\'introduction, sans guillemets décoratifs.',
  ].filter(Boolean).join('\n');

  let lastReason = '';
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
      throw new Error('Impossible de joindre l\'IA (vérifiez la connexion internet du serveur).');
    }

    const data = await res.json().catch(() => null);
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ') || '';

    if (res.ok && text) {
      return text.trim();
    }
    lastReason = data?.error?.message || `Réponse IA inattendue (HTTP ${res.status}).`;

    // Modèle retiré, saturé ou en surcharge → on essaie le modèle suivant.
    const retryable = /no longer available|not found|do not exist|not supported|high demand|overloaded|temporarily|rate limit|quota|resource.?exhausted|429|500|503|404/i.test(lastReason);
    if (!retryable) break;
  }

  const err = new Error(`L'IA n'a pas pu générer le résumé : ${lastReason}`);
  err.statusCode = 502;
  throw err;
}

module.exports = { generateBookSummary };