#!/usr/bin/env node
/**
 * Ahrefs research semanal.
 *
 * Consume Ahrefs API v3 (Lite plan, 100K units/mes) para producir:
 *   - Posiciones actuales de las keywords trackadas
 *   - Nuevos backlinks de la semana
 *   - Nuevos dominios referentes
 *   - Oportunidades: keywords donde competidores rankean alto y nosotros no
 *
 * Detecta movimientos vs corrida anterior y devuelve alertas si una posición
 * baja >5 lugares (configurable en state.alerting.positionDropMinPositions).
 *
 * History en data/ahrefs-history.json (versionado).
 *
 * Env: AHREFS_API_TOKEN
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'ahrefs-history.json');
const API_BASE = 'https://api.ahrefs.com/v3';
const TOKEN = process.env.AHREFS_API_TOKEN;
const TARGET = 'casamuseolaureles.com';

const COUNTRY = 'co';     // Colombia (foco SEO local). Para EN podría ser 'us' pero Ahrefs Lite tiene quota; lo dejamos en 'co' para el MVP.

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
};

async function call(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else if (v != null) url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Ahrefs ${endpoint} ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

async function getOverview() {
  // Endpoint correcto: domain-rating
  try {
    const j = await call('site-explorer/domain-rating', {
      target: TARGET,
      date: new Date().toISOString().slice(0, 10),
      mode: 'subdomains',
      protocol: 'both',
    });
    return j.domain_rating || j;
  } catch (e) {
    return { error: e.message };
  }
}

async function getRanksForKeywords(keywords) {
  // Ahrefs endpoint: site-explorer/organic-keywords (devuelve TODAS las keywords del dominio)
  // Field correcto: `volume` (no volume_monthly).
  try {
    const j = await call('site-explorer/organic-keywords', {
      target: TARGET,
      country: COUNTRY,
      mode: 'subdomains',
      protocol: 'both',
      date: new Date().toISOString().slice(0, 10),
      limit: 1000,
      select: 'keyword,best_position,volume,best_position_url',
    });
    const allKws = j.keywords || j.rows || [];
    const out = [];
    for (const target of keywords) {
      const tNorm = target.kw.toLowerCase().trim();
      const found = allKws.find((k) => (k.keyword || '').toLowerCase().trim() === tNorm);
      out.push({
        kw: target.kw,
        lang: target.lang,
        intent: target.intent,
        position: found?.best_position ?? null,
        volume: found?.volume ?? null,
        landingUrl: found?.best_position_url ?? null,
      });
    }
    return out;
  } catch (e) {
    return { error: e.message };
  }
}

async function getNewBacklinks(daysBack = 7) {
  // Sin filtro `where` (Ahrefs es estricto con la sintaxis). Pedimos los más recientes
  // y filtramos en JS por first_seen.
  try {
    const j = await call('site-explorer/all-backlinks', {
      target: TARGET,
      mode: 'subdomains',
      protocol: 'both',
      limit: 50,
      select: 'url_from,domain_rating_source,url_to,anchor,first_seen,is_dofollow',
      order_by: 'first_seen:desc',
    });
    const all = j.backlinks || j.rows || [];
    const cutoff = new Date(Date.now() - daysBack * 86400000);
    return all.filter((b) => {
      if (!b.first_seen) return false;
      return new Date(b.first_seen) >= cutoff;
    });
  } catch (e) {
    return { error: e.message };
  }
}

async function getCompetitorGapKeywords(competitors) {
  // Para MVP: pedimos las top keywords de cada competidor y restamos las nuestras.
  // Es menos elegante que un content-gap nativo pero funciona con Ahrefs Lite.
  if (!competitors?.length) return [];
  try {
    // Get our keywords first
    const ours = await call('site-explorer/organic-keywords', {
      target: TARGET, country: COUNTRY, mode: 'subdomains', protocol: 'both',
      date: new Date().toISOString().slice(0, 10),
      limit: 500, select: 'keyword',
    });
    const ourKws = new Set((ours.keywords || []).map((k) => (k.keyword || '').toLowerCase().trim()));

    const out = [];
    for (const c of competitors.slice(0, 3)) {
      if (!c.domain) continue;
      try {
        const j = await call('site-explorer/organic-keywords', {
          target: c.domain, country: COUNTRY, mode: 'subdomains', protocol: 'both',
          date: new Date().toISOString().slice(0, 10),
          limit: 50, select: 'keyword,best_position,volume',
        });
        for (const k of j.keywords || []) {
          const kw = (k.keyword || '').toLowerCase().trim();
          if (!ourKws.has(kw) && k.best_position && k.best_position <= 20 && k.volume >= 50) {
            out.push({ kw: k.keyword, volume: k.volume, position: k.best_position, competitor: c.name });
          }
        }
      } catch (e) {
        // Si un competidor falla, sigo con los demás
        continue;
      }
    }
    // Dedupe por keyword + ordenar por volume desc
    const seen = new Set();
    return out.filter((g) => {
      if (seen.has(g.kw)) return false;
      seen.add(g.kw); return true;
    }).sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 25);
  } catch (e) {
    return { error: e.message };
  }
}

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { runs: [] }; }
}
async function saveHistory(h) { await fs.writeFile(HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }

function detectPositionAlerts(currRanks, prevRanks, threshold = 5) {
  const alerts = [];
  if (!Array.isArray(currRanks) || !Array.isArray(prevRanks)) return alerts;
  for (const c of currRanks) {
    const p = prevRanks.find((x) => x.kw === c.kw);
    if (!p) continue;
    if (c.position != null && p.position != null && c.position - p.position >= threshold) {
      alerts.push(`"${c.kw}" bajó posición ${p.position} → ${c.position} (-${c.position - p.position})`);
    }
  }
  return alerts;
}

export async function runAhrefs(state) {
  if (!TOKEN) {
    return {
      ok: false, stale: true,
      summary: 'Ahrefs: sin AHREFS_API_TOKEN — skipped',
      data: null, alerts: [],
    };
  }
  const alerts = [];
  const overview = await getOverview();
  const ranks = await getRanksForKeywords(state.keywordsToTrack || []);
  const newBacklinks = await getNewBacklinks(7);
  const gapKeywords = await getCompetitorGapKeywords(state.competitors || []);

  const history = await loadHistory();
  const prevRanks = history.runs.length ? history.runs[history.runs.length - 1].ranks : [];
  if (Array.isArray(ranks)) {
    alerts.push(...detectPositionAlerts(ranks, prevRanks, state.alerting?.positionDropMinPositions || 5));
  }

  history.runs.push({
    ts: new Date().toISOString(),
    overview,
    ranks: Array.isArray(ranks) ? ranks : [],
    newBacklinksCount: Array.isArray(newBacklinks) ? newBacklinks.length : 0,
    gapKeywordsCount: Array.isArray(gapKeywords) ? gapKeywords.length : 0,
  });
  if (history.runs.length > 26) history.runs = history.runs.slice(-26);
  await saveHistory(history);

  const trackedCount = state.keywordsToTrack?.length || 0;
  const ranking = Array.isArray(ranks) ? ranks.filter((r) => r.position != null).length : 0;

  return {
    ok: true,
    stale: false,
    data: { overview, ranks, newBacklinks, gapKeywords },
    summary: `Ahrefs: ${ranking}/${trackedCount} keywords rankeando · ${Array.isArray(newBacklinks) ? newBacklinks.length : 0} backlinks nuevos · ${Array.isArray(gapKeywords) ? gapKeywords.length : 0} oportunidades gap`,
    alerts,
  };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  const r = await runAhrefs(state);
  console.log(JSON.stringify(r, null, 2));
}
