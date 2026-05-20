#!/usr/bin/env node
/**
 * Conversation opportunity finder.
 *
 * Busca conversaciones en Reddit donde valga la pena que Robin House / Casa Museo
 * mencione orgánicamente. NO automatiza la respuesta (sería spam) — abre tarea
 * Notion P2 con el link al hilo, contexto, y un draft de respuesta sugerida
 * para que el humano publique manualmente desde su propia cuenta de Reddit.
 *
 * Estrategia: usar Reddit JSON public API (no requiere OAuth para search), filtrar
 * por relevancia + recencia + engagement, dedupe vs historial.
 *
 * Subreddits relevantes:
 *   r/Medellin, r/Colombia, r/digitalnomad, r/solotravel, r/travel, r/Bogota
 *
 * Heurística de relevancia:
 *   - Query contiene: "where to stay", "donde quedarse", "hotel medellin",
 *     "laureles", "poblado vs laureles", "is medellín safe", etc.
 *   - Post score > 5 OR comments > 3
 *   - Age < 30 días
 *   - Casa Museo o Robin House aún no han comentado
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'conversation-history.json');

const SUBREDDITS = ['Medellin', 'Colombia', 'digitalnomad', 'solotravel', 'travel'];

const QUERIES = [
  // ES
  'donde quedarse medellin',
  'donde dormir medellin',
  'hotel laureles medellin',
  'hospedaje medellin',
  'laureles vs poblado',
  // EN
  'where to stay medellin',
  'medellin where to stay',
  'laureles vs poblado',
  'is laureles safe',
  'best neighborhood medellin',
  'medellin hotel recommendation',
  'medellin nomad',
];

const USER_AGENT = 'CasaMuseoLaurelesBot/1.0 (by /u/casamuseolaureles - SEO research only, manual responses)';
const MIN_RELEVANCE = 6;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Haiku para drafts: menos load que Sonnet, ~5x más barato, calidad suficiente para drafts cortos
const MODEL = 'claude-haiku-4-5';
const MODEL_FALLBACK = 'claude-sonnet-4-5';

// Gate obligatorio: el post DEBE mencionar al menos una de estas palabras de hospedaje
const HOSPEDAJE_GATE = /\b(stay|staying|stayed|sleep|sleeping|hotel|hotels|hostel|airbnb|apartment|apartments|loft|lodging|accommodation|accomodation|accommodations|where to (stay|sleep|book)|donde (quedarse|dormir|me quedo|hospedarse|alojarse)|hospedaj|alojam|apartamentos?|loft|airbnb|hostel|hotel|d[oó]nde dormir|d[oó]nde quedarse)\b/i;
const FEEDBACK_LOG_PATH = path.join(ROOT, 'data', 'human-feedback-log.md');

// ─────────────────────────────────────────────────────────────────
// Reddit search
// ─────────────────────────────────────────────────────────────────

async function searchReddit(query, subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=15&t=month`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data?.children || []).map((c) => c.data);
  } catch {
    return [];
  }
}

async function searchRedditAll(query) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query + ' medellin')}&sort=new&limit=10&t=month`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data?.children || []).map((c) => c.data);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Relevance scoring
// ─────────────────────────────────────────────────────────────────

// Keywords negativos: si aparecen, el post NO es relevante aunque mencione Medellín
const NEGATIVE_KEYWORDS = /pensi[oó]n|jubilaci[oó]n|impuestos?|tax|elecciones|pol[ií]tica|fiscal|migrar|emigrar|residencia legal|visa|nomad visa|cedula|narcotr|cartel|escobar|narco|crimen|extorsi|scam|estafa|robbery|robaron|stolen|sketchy|avoid|warning|advertenc|passport bro|sugar baby|prostitu|sex tour|sexual|sexpat|drug/i;

function scorePost(post) {
  const title = (post.title || '').toLowerCase();
  const selftext = (post.selftext || '').toLowerCase();
  const combined = title + ' ' + selftext;

  // Filtros negativos primero (early exit)
  if (post.locked || post.archived) return 0;
  if ((post.score || 0) < 0) return 0;
  if (NEGATIVE_KEYWORDS.test(combined)) return 0;
  // Gate obligatorio: tiene que tocar el tema hospedaje
  if (!HOSPEDAJE_GATE.test(combined)) return 0;

  let score = 0;

  // Términos de hospedaje directo (high signal)
  if (/where to stay|donde quedarse|donde dormir|hospedaje|alojamiento|airbnb|hostel|hotel/i.test(combined)) score += 3;
  // Mención específica Medellín
  if (/medell[ií]n/i.test(combined)) score += 2;
  // Mención de barrios target
  if (/laureles|poblado|envigado|estadio atanasio|provenza/i.test(combined)) score += 2;
  // Preguntas específicas (alta intención de respuesta)
  if (/recommend|suggest|where should|donde puedo|safe|seguro|advice|tips|first time|primera vez/i.test(combined)) score += 2;
  // Visiting/traveling context
  if (/visiting|traveling|trip|viaje|vacation|vacaciones|tourist|turista/i.test(combined)) score += 1;
  // Engagement signals
  if ((post.score || 0) > 10) score += 1;
  if ((post.num_comments || 0) > 5) score += 1;

  // Bonus: si menciona target audience (parejas, nómadas)
  if (/couple|pareja|nomad|n[oó]mada|remote work|trabajo remoto|honeymoon|luna de miel/i.test(combined)) score += 1;

  return score;
}

// Detecta idioma del post: heurística simple
function detectLanguage(text) {
  const t = (text || '').toLowerCase();
  const esWords = (t.match(/\b(que|donde|como|para|por|con|los|las|del|una|las|esto|esta|estoy|estoy|son|hay|también|gracias|hola|hospedaje|alojamiento|barrio)\b/g) || []).length;
  const enWords = (t.match(/\b(the|that|where|how|with|this|that|are|have|also|thanks|hi|hello|stay|neighborhood|safe|recommend|visit)\b/g) || []).length;
  return esWords > enWords ? 'es' : 'en';
}

// Fetch top comments del post (para dar contexto al draft)
async function fetchTopComments(permalink, limit = 3) {
  try {
    const r = await fetch(`https://www.reddit.com${permalink}.json?limit=${limit}&sort=top`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!r.ok) return [];
    const arr = await r.json();
    const commentsListing = arr[1]?.data?.children || [];
    return commentsListing
      .filter((c) => c.kind === 't1' && c.data?.body && !c.data?.stickied)
      .slice(0, limit)
      .map((c) => ({
        body: (c.data.body || '').slice(0, 600),
        score: c.data.score || 0,
        author: c.data.author || 'unknown',
      }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Custom draft generation per opportunity (Claude API)
// ─────────────────────────────────────────────────────────────────

async function loadHumanFeedbackOnReddit() {
  // Lee directo de Notion: tareas con prefijo [REDDIT] que tengan comentarios humanos.
  // Esos comentarios son guía de tono/estilo para los próximos drafts.
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) return null;
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 30,
        filter: { property: 'Type', select: { equals: 'Outreach' } },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const redditTasks = j.results.filter((p) => {
      const t = (p.properties?.Title?.title || []).map((x) => x.plain_text).join('');
      return t.includes('[REDDIT]');
    }).slice(0, 8);

    const feedbacks = [];
    for (const task of redditTasks) {
      const title = (task.properties.Title.title || []).map((x) => x.plain_text).join('');
      // Pull comments
      try {
        const cr = await fetch(`https://api.notion.com/v1/comments?block_id=${task.id}&page_size=20`, {
          headers: {
            Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
          },
        });
        if (!cr.ok) continue;
        const cj = await cr.json();
        // Filtrar comentarios del bot (que empiezan con emojis específicos o son sistémicos)
        const humanComments = (cj.results || [])
          .map((c) => (c.rich_text || []).map((t) => t.plain_text).join('').trim())
          .filter((t) => t && !t.startsWith('✅') && !t.startsWith('🔴') && !t.startsWith('🔄') && !t.startsWith('⚠️') && !t.startsWith('API key'));
        if (humanComments.length) {
          feedbacks.push(`Tarea: ${title.slice(0, 80)}\nFeedback humano: ${humanComments.join(' | ')}`);
        }
      } catch {}
    }
    return feedbacks.length ? feedbacks.join('\n\n') : null;
  } catch (e) {
    console.warn('Reddit feedback load failed:', e.message);
    return null;
  }
}

function buildRedditDraftSystemPrompt(state, humanFeedback) {
  const nap = state.nap;
  return `Eres el editor de respuestas de Reddit para ${nap.name}, un proyecto boutique de 3 lofts en Laureles, Medellín.

OBJETIVO: generar un draft de respuesta listo para postear. El humano solo lo verifica y publica desde su cuenta personal de Reddit (/u/...). Cada draft debe ser HECHO A MEDIDA para el post puntual — NO templates genéricos.

CONTEXTO DE LA MARCA:
- ${nap.name} en ${nap.neighborhood}, ${nap.city}
- 3 lofts: Standar (2p), Familiar (4p), Deluxe con Jacuzzi (2p)
- Diferencial: diseño curado tipo galería de arte, Laureles caminable y auténtico (no Poblado turístico)
- Desarrollador: Robin House. Operador: HOUSY.
- Web: ${nap.website}

REGLAS DEL DRAFT:

1. **Idioma del post = idioma del draft.** Si el OP escribió en español, respondé en español. Si fue en inglés, en inglés.

2. **Aportá VALOR concreto primero**: datos, distancias, precios, recomendaciones específicas a la situación que describe el OP. La mención de Casa Museo es OPCIONAL y solo si encaja naturalmente.

3. **Tono según subreddit**:
   - r/Medellin, r/Colombia → casual, paisa-friendly, sin formalidad de turista
   - r/digitalnomad, r/solotravel → práctico, datos cuantitativos (wifi speed, costos)
   - r/travel → narrativo, experiencial
   - r/passportbros, r/expats → directo, sin paja

4. **NO ser comercial obvio**: NUNCA empezar con "te recomiendo Casa Museo" o variantes. Si mencionás el proyecto, hacelo al final como contexto ("yo opero un pequeño proyecto boutique en Laureles, opinión sesgada pero..."). El reddit detecta marketing al instante y downvotean.

5. **Largo**: 80-200 palabras. Más corto si el post es corto. Sin walls of text.

6. **Markdown Reddit** permitido: **negritas**, listas con -, emojis SOLO si el subreddit lo usa naturalmente.

7. **NO inventes datos**. Si decís "Laureles está a X minutos de Y", debe ser verdad. Si no estás seguro, usá expresiones cualitativas ("a corta distancia caminando").

8. **Responder específicamente** a lo que el OP preguntó. Si pidió "recommendations para 4 días, viaja sola, 25 años", el draft debe dirigirse a ESA persona y esa situación. NO un genérico de Medellín.

${humanFeedback ? `9. **Feedback histórico del humano (JD) sobre drafts anteriores** — aplicá estos aprendizajes:\n${humanFeedback}\n` : ''}

OUTPUT REQUERIDO:
SOLO el texto del draft, listo para copy-paste a Reddit. Sin explicaciones, sin "Aquí está el draft:", sin code fences. Si el draft tiene un saludo, ya está incluido. Si no, empieza directo con la respuesta sustantiva.`;
}

function buildRedditDraftUserPrompt(post, comments, lang) {
  const commentsBlock = comments.length
    ? '\n\nTOP COMENTARIOS ACTUALES (para entender qué ya se dijo y no repetir):\n' + comments.map((c) => `[+${c.score} /u/${c.author}]\n${c.body}`).join('\n\n---\n')
    : '';

  return `POST DE REDDIT:

Subreddit: r/${post.subreddit}
Título: ${post.title}
Autor: /u/${post.author || 'unknown'}
Score: ${post.score} · Comments: ${post.num_comments} · Edad: ${Math.round((Date.now() - post.created_utc * 1000) / 86400000)} días

Body del post:
${post.selftext ? post.selftext.slice(0, 2000) : '(post sin texto, solo título)'}

${commentsBlock}

INSTRUCCIONES:
Generá un draft de respuesta listo para postear. Idioma del draft: ${lang === 'es' ? 'español' : 'English'}. Responde específicamente a lo que el OP preguntó, considerando qué se dijo ya en los comentarios. NO repitas información que ya esté en los top comments. Largo: 80-200 palabras.`;
}

async function generateCustomDraft({ post, subreddit, state, humanFeedback }) {
  if (!ANTHROPIC_API_KEY) return null;
  const lang = detectLanguage((post.title || '') + ' ' + (post.selftext || ''));
  const permalink = post.permalink;
  const comments = await fetchTopComments(permalink, 3);

  const systemPrompt = buildRedditDraftSystemPrompt(state, humanFeedback);
  const userPrompt = buildRedditDraftUserPrompt({ ...post, subreddit }, comments, lang);

  // Retry con backoff exponencial + fallback Haiku → Sonnet si Haiku sigue overloaded
  const models = [MODEL, MODEL_FALLBACK];
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (r.ok) {
          const j = await r.json();
          let draft = (j.content || []).map((c) => c.text || '').join('').trim();
          if (draft.startsWith('```')) draft = draft.replace(/^```[a-z]*\n/, '').replace(/\n```\s*$/, '');
          return { draft, lang, topComments: comments, modelUsed: model };
        }
        if ([529, 429, 503].includes(r.status) && attempt < 2) {
          const backoff = Math.pow(2, attempt) * 2500 + Math.random() * 1500;
          console.warn(`Claude ${model} ${r.status} on ${post.id} — retry in ${Math.round(backoff/1000)}s`);
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }
        // Si llegamos acá: error definitivo o agotamos retries → break para probar fallback model
        const txt = await r.text();
        console.warn(`Claude ${model} draft failed (${r.status}): ${txt.slice(0, 150)} — trying fallback`);
        break;
      } catch (e) {
        console.warn(`Claude ${model} draft error attempt ${attempt + 1}: ${e.message}`);
        if (attempt < 2) await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// History (dedupe)
// ─────────────────────────────────────────────────────────────────

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { opportunities: [] }; }
}
async function saveHistory(h) { await fs.writeFile(HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }

// ─────────────────────────────────────────────────────────────────
// Notion task creator
// ─────────────────────────────────────────────────────────────────

async function createOpportunityTask(opp) {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) return null;

  const ageDays = Math.round((Date.now() - opp.createdUtc * 1000) / 86400000);
  const draftBlock = opp.customDraft
    ? `**Draft (${opp.draftLang === 'es' ? 'ES' : 'EN'}) — generado por Claude para este post puntual:**\n\n${opp.customDraft}\n\n---`
    : `⚠️ Draft no se pudo generar (revisar el contexto del post manualmente).`;

  const acceptance = `📍 Oportunidad Reddit (manual desde tu cuenta personal).

**Hilo:** ${opp.url}
**r/${opp.subreddit}** · ${ageDays}d · ${opp.score}↑ · ${opp.numComments} comments · relevancia ${opp.relevanceScore}/10

**Contexto del post (OP):**
${(opp.selftext || '(solo título)').slice(0, 600)}

${draftBlock}

⚠️ Verificar antes de postear:
• Los datos cuantitativos (precios, distancias) — son verificables?
• El tono encaja con el subreddit?
• Algún top comment ya cubrió lo que estás por decir?
• Si necesita ajustes: comentá ESTA tarea con feedback ("tono muy formal", "no menciones Casa Museo", etc.). El próximo run del conversation-finder lo tendrá en cuenta como guía.`;

  const props = {
    Title: { title: [{ text: { content: `[REDDIT] ${opp.title.slice(0, 80)}` } }] },
    Status: { status: { name: 'To Do' } },
    Priority: { select: { name: ageDays < 7 ? 'P1' : 'P2' } },
    Type: { select: { name: 'Outreach' } },
    'Created by': { select: { name: 'Brain' } },
    'For use in': { rich_text: [{ text: { content: `r/${opp.subreddit} · ${opp.score} upvotes · ${ageDays}d` } }] },
    'Acceptance criteria': { rich_text: [{ text: { content: acceptance.slice(0, 1999) } }] },
    'Linked PR': { url: opp.url },
  };

  const r = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent: { database_id: process.env.NOTION_DB_ID }, properties: props }),
  });
  if (!r.ok) {
    console.warn(`Notion task create failed: ${r.status}`);
    return null;
  }
  return r.json();
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

export async function runConversationFinder() {
  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  const humanFeedback = await loadHumanFeedbackOnReddit();
  const history = await loadHistory();
  const seenIds = new Set(history.opportunities.map((o) => o.id));

  const candidates = new Map();

  // Strategy: cada subreddit × subset de queries
  for (const sub of SUBREDDITS) {
    for (const q of QUERIES.slice(0, 3)) { // limit por sub para no explotar
      const posts = await searchReddit(q, sub);
      for (const p of posts) {
        if (seenIds.has(p.id)) continue;
        const score = scorePost(p);
        if (score < MIN_RELEVANCE) continue;
        candidates.set(p.id, { post: p, score, subreddit: sub });
      }
      // Rate limit respetuoso
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  // Búsqueda global para queries muy específicas (sin restrict_sr)
  for (const q of ['laureles vs poblado', 'medellin where to stay']) {
    const posts = await searchRedditAll(q);
    for (const p of posts) {
      if (seenIds.has(p.id)) continue;
      const score = scorePost(p);
      if (score < MIN_RELEVANCE) continue;
      candidates.set(p.id, { post: p, score, subreddit: p.subreddit });
    }
    await new Promise((res) => setTimeout(res, 1500));
  }

  // Top 3 por score (no saturar al humano con 10 tareas / semana)
  const top = [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 3);

  const created = [];
  for (const { post, subreddit, score } of top) {
    const opp = {
      id: post.id,
      title: post.title,
      author: post.author,
      url: `https://www.reddit.com${post.permalink}`,
      subreddit,
      score: post.score,
      numComments: post.num_comments,
      selftext: post.selftext,
      createdUtc: post.created_utc,
      relevanceScore: score,
      foundAt: new Date().toISOString(),
    };

    // Generar draft custom con Claude (incluye top comments del hilo como contexto)
    try {
      const customResult = await generateCustomDraft({ post: { ...post, subreddit }, subreddit, state, humanFeedback });
      if (customResult) {
        opp.customDraft = customResult.draft;
        opp.draftLang = customResult.lang;
        opp.topCommentsConsidered = customResult.topComments.length;
      }
    } catch (e) {
      console.warn(`Custom draft failed for ${post.id}: ${e.message}`);
    }

    const task = await createOpportunityTask(opp);
    if (task?.id) {
      opp.notionTaskId = task.id;
      created.push(opp);
    }
    history.opportunities.push(opp);
  }

  // Limpiar history >90 días para no inflar
  const cutoff = Date.now() - 90 * 86400000;
  history.opportunities = history.opportunities.filter((o) => new Date(o.foundAt).getTime() > cutoff);
  await saveHistory(history);

  return {
    ok: true,
    stale: created.length === 0,
    summary: `Conversation finder: ${created.length} oportunidades nuevas en Reddit`,
    data: { opportunities: created, candidatesScanned: candidates.size },
    alerts: [],
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await runConversationFinder();
  console.log(JSON.stringify(r, null, 2));
}
