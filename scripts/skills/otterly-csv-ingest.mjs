#!/usr/bin/env node
/**
 * Otterly CSV ingest.
 *
 * Otterly.AI no tiene API pública. Cada lunes JD descarga el reporte CSV y
 * lo guarda en data/otterly/YYYY-MM-DD.csv. Este skill:
 *   1. Detecta el CSV más reciente
 *   2. Lo parsea (parser flexible, detecta columnas por nombre fuzzy)
 *   3. Consolida histórico en data/llm-citations-history.json
 *   4. Compara vs semana anterior, devuelve insights al weekly-agent
 *
 * Si no hay CSV nuevo desde la última ejecución → stale=true, el reporte semanal
 * lo marca como "datos no actualizados" y sigue.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FOLDER = path.join(ROOT, 'data', 'otterly');
const HISTORY_PATH = path.join(ROOT, 'data', 'llm-citations-history.json');
const TARGET_DOMAIN = 'casamuseolaureles.com';

// Mapeo flexible: matchea por substring sin importar mayúsculas/idioma.
const COLUMN_MAP = {
  prompt:        ['prompt', 'query', 'question', 'consulta'],
  engine:        ['engine', 'llm', 'model', 'platform', 'motor'],
  citedDomains:  ['cited_domains', 'sources', 'cited', 'urls', 'dominios'],
  citedUrls:     ['cited_urls', 'urls_cited', 'source_urls'],
  ourPosition:   ['our_position', 'position', 'rank'],
  ourCited:      ['casa_museo_cited', 'we_cited', 'target_cited', 'cited'],
  date:          ['date', 'timestamp', 'fetched_at', 'fecha'],
};

function findHeader(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

// CSV parser básico — maneja comas dentro de comillas
function parseCSV(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length);
  const rows = [];
  for (const line of lines) {
    const cells = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur);
    rows.push(cells.map((x) => x.trim()));
  }
  return rows;
}

async function findLatestCSV() {
  try {
    const files = await fs.readdir(FOLDER);
    const csvs = files.filter((f) => /\.csv$/i.test(f)).sort().reverse();
    if (!csvs.length) return null;
    return { name: csvs[0], path: path.join(FOLDER, csvs[0]) };
  } catch {
    return null;
  }
}

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { ingested: [], runs: [] }; }
}
async function saveHistory(h) { await fs.writeFile(HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }

function normalizeRow(row, headerMap) {
  const get = (k) => headerMap[k] >= 0 ? row[headerMap[k]] : null;
  const citedRaw = get('citedDomains') || get('citedUrls') || '';
  // Otterly often delimits with ; | or newline; tolerate all
  const citedList = citedRaw.split(/[;|\n]/).map((s) => s.trim()).filter(Boolean);
  const weCited = citedList.some((c) => c.toLowerCase().includes(TARGET_DOMAIN));
  return {
    prompt: get('prompt') || '',
    engine: (get('engine') || '').toLowerCase(),
    citedList,
    ourCited: weCited || (get('ourCited') || '').toLowerCase().startsWith('y'),
    ourPosition: Number(get('ourPosition')) || null,
    date: get('date') || null,
  };
}

function summarize(rows) {
  const byEngine = {};
  for (const r of rows) {
    const eng = r.engine || 'unknown';
    byEngine[eng] = byEngine[eng] || { total: 0, cited: 0, queries: [] };
    byEngine[eng].total++;
    if (r.ourCited) byEngine[eng].cited++;
    byEngine[eng].queries.push({ prompt: r.prompt, ourCited: r.ourCited });
  }
  return byEngine;
}

export async function runOtterly(state) {
  const latest = await findLatestCSV();
  const history = await loadHistory();

  if (!latest) {
    return {
      ok: true, stale: true,
      summary: 'Otterly: sin CSV cargado todavía. JD debe subir uno a data/otterly/.',
      data: { byEngine: {}, latestCsv: null },
      alerts: [],
    };
  }

  // Si este CSV ya fue ingestado en una corrida anterior, marcar stale
  const alreadyIngested = history.ingested.some((i) => i.file === latest.name);
  if (alreadyIngested) {
    const lastRun = history.runs[history.runs.length - 1];
    return {
      ok: true, stale: true,
      summary: `Otterly: último CSV (${latest.name}) ya ingestado en corrida anterior. Subir CSV nuevo cada semana.`,
      data: { byEngine: lastRun?.byEngine || {}, latestCsv: latest.name },
      alerts: [`Otterly CSV stale: ${latest.name} no se ha actualizado.`],
    };
  }

  const raw = await fs.readFile(latest.path, 'utf8');
  const parsed = parseCSV(raw);
  if (parsed.length < 2) {
    return {
      ok: false, stale: false,
      summary: `Otterly: CSV ${latest.name} parece vacío o malformado.`,
      data: null,
      alerts: [`Otterly CSV ${latest.name} sin filas de datos.`],
    };
  }

  const headers = parsed[0];
  const headerMap = {};
  for (const k of Object.keys(COLUMN_MAP)) {
    headerMap[k] = findHeader(headers, COLUMN_MAP[k]);
  }
  const dataRows = parsed.slice(1).map((r) => normalizeRow(r, headerMap));
  const byEngine = summarize(dataRows);

  history.ingested.push({
    file: latest.name,
    ts: new Date().toISOString(),
    rowsIngested: dataRows.length,
  });
  history.runs.push({
    ts: new Date().toISOString(),
    csvFile: latest.name,
    rowsTotal: dataRows.length,
    byEngine,
  });
  if (history.runs.length > 52) history.runs = history.runs.slice(-52);
  await saveHistory(history);

  const totalCited = Object.values(byEngine).reduce((s, e) => s + e.cited, 0);
  const totalQueries = Object.values(byEngine).reduce((s, e) => s + e.total, 0);

  // Diff vs corrida anterior
  const prev = history.runs.length >= 2 ? history.runs[history.runs.length - 2] : null;
  const alerts = [];
  if (prev) {
    for (const [eng, curr] of Object.entries(byEngine)) {
      const pe = prev.byEngine?.[eng];
      if (pe && curr.cited < pe.cited) {
        alerts.push(`${eng}: citaciones bajaron ${pe.cited} → ${curr.cited}`);
      }
    }
  }

  return {
    ok: true, stale: false,
    summary: `Otterly: ${totalCited}/${totalQueries} citas en LLMs · ${Object.keys(byEngine).length} motores trackeados`,
    data: { byEngine, latestCsv: latest.name, rowsTotal: dataRows.length },
    alerts,
  };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  const r = await runOtterly(state);
  console.log(JSON.stringify(r, null, 2));
}
