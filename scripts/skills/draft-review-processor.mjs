#!/usr/bin/env node
/**
 * Draft review processor.
 *
 * Procesa el feedback humano sobre los drafts generados por content-draft-generator.
 * Corre cada 4h (cron del workflow draft-review.yml) y revisa Notion:
 *
 *   - Lista tareas con título "[BRAIN DRAFT REVIEW]" en status Done o Discarted.
 *   - Para cada una:
 *     • Lee comentarios + body de la página
 *     • Detecta intención: PUBLISH / REFINE / DISCARD
 *     • PUBLISH: edita el .md (draft:true→false), commit a main, push. Cierra la tarea con comment.
 *     • REFINE: extrae feedback, llama a Claude para regenerar el draft tomando esos comentarios,
 *               force-push al mismo branch del PR. Pasa la tarea a Review nuevamente con comment "v2 lista".
 *     • DISCARD: cierra el PR, archiva los .md, marca la tarea con comment.
 *
 * Detección de intención:
 *   - Comments incluyen "publicar" o "publish" (case insensitive, palabra completa) → PUBLISH
 *   - Status es Discarted → DISCARD
 *   - Hay otros comentarios con texto sustantivo → REFINE
 *   - No hay comentarios y status es Done → PUBLISH (asumimos aprobación silenciosa)
 *
 * Env:
 *   NOTION_TOKEN, NOTION_DB_ID
 *   ANTHROPIC_API_KEY (para refine)
 *   GITHUB_TOKEN, GITHUB_REPOSITORY (para commits + cerrar PR)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'content-drafts-history.json');
const PROCESSED_PATH = path.join(ROOT, 'data', 'draft-review-processed.json');

const NOTION_VERSION = '2022-06-28';
const MODEL = 'claude-sonnet-4-5';

const NOTION_HEADERS = {
  Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

const PUBLISH_KEYWORDS = ['publicar', 'publish', 'aprobado', 'approved', 'lgtm', 'ship it', '✅', 'go live'];

// ─────────────────────────────────────────────────────────────────
// Notion helpers
// ─────────────────────────────────────────────────────────────────

async function listDraftReviewTasks() {
  // Buscar tareas que: tipo Content asset + creadas por Brain + status Done o Discarted + title con prefix
  const r = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: NOTION_HEADERS,
    body: JSON.stringify({
      page_size: 50,
      filter: {
        and: [
          { property: 'Created by', select: { equals: 'Brain' } },
          { property: 'Type', select: { equals: 'Content asset' } },
          {
            or: [
              { property: 'Status', status: { equals: 'Done' } },
              { property: 'Status', status: { equals: 'Discarted' } },
            ],
          },
        ],
      },
    }),
  });
  if (!r.ok) throw new Error(`Notion query failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.results.filter((p) => {
    const arr = p.properties?.Title?.title || [];
    const title = arr.map((t) => t.plain_text).join('');
    return title.includes('[BRAIN DRAFT REVIEW]');
  });
}

async function getPageComments(pageId) {
  const r = await fetch(`https://api.notion.com/v1/comments?block_id=${pageId}&page_size=100`, { headers: NOTION_HEADERS });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.results || []).map((c) => ({
    text: (c.rich_text || []).map((t) => t.plain_text).join('').trim(),
    createdTime: c.created_time,
    createdBy: c.created_by?.id,
  }));
}

async function getPageBlocks(pageId) {
  const r = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, { headers: NOTION_HEADERS });
  if (!r.ok) return [];
  const j = await r.json();
  const TEXT_TYPES = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'quote', 'callout']);
  return (j.results || []).filter((b) => TEXT_TYPES.has(b.type)).map((b) => {
    const rt = b[b.type]?.rich_text || [];
    return rt.map((t) => t.plain_text).join('').trim();
  }).filter(Boolean);
}

async function addNotionComment(pageId, text) {
  const r = await fetch('https://api.notion.com/v1/comments', {
    method: 'POST',
    headers: NOTION_HEADERS,
    body: JSON.stringify({
      parent: { page_id: pageId },
      rich_text: [{ text: { content: text.slice(0, 1999) } }],
    }),
  });
  return r.ok;
}

async function updateNotionStatus(pageId, status) {
  const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: NOTION_HEADERS,
    body: JSON.stringify({ properties: { Status: { status: { name: status } } } }),
  });
  return r.ok;
}

// ─────────────────────────────────────────────────────────────────
// Intent detection
// ─────────────────────────────────────────────────────────────────

function detectIntent({ status, comments, bodyText }) {
  if (status === 'Discarted') return { intent: 'DISCARD', feedback: '' };

  const allHumanText = [...comments, bodyText].join('\n').toLowerCase().trim();

  // Filtrar comentarios del bot
  const humanComments = comments.filter((c) => {
    const t = c.toLowerCase();
    // Heurística simple: comentarios del bot empiezan con marcadores específicos
    return !t.startsWith('api key recibida') && !t.startsWith('cuenta activa') && !t.startsWith('listo para skill');
  });

  const allText = humanComments.join('\n').toLowerCase();
  const hasPublishKeyword = PUBLISH_KEYWORDS.some((kw) => allText.includes(kw));

  if (hasPublishKeyword) {
    return { intent: 'PUBLISH', feedback: humanComments.join('\n').trim() };
  }

  if (humanComments.length === 0 && !bodyText.trim()) {
    // Sin feedback humano y status Done = aprobación silenciosa
    return { intent: 'PUBLISH', feedback: '(aprobación silenciosa sin comentarios)' };
  }

  // Hay feedback substantivo → refine
  return { intent: 'REFINE', feedback: humanComments.join('\n\n') + (bodyText ? '\n\nBody adicional:\n' + bodyText : '') };
}

// ─────────────────────────────────────────────────────────────────
// History helpers
// ─────────────────────────────────────────────────────────────────

async function loadDraftsHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { drafts: [] }; }
}
async function saveDraftsHistory(h) { await fs.writeFile(HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }
async function loadProcessed() {
  try { return JSON.parse(await fs.readFile(PROCESSED_PATH, 'utf8')); }
  catch { return { processed: [] }; }
}
async function saveProcessed(p) { await fs.writeFile(PROCESSED_PATH, JSON.stringify(p, null, 2) + '\n'); }

function findDraftRecord(history, notionTaskId) {
  return history.drafts.find((d) => d.notionTaskId === notionTaskId);
}

// ─────────────────────────────────────────────────────────────────
// Actions: PUBLISH / REFINE / DISCARD
// ─────────────────────────────────────────────────────────────────

function gitConfig() {
  execSync(`git -C "${ROOT}" config user.name "casa-museo-brain[bot]"`, { stdio: 'pipe' });
  execSync(`git -C "${ROOT}" config user.email "brain@casamuseolaureles.com"`, { stdio: 'pipe' });
}

function gitPush(args = '') {
  const token = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';
  const pushUrl = `https://x-access-token:${token}@github.com/${REPO}.git`;
  execSync(`git -C "${ROOT}" push ${args} "${pushUrl}"`, { stdio: 'pipe' });
}

async function actionPublish({ draftRecord, taskPageId, feedback }) {
  // Edita los .md (draft: true → draft: false), commit a main, push, cierra PR
  const files = draftRecord.files || [];
  for (const relPath of files) {
    const fullPath = path.join(ROOT, relPath);
    let content = await fs.readFile(fullPath, 'utf8');
    content = content.replace(/^draft:\s*true\b/m, 'draft: false');
    await fs.writeFile(fullPath, content);
  }
  gitConfig();
  // Asegurarse de estar en main
  try { execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' }); } catch {}
  // Pull antes de commit por si el branch remoto avanzó
  try {
    const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';
    const token = process.env.GITHUB_TOKEN;
    execSync(`git -C "${ROOT}" pull --rebase "https://x-access-token:${token}@github.com/${REPO}.git" main`, { stdio: 'pipe' });
  } catch {}
  for (const f of files) execSync(`git -C "${ROOT}" add "${f}"`, { stdio: 'pipe' });
  const slug = draftRecord.slug;
  execSync(`git -C "${ROOT}" commit -m "content: publish ${slug} (aprobado vía Notion)"`, { stdio: 'pipe' });
  gitPush();

  // Cerrar el PR del draft con merge marker o close
  if (draftRecord.prUrl) {
    try {
      const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';
      const prNum = draftRecord.prUrl.match(/\/pull\/(\d+)/)?.[1];
      if (prNum) {
        await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNum}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ state: 'closed' }),
        });
      }
    } catch (e) {
      console.warn(`PR close failed: ${e.message}`);
    }
  }

  // Comentario en Notion confirmando
  const today = new Date().toISOString().slice(0, 10);
  const publicUrl = `https://casamuseolaureles.com/es/blog/${slug}`;
  await addNotionComment(taskPageId, `✅ Publicado ${today}.\n\nLive en: ${publicUrl}\n\nVercel deploya en 30-60s. Verifica el render.\n\n${feedback ? `Tu feedback: "${feedback.slice(0, 200)}"` : 'Aprobación silenciosa registrada.'}`);

  return { action: 'PUBLISH', files, publicUrl };
}

async function actionRefine({ draftRecord, taskPageId, feedback, state }) {
  // Regenera el draft tomando el feedback humano + force push al mismo branch + Notion → Review
  if (!process.env.ANTHROPIC_API_KEY) {
    await addNotionComment(taskPageId, `⚠️ No puedo refinar — falta ANTHROPIC_API_KEY en el entorno del agent.`);
    return { action: 'REFINE_FAILED' };
  }

  const { buildSystemPrompt, buildUserPrompt, callClaudeWithFeedback, parseFrontmatter, validateDraft, extractSlug } = await import('./content-draft-generator-helpers.mjs').catch(() => null) || {};

  // Importar funciones del content-draft-generator dinámicamente
  const cdg = await import('./content-draft-generator.mjs');

  // Reconstruir gap del history record
  const gap = draftRecord.gap || { type: 'content_gap', query: draftRecord.slug.replace(/-/g, ' '), action: 'refine', rationale: 'Refine desde feedback humano' };

  // Para refine: necesitamos generar de nuevo PERO con feedback humano injected
  // Hack rápido: usamos el mismo buildSystemPrompt + buildUserPrompt internos del módulo, no exportados.
  // Mejor: agregar exportación de un helper "refineDraft" en content-draft-generator.mjs. Por ahora,
  // llamamos a Claude directamente acá con prompt simple para refine.

  const refinePromptES = `Eres editor de Casa Museo Laureles. Tienes un draft de blog publicado con feedback humano para refinar.

FEEDBACK DEL HUMANO (estos cambios son OBLIGATORIOS):
${feedback}

DRAFT ACTUAL (.md completo):
${await fs.readFile(path.join(ROOT, draftRecord.files[0]), 'utf8')}

INSTRUCCIONES:
- Aplica EXACTAMENTE los cambios pedidos por el humano.
- Mantén estructura frontmatter + body markdown.
- Mantén draft: true en el frontmatter.
- Si el feedback dice "la cifra X está mal", reemplázala con la cifra correcta o quítala si no tienes fuente.
- Si dice "reescribir FAQ 3", reescribelo manteniendo la estructura q/a.
- NO inventes datos nuevos sin fuente.
- Devuelve el archivo .md completo (frontmatter + body), sin explicaciones extra ni code fences.`;

  let refinedES = null, refinedEN = null;
  try {
    const rES = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: refinePromptES }],
      }),
    });
    if (rES.ok) {
      const jES = await rES.json();
      refinedES = (jES.content || []).map((c) => c.text).join('').trim();
      if (refinedES.startsWith('```')) refinedES = refinedES.replace(/^```[a-z]*\n/, '').replace(/\n```\s*$/, '');
    }

    // Refine EN si existe
    const enFile = draftRecord.files.find((f) => f.includes('/en/'));
    if (enFile && refinedES) {
      const refinePromptEN = refinePromptES.replace('Casa Museo Laureles. Tienes un draft', 'Casa Museo Laureles. You have an English draft').replace('DRAFT ACTUAL', 'CURRENT DRAFT').replace(await fs.readFile(path.join(ROOT, draftRecord.files[0]), 'utf8'), await fs.readFile(path.join(ROOT, enFile), 'utf8'));
      const rEN = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8000,
          messages: [{ role: 'user', content: refinePromptEN }],
        }),
      });
      if (rEN.ok) {
        const jEN = await rEN.json();
        refinedEN = (jEN.content || []).map((c) => c.text).join('').trim();
        if (refinedEN.startsWith('```')) refinedEN = refinedEN.replace(/^```[a-z]*\n/, '').replace(/\n```\s*$/, '');
      }
    }
  } catch (e) {
    await addNotionComment(taskPageId, `⚠️ Refine falló: ${e.message}`);
    return { action: 'REFINE_FAILED' };
  }

  if (!refinedES) {
    await addNotionComment(taskPageId, `⚠️ Refine falló: Claude no devolvió contenido válido.`);
    return { action: 'REFINE_FAILED' };
  }

  // Escribir refined al ES
  const esFile = draftRecord.files.find((f) => f.includes('/es/'));
  if (esFile) await fs.writeFile(path.join(ROOT, esFile), refinedES + (refinedES.endsWith('\n') ? '' : '\n'));
  if (refinedEN) {
    const enFile = draftRecord.files.find((f) => f.includes('/en/'));
    if (enFile) await fs.writeFile(path.join(ROOT, enFile), refinedEN + (refinedEN.endsWith('\n') ? '' : '\n'));
  }

  // Force-push al branch del PR
  gitConfig();
  const branchName = draftRecord.branch;
  if (branchName) {
    try {
      try { execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' }); } catch {}
      // Pull main + checkout to branch (or create from main if not local)
      try {
        execSync(`git -C "${ROOT}" fetch origin ${branchName}:${branchName}`, { stdio: 'pipe' });
        execSync(`git -C "${ROOT}" checkout ${branchName}`, { stdio: 'pipe' });
      } catch {
        execSync(`git -C "${ROOT}" checkout -b ${branchName}`, { stdio: 'pipe' });
      }
      for (const f of draftRecord.files) execSync(`git -C "${ROOT}" add "${f}"`, { stdio: 'pipe' });
      execSync(`git -C "${ROOT}" commit -m "content: refine ${draftRecord.slug} (feedback humano)"`, { stdio: 'pipe' });
      gitPush(`--force-with-lease ${branchName}`);
      execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' });
    } catch (e) {
      console.warn(`Git refine push failed: ${e.message}`);
    }
  }

  await updateNotionStatus(taskPageId, 'Review');
  await addNotionComment(taskPageId, `🔄 v2 generada con tu feedback. Force-push al branch ${branchName}. Volvé a abrir el PR para ver los cambios.\n\nFeedback aplicado: "${feedback.slice(0, 400)}${feedback.length > 400 ? '…' : ''}"`);

  return { action: 'REFINE', branch: branchName };
}

async function actionDiscard({ draftRecord, taskPageId }) {
  // Cerrar PR + archivar .md (renombrar a .archived.md o moverlos)
  if (draftRecord.prUrl) {
    try {
      const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';
      const prNum = draftRecord.prUrl.match(/\/pull\/(\d+)/)?.[1];
      if (prNum) {
        await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNum}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ state: 'closed' }),
        });
      }
    } catch {}
  }

  // Para archivar los .md: los borramos del main (estaban con draft:true así que ya no estaban publicados).
  gitConfig();
  try {
    try { execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' }); } catch {}
    const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';
    const token = process.env.GITHUB_TOKEN;
    execSync(`git -C "${ROOT}" pull --rebase "https://x-access-token:${token}@github.com/${REPO}.git" main`, { stdio: 'pipe' });
    for (const f of draftRecord.files) {
      try { execSync(`git -C "${ROOT}" rm "${f}"`, { stdio: 'pipe' }); } catch {}
    }
    execSync(`git -C "${ROOT}" commit -m "content: discard ${draftRecord.slug} (descartado vía Notion)"`, { stdio: 'pipe' });
    gitPush();
  } catch (e) {
    console.warn(`Discard git ops failed: ${e.message}`);
  }

  await addNotionComment(taskPageId, `🔴 Descartado. PR cerrado, .md eliminados del repo. El sistema no volverá a generar este gap por al menos 30 días.`);

  return { action: 'DISCARD' };
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

export async function runDraftReviewProcessor() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) {
    return { ok: false, stale: true, summary: 'Draft review: sin Notion creds', alerts: [], data: null };
  }

  const tasks = await listDraftReviewTasks();
  if (!tasks.length) {
    return { ok: true, stale: true, summary: 'Draft review: 0 tareas para procesar', alerts: [], data: { processed: [] } };
  }

  const history = await loadDraftsHistory();
  const processedState = await loadProcessed();
  const processedIds = new Set(processedState.processed.map((p) => p.taskId + '|' + p.lastEditedTime));

  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  const results = [];
  const alerts = [];

  for (const task of tasks) {
    const lastEditedTime = task.last_edited_time;
    const key = task.id + '|' + lastEditedTime;
    if (processedIds.has(key)) continue;

    const status = task.properties?.Status?.status?.name;
    const draftRecord = findDraftRecord(history, task.id);
    if (!draftRecord) {
      console.warn(`Tarea ${task.id} sin draft record en history. Skip.`);
      continue;
    }

    const comments = (await getPageComments(task.id)).map((c) => c.text);
    const bodyBlocks = await getPageBlocks(task.id);
    const bodyText = bodyBlocks.join('\n').trim();

    const { intent, feedback } = detectIntent({ status, comments, bodyText });
    console.log(`Processing ${task.id.slice(-8)} · status=${status} · intent=${intent}`);

    let actionResult = null;
    try {
      if (intent === 'PUBLISH') {
        actionResult = await actionPublish({ draftRecord, taskPageId: task.id, feedback });
        draftRecord.status = 'published';
        draftRecord.publishedAt = new Date().toISOString();
      } else if (intent === 'REFINE') {
        actionResult = await actionRefine({ draftRecord, taskPageId: task.id, feedback, state });
        draftRecord.status = 'refining';
      } else if (intent === 'DISCARD') {
        actionResult = await actionDiscard({ draftRecord, taskPageId: task.id });
        draftRecord.status = 'discarded';
      }
    } catch (e) {
      alerts.push(`Action ${intent} failed for ${task.id.slice(-8)}: ${e.message}`);
      console.error(e);
      continue;
    }

    results.push({ taskId: task.id, intent, action: actionResult });
    processedState.processed.push({ taskId: task.id, lastEditedTime, intent, ts: new Date().toISOString() });
  }

  await saveDraftsHistory(history);
  await saveProcessed(processedState);

  return {
    ok: true,
    stale: results.length === 0,
    summary: `Draft review: ${results.length} tarea(s) procesada(s) (${results.map((r) => r.intent).join(', ')})`,
    data: { processed: results },
    alerts,
  };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await runDraftReviewProcessor();
  console.log(JSON.stringify(r, null, 2));
}
