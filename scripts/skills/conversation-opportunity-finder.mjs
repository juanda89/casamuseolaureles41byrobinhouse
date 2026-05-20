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

function scorePost(post) {
  const title = (post.title || '').toLowerCase();
  const selftext = (post.selftext || '').toLowerCase();
  const combined = title + ' ' + selftext;

  let score = 0;

  // Términos de hospedaje directo
  if (/where to stay|donde quedarse|donde dormir|hospedaje|alojamiento/i.test(combined)) score += 3;
  // Mención específica Medellín
  if (/medell[ií]n/i.test(combined)) score += 2;
  // Mención de barrios
  if (/laureles|poblado|envigado/i.test(combined)) score += 2;
  // Preguntas específicas (alta intención de respuesta)
  if (/recommend|sugger|where should|donde puedo|safe|seguro/i.test(combined)) score += 2;
  // Engagement
  if ((post.score || 0) > 10) score += 1;
  if ((post.num_comments || 0) > 5) score += 1;

  // Filtros negativos
  if (post.locked || post.archived) return 0;
  if ((post.score || 0) < 0) return 0;

  return score;
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
  const draftResponse = suggestResponse(opp);

  const acceptance = `📍 Oportunidad de mención orgánica en Reddit (NO automatizada — respondé desde tu cuenta personal).

**Hilo:** ${opp.url}
**Subreddit:** r/${opp.subreddit}
**Título:** ${opp.title}
**Edad:** ${ageDays} días · ${opp.score} upvotes · ${opp.numComments} comentarios

**Contexto del post:**
${(opp.selftext || '(sin texto)').slice(0, 500)}

**Draft de respuesta sugerida (editá antes de publicar):**
${draftResponse}

⚠️ REGLAS para responder:
1. Usá tu cuenta personal de Reddit, no una creada para esto.
2. Sé honesto: identificate como dueño/equipo si vas a mencionar Casa Museo.
3. APORTÁ VALOR primero — datos, recomendaciones útiles, opiniones honestas. La mención del proyecto es secundaria.
4. Mencioná Casa Museo solo si encaja naturalmente (ej: "yo opero un proyecto boutique en Laureles, opinión sesgada pero...").
5. Si el thread tiene >7 días o ya tiene muchas respuestas, salteá — el ROI baja mucho.
6. NO copies el draft tal cual — adaptalo al tono del subreddit.`;

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

function suggestResponse(opp) {
  const title = (opp.title || '').toLowerCase();
  if (title.includes('laureles') && title.includes('poblado')) {
    return `Soy parte de un proyecto boutique en Laureles, opinión sesgada pero intentando dar datos:

- **Laureles** es más residencial/auténtico, ~40% más económico, más caminable. Sin Parque Lleras pero con La 70 cerca para vida nocturna.
- **Poblado** es el hub turístico internacional. Más caro, más fácil en inglés, más opciones gastronómicas premium.
- Para parejas o nómadas que quieren vivir Medellín "real": Laureles.
- Para visita corta + vida nocturna intensa + comodidad turística: Poblado.

¿Tipo de viaje + presupuesto? Puedo dar recomendaciones más específicas.`;
  }
  if (title.includes('safe') || title.includes('seguro')) {
    return `Vivo y opero en Laureles, te puedo dar contexto real:

- En zonas turísticas (Poblado, Laureles, Envigado) durante el día y noche temprana es seguro como cualquier capital LATAM.
- Después de 11pm: usar Uber/DiDi siempre, no caminar zonas oscuras.
- Evitar mostrar celular en la calle al detalle, especialmente en cruces concurridos.
- "No dar papaya" es la regla local. Eso significa: no exhibir valor.
- Estadísticas oficiales en medellin.gov.co/secretaria-seguridad si querés datos por comuna.

¿Tenés algún plan específico que te genere duda?`;
  }
  if (title.includes('nomad') || title.includes('remote')) {
    return `Para nómadas digitales recomiendo Laureles sobre Poblado por:
- Wifi reliable ~200 Mbps en cafés (Pergamino, Café Velvet, Ritual)
- Costo de vida ~30% menos que Poblado
- Comunidad más mixta (no solo expats)
- Caminable, sin la fatiga turística de Provenza
- Cerca del metro (estación Estadio) si necesitás moverte

¿Cuánto tiempo + presupuesto mensual?`;
  }
  return `Sugerencia: respondé con datos específicos (precios, distancias, tu experiencia personal). Mencioná Casa Museo Laureles solo si encaja naturalmente en el thread. Aportá valor primero.`;
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

export async function runConversationFinder() {
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
        if (score < 4) continue;
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
      if (score < 4) continue;
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
      url: `https://www.reddit.com${post.permalink}`,
      subreddit,
      score: post.score,
      numComments: post.num_comments,
      selftext: post.selftext,
      createdUtc: post.created_utc,
      relevanceScore: score,
      foundAt: new Date().toISOString(),
    };
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
