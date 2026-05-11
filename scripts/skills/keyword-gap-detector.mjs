#!/usr/bin/env node
/**
 * Keyword gap detector.
 *
 * Cruza datos de GSC + Ahrefs para detectar OPORTUNIDADES accionables:
 *   1. CTR-gap: queries con >50 impresiones y CTR <2% (mejora meta o copy)
 *   2. Edge-of-page-1: queries en posiciones 11-20 (un push las pasa a P10)
 *   3. Content-gap: keywords donde competidores rankean y nosotros no (de Ahrefs)
 *   4. Cannibalization: 2+ URLs propias compitiendo por la misma query
 *
 * Output: lista de gaps con acción sugerida (refresh, optimize-meta, create, consolidate).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'sc-domain:casamuseolaureles.com';

async function gscQueryWithPage(token) {
  // Pedimos dimensiones query+page para detectar canibalización
  const end = new Date();
  const start = new Date(end.getTime() - 28 * 86400000);
  const r = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        dimensions: ['query', 'page'],
        rowLimit: 5000,
      }),
    }
  );
  if (!r.ok) throw new Error(`GSC query+page failed: ${r.status}`);
  const j = await r.json();
  return j.rows || [];
}

function detectCtrGap(rows) {
  // Aggregate per query (CTR weighted by impressions)
  const byQuery = {};
  for (const r of rows) {
    const q = r.keys[0];
    byQuery[q] = byQuery[q] || { impressions: 0, clicks: 0, position: r.position, pages: new Set() };
    byQuery[q].impressions += r.impressions;
    byQuery[q].clicks += r.clicks;
    byQuery[q].pages.add(r.keys[1]);
  }
  const gaps = [];
  for (const [q, d] of Object.entries(byQuery)) {
    if (d.impressions < 50) continue;
    const ctr = d.clicks / d.impressions;
    if (ctr < 0.02 && d.position <= 20) {
      gaps.push({
        type: 'ctr_gap',
        query: q,
        impressions: d.impressions,
        clicks: d.clicks,
        ctr: ctr,
        position: d.position,
        action: 'optimize-meta',
        rationale: `${d.impressions} imp + CTR ${(ctr*100).toFixed(1)}% en pos ${d.position.toFixed(1)}. Meta description o title no convence — reescribir.`,
      });
    }
  }
  return gaps;
}

function detectEdgeOfPage1(rows) {
  const byQuery = {};
  for (const r of rows) {
    const q = r.keys[0];
    byQuery[q] = byQuery[q] || { impressions: 0, position: r.position, page: r.keys[1] };
    byQuery[q].impressions += r.impressions;
  }
  return Object.entries(byQuery)
    .filter(([_, d]) => d.position >= 11 && d.position <= 20 && d.impressions >= 30)
    .map(([q, d]) => ({
      type: 'edge_of_page_1',
      query: q,
      position: d.position,
      impressions: d.impressions,
      page: d.page,
      action: 'refresh',
      rationale: `Pos ${d.position.toFixed(1)} con ${d.impressions} imp en 28d. Push moderado (refresh + 1-2 backlinks) la puede pasar a top 10.`,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

function detectCannibalization(rows) {
  const byQuery = {};
  for (const r of rows) {
    const q = r.keys[0];
    byQuery[q] = byQuery[q] || { pages: new Map() };
    const p = byQuery[q].pages.get(r.keys[1]) || { impressions: 0, clicks: 0, position: r.position };
    p.impressions += r.impressions;
    p.clicks += r.clicks;
    byQuery[q].pages.set(r.keys[1], p);
  }
  const gaps = [];
  for (const [q, d] of Object.entries(byQuery)) {
    if (d.pages.size < 2) continue;
    const pages = [...d.pages.entries()].sort((a, b) => b[1].impressions - a[1].impressions);
    // Cannibalization "real" = top 2 páginas tienen impressions >= 10 cada una
    if (pages[0][1].impressions >= 10 && pages[1][1].impressions >= 10) {
      gaps.push({
        type: 'cannibalization',
        query: q,
        pages: pages.slice(0, 3).map(([url, m]) => ({ url, impressions: m.impressions, clicks: m.clicks, position: m.position })),
        action: 'consolidate',
        rationale: `${pages.length} URLs propias rotando por esta query. Consolidar contenido en la URL con más backlinks; redirect 301 la otra.`,
      });
    }
  }
  return gaps;
}

function detectContentGap(ahrefsGap) {
  if (!Array.isArray(ahrefsGap)) return [];
  return ahrefsGap.slice(0, 10).map((g) => ({
    type: 'content_gap',
    query: g.kw,
    volume: g.volume,
    kd: g.kd,
    trafficPotential: g.potential,
    action: 'create-content',
    rationale: `Competidores rankean acá, nosotros no. Vol ${g.volume || '?'}/mes · KD ${g.kd ?? '?'}.`,
  }));
}

export async function runGapDetector(state, gscToken, ahrefsResult) {
  if (!gscToken) {
    return {
      ok: false, stale: true,
      summary: 'Gap detector: sin token GSC',
      data: { gaps: [] }, alerts: [],
    };
  }
  const rows = await gscQueryWithPage(gscToken).catch((e) => { throw e; });
  const ctrGaps = detectCtrGap(rows);
  const edgeP1Gaps = detectEdgeOfPage1(rows);
  const cannibal = detectCannibalization(rows);
  const contentGap = detectContentGap(ahrefsResult?.data?.gapKeywords || []);

  const all = [...ctrGaps, ...edgeP1Gaps, ...cannibal, ...contentGap];

  return {
    ok: true,
    stale: false,
    summary: `Gap detector: ${ctrGaps.length} ctr-gaps · ${edgeP1Gaps.length} edge-p1 · ${cannibal.length} canibalizaciones · ${contentGap.length} content-gaps`,
    data: { gaps: all, ctrGaps, edgeP1Gaps, cannibal, contentGap },
    alerts: cannibal.length ? cannibal.map((c) => `Canibalización detectada en "${c.query}"`) : [],
  };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  // Required Google auth
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const token = (await r.json()).access_token;
  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  const result = await runGapDetector(state, token, null);
  console.log(JSON.stringify(result, null, 2));
}
