#!/usr/bin/env node
/**
 * Lighthouse audit semanal vía PageSpeed Insights API (Google, gratis, sin auth).
 *
 * Mide Performance / Accessibility / Best Practices / SEO + Core Web Vitals
 * de las URLs core. Compara contra la corrida anterior y devuelve alerts si
 * algo bajó del threshold definido en agent-state.alerting.
 *
 * Uso desde weekly-agent.mjs:
 *   import { runLighthouse } from './skills/lighthouse-audit.mjs';
 *   const lh = await runLighthouse(state);
 *
 * History en data/lighthouse-history.json (versionado).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'lighthouse-history.json');
const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// PSI permite key opcional. Sin key: ~25 req/día por IP (suficiente para nosotros).
// Si se setea PSI_API_KEY se usa, más limit.
const KEY = process.env.PSI_API_KEY;

const URLS_TO_AUDIT = [
  'https://casamuseolaureles.com/es',
  'https://casamuseolaureles.com/en',
];
const STRATEGIES = ['mobile', 'desktop'];

async function auditOne(url, strategy) {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
  });
  // Lighthouse API admite múltiples ?category=X — los añadimos manualmente:
  let qs = params.toString();
  qs += '&category=accessibility&category=best-practices&category=seo';
  if (KEY) qs += `&key=${KEY}`;

  const r = await fetch(`${API_BASE}?${qs}`, { method: 'GET' });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`PSI ${r.status} for ${url}/${strategy}: ${txt.slice(0, 200)}`);
  }
  const j = await r.json();
  const cats = j.lighthouseResult?.categories || {};
  const audits = j.lighthouseResult?.audits || {};
  return {
    url,
    strategy,
    fetched_at: new Date().toISOString(),
    performance:    Math.round((cats.performance?.score || 0) * 100),
    accessibility:  Math.round((cats.accessibility?.score || 0) * 100),
    bestPractices:  Math.round((cats['best-practices']?.score || 0) * 100),
    seo:            Math.round((cats.seo?.score || 0) * 100),
    lcp:  audits['largest-contentful-paint']?.numericValue ?? null,  // ms
    cls:  audits['cumulative-layout-shift']?.numericValue ?? null,   // unitless
    inp:  audits['interaction-to-next-paint']?.numericValue ?? null, // ms
    tbt:  audits['total-blocking-time']?.numericValue ?? null,       // ms
    fcp:  audits['first-contentful-paint']?.numericValue ?? null,    // ms
  };
}

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { runs: [] }; }
}

async function saveHistory(history) {
  await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
}

function findPrevious(history, url, strategy) {
  for (let i = history.runs.length - 1; i >= 0; i--) {
    const found = history.runs[i].audits?.find((a) => a.url === url && a.strategy === strategy);
    if (found) return found;
  }
  return null;
}

function detectAlerts(curr, prev, thresholds) {
  const alerts = [];
  if (curr.performance   < thresholds.lighthousePerformanceMin)   alerts.push(`Performance ${curr.performance}/${thresholds.lighthousePerformanceMin} en ${curr.url} (${curr.strategy})`);
  if (curr.accessibility < thresholds.lighthouseAccessibilityMin) alerts.push(`Accessibility ${curr.accessibility}/${thresholds.lighthouseAccessibilityMin} en ${curr.url} (${curr.strategy})`);
  if (curr.seo           < thresholds.lighthouseSEOMin)           alerts.push(`SEO score ${curr.seo}/${thresholds.lighthouseSEOMin} en ${curr.url} (${curr.strategy})`);
  if (curr.lcp != null && curr.lcp / 1000 > thresholds.cwvLcpMaxSec) alerts.push(`LCP ${(curr.lcp/1000).toFixed(2)}s > ${thresholds.cwvLcpMaxSec}s en ${curr.url} (${curr.strategy})`);
  if (curr.cls != null && curr.cls > thresholds.cwvClsMax)           alerts.push(`CLS ${curr.cls.toFixed(3)} > ${thresholds.cwvClsMax} en ${curr.url} (${curr.strategy})`);
  if (curr.inp != null && curr.inp > thresholds.cwvInpMaxMs)         alerts.push(`INP ${Math.round(curr.inp)}ms > ${thresholds.cwvInpMaxMs}ms en ${curr.url} (${curr.strategy})`);

  // Regresión >5 puntos vs corrida anterior
  if (prev) {
    if (prev.performance - curr.performance >= 5) alerts.push(`Performance bajó ${prev.performance}→${curr.performance} en ${curr.url} (${curr.strategy})`);
    if (prev.seo - curr.seo >= 5)                 alerts.push(`SEO score bajó ${prev.seo}→${curr.seo} en ${curr.url} (${curr.strategy})`);
  }
  return alerts;
}

export async function runLighthouse(state) {
  const thresholds = state.alerting || {};
  const audits = [];
  const alerts = [];

  for (const url of URLS_TO_AUDIT) {
    for (const strat of STRATEGIES) {
      try {
        const a = await auditOne(url, strat);
        audits.push(a);
      } catch (e) {
        alerts.push(`Lighthouse falló para ${url} (${strat}): ${e.message}`);
      }
    }
  }

  const history = await loadHistory();
  for (const a of audits) {
    const prev = findPrevious(history, a.url, a.strategy);
    alerts.push(...detectAlerts(a, prev, thresholds));
  }

  history.runs.push({ ts: new Date().toISOString(), audits });
  // Mantener solo últimas 26 corridas (~6 meses)
  if (history.runs.length > 26) history.runs = history.runs.slice(-26);
  await saveHistory(history);

  const avgPerf = audits.length
    ? Math.round(audits.reduce((s, a) => s + a.performance, 0) / audits.length)
    : null;

  return {
    ok: audits.length > 0,
    stale: false,
    data: { audits, history_runs: history.runs.length },
    summary: avgPerf != null
      ? `Lighthouse promedio: Performance ${avgPerf}/100 · ${audits.length} audits (${alerts.length} alertas)`
      : 'Lighthouse: sin datos disponibles',
    alerts,
  };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  const r = await runLighthouse(state);
  console.log(JSON.stringify(r, null, 2));
}
