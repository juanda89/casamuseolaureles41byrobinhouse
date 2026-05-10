#!/usr/bin/env node
/**
 * Notion feedback tracker — Casa Museo Laureles.
 *
 * Detecta cambios de status en tareas del kanban de Notion. Para las tareas
 * que cambiaron, extrae comentarios, descripción y adjuntos, y los append a
 * data/human-feedback-log.md. Mantiene snapshot en data/notion-state-snapshot.json.
 *
 * Diseñado para correr diariamente (vía cron de GitHub Actions o local).
 *
 * Env vars requeridas:
 *   NOTION_TOKEN, NOTION_DB_ID
 *
 * Args:
 *   --dry-run   : log a stdout, no escribe archivos
 *   --baseline  : snapshot inicial sin escribir log (primera corrida)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FLAGS = {
  dryRun: process.argv.includes('--dry-run'),
  baseline: process.argv.includes('--baseline'),
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'notion-state-snapshot.json');
const LOG_PATH = path.join(ROOT, 'data', 'human-feedback-log.md');

const NOTION_VERSION = '2022-06-28';
const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!TOKEN || !DB_ID) {
  console.error('Missing NOTION_TOKEN or NOTION_DB_ID env vars');
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

// ─────────────────────────────────────────────────────────────────
// Notion API helpers
// ─────────────────────────────────────────────────────────────────

async function listAllPages() {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Notion query failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    pages.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return pages;
}

async function getPageBlocks(pageId) {
  const blocks = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return [];
    const j = await r.json();
    blocks.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return blocks;
}

async function getPageComments(pageId) {
  const comments = [];
  let cursor;
  do {
    const url = new URL('https://api.notion.com/v1/comments');
    url.searchParams.set('block_id', pageId);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return [];
    const j = await r.json();
    comments.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return comments;
}

// ─────────────────────────────────────────────────────────────────
// Snapshot model
// ─────────────────────────────────────────────────────────────────

function selectVal(prop) {
  return prop?.select?.name || prop?.status?.name || null;
}

function titleVal(prop) {
  const arr = prop?.title || [];
  return arr.map((t) => t.plain_text).join('').trim() || '(sin título)';
}

function richTextVal(prop) {
  const arr = prop?.rich_text || [];
  return arr.map((t) => t.plain_text).join('').trim();
}

function buildSnapshotEntry(page) {
  const props = page.properties || {};
  return {
    id: page.id,
    url: page.url,
    title: titleVal(props.Title),
    status: selectVal(props.Status),
    priority: selectVal(props.Priority),
    type: selectVal(props.Type),
    createdBy: selectVal(props['Created by']),
    forUseIn: richTextVal(props['For use in']),
    acceptanceCriteria: richTextVal(props['Acceptance criteria']),
    lastEditedTime: page.last_edited_time,
  };
}

async function loadSnapshot() {
  try {
    return JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return { generatedAt: null, tasks: {} };
  }
}

async function saveSnapshot(snapshot) {
  if (FLAGS.dryRun) {
    console.log('[dry-run] would write snapshot with', Object.keys(snapshot.tasks).length, 'tasks');
    return;
  }
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');
}

// ─────────────────────────────────────────────────────────────────
// Block / attachment extraction
// ─────────────────────────────────────────────────────────────────

const TEXT_BLOCK_TYPES = new Set([
  'paragraph', 'heading_1', 'heading_2', 'heading_3',
  'bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'quote', 'callout',
]);
const FILE_BLOCK_TYPES = new Set(['file', 'image', 'pdf', 'video', 'audio']);

function extractText(block) {
  const data = block[block.type];
  if (!data?.rich_text) return '';
  return data.rich_text.map((t) => t.plain_text).join('').trim();
}

function extractFile(block) {
  const data = block[block.type];
  if (!data) return null;
  const url = data.file?.url || data.external?.url || null;
  if (!url) return null;
  const caption = (data.caption || []).map((t) => t.plain_text).join('').trim();
  return { type: block.type, url, caption };
}

function summarizeBlocks(blocks) {
  const text = [];
  const files = [];
  for (const b of blocks) {
    if (TEXT_BLOCK_TYPES.has(b.type)) {
      const t = extractText(b);
      if (t) text.push(t);
    } else if (FILE_BLOCK_TYPES.has(b.type)) {
      const f = extractFile(b);
      if (f) files.push(f);
    }
  }
  return { text: text.join('\n'), files };
}

function summarizeComments(comments) {
  return comments.map((c) => ({
    author: c.created_by?.name || c.created_by?.id || 'unknown',
    createdAt: c.created_time,
    text: (c.rich_text || []).map((t) => t.plain_text).join('').trim(),
  })).filter((c) => c.text);
}

// ─────────────────────────────────────────────────────────────────
// Diff & log
// ─────────────────────────────────────────────────────────────────

function detectChanges(prev, curr) {
  const changes = [];
  for (const id of Object.keys(curr)) {
    const c = curr[id];
    const p = prev[id];
    if (!p) {
      changes.push({ kind: 'new', task: c, prevStatus: null });
      continue;
    }
    if (p.status !== c.status) {
      changes.push({ kind: 'status_change', task: c, prevStatus: p.status });
      continue;
    }
    if (p.lastEditedTime !== c.lastEditedTime) {
      // Edición sin cambio de status — la registramos solo si está en Review/In progress
      if (['Review', 'In progress'].includes(c.status)) {
        changes.push({ kind: 'edit', task: c, prevStatus: p.status });
      }
    }
  }
  return changes;
}

function bogotaTimestamp() {
  // Bogotá = UTC-5 sin DST.
  const now = new Date(Date.now() - 5 * 3600 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function renderEntry(change, comments, blocks) {
  const ts = bogotaTimestamp();
  const { task, prevStatus, kind } = change;
  const lines = [];
  lines.push(`### ${ts} · ${task.title}`);
  lines.push(`- **Notion task:** [${task.id.slice(-8)}](${task.url})`);
  lines.push(`- **Tipo:** ${task.type || '—'} · **Prioridad:** ${task.priority || '—'} · **Created by:** ${task.createdBy || '—'}`);

  if (kind === 'new') {
    lines.push(`- **Cambio:** tarea nueva detectada (status inicial: \`${task.status}\`)`);
  } else if (kind === 'status_change') {
    lines.push(`- **Cambio de status:** \`${prevStatus || '(none)'}\` → \`${task.status}\``);
  } else {
    lines.push(`- **Cambio:** edición sin cambio de status (status: \`${task.status}\`)`);
  }

  if (comments.length) {
    lines.push('');
    lines.push('**Comentarios nuevos:**');
    for (const c of comments) {
      lines.push(`> _${c.author} · ${c.createdAt}_`);
      lines.push(`> ${c.text.split('\n').join('\n> ')}`);
      lines.push('');
    }
  }

  if (blocks.text) {
    lines.push('');
    lines.push('**Descripción / body:**');
    lines.push('```');
    lines.push(blocks.text);
    lines.push('```');
  }

  if (blocks.files.length) {
    lines.push('');
    lines.push('**Archivos adjuntos:**');
    for (const f of blocks.files) {
      const cap = f.caption ? ` — ${f.caption}` : '';
      lines.push(`- \`${f.type}\` [link](${f.url})${cap}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

async function appendLog(text) {
  if (FLAGS.dryRun) {
    console.log('[dry-run] would append to log:\n' + text);
    return;
  }
  // Append antes de la sección "Insights consolidados" si existe; si no, al final.
  const existing = await fs.readFile(LOG_PATH, 'utf8');
  const marker = '## Insights consolidados';
  let updated;
  if (existing.includes(marker)) {
    const [head, tail] = existing.split(marker);
    const trimmedHead = head.replace(/_\(Vacío[^\n]*\)_\s*\n+/, '');
    updated = `${trimmedHead.trimEnd()}\n\n${text}\n${marker}${tail}`;
  } else {
    updated = existing + '\n' + text;
  }
  await fs.writeFile(LOG_PATH, updated);
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[notion-feedback-tracker] start · ${FLAGS.dryRun ? 'DRY-RUN' : 'live'}${FLAGS.baseline ? ' · BASELINE' : ''}`);

  const pages = await listAllPages();
  console.log(`  fetched ${pages.length} pages from Notion`);

  const currSnapshot = { generatedAt: new Date().toISOString(), tasks: {} };
  for (const p of pages) {
    const e = buildSnapshotEntry(p);
    currSnapshot.tasks[e.id] = e;
  }

  if (FLAGS.baseline) {
    await saveSnapshot(currSnapshot);
    console.log(`  baseline saved with ${Object.keys(currSnapshot.tasks).length} tasks (no log written)`);
    return;
  }

  const prev = await loadSnapshot();
  const changes = detectChanges(prev.tasks || {}, currSnapshot.tasks);
  console.log(`  detected ${changes.length} changes vs previous snapshot`);

  let logged = 0;
  for (const change of changes) {
    const [comments, blocks] = await Promise.all([
      getPageComments(change.task.id),
      getPageBlocks(change.task.id).then(summarizeBlocks),
    ]);
    const summarizedComments = summarizeComments(comments);

    // Solo loggeamos si hay material humano (comments, body o adjuntos), o si es cambio de status relevante.
    const hasHumanContent = summarizedComments.length || blocks.text || blocks.files.length;
    const isRelevantStatusChange = change.kind === 'status_change' && ['Review', 'Done', 'Discarted', 'Blocked'].includes(change.task.status);

    if (!hasHumanContent && !isRelevantStatusChange) continue;

    const entry = renderEntry(change, summarizedComments, blocks);
    await appendLog(entry);
    logged++;
    console.log(`  logged: ${change.task.title.slice(0, 60)} (${change.kind})`);
  }

  await saveSnapshot(currSnapshot);
  console.log(`[notion-feedback-tracker] done · ${logged} entries appended`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
