#!/usr/bin/env node
/**
 * Notion sync — crear/actualizar tarjetas en el kanban desde el weekly-agent.
 *
 * Funciones:
 *   - syncCitationTasks(citations, nap): asegura una tarjeta por citation pendiente.
 *     Si ya existe (matchea por title), no la duplica.
 *   - createGapTask(gap): crea tarjeta para una oportunidad detectada por gap-detector.
 *   - createBrainTask(opts): tarea genérica desde el agente.
 *
 * Env:
 *   NOTION_TOKEN, NOTION_DB_ID
 */

const NOTION_VERSION = '2022-06-28';

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function listAllTasks() {
  const all = [];
  let cursor;
  const dbId = process.env.NOTION_DB_ID;
  do {
    const body = { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Notion query: ${r.status} ${await r.text()}`);
    const j = await r.json();
    all.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return all;
}

function titleOf(page) {
  const arr = page.properties?.Title?.title || [];
  return arr.map((t) => t.plain_text).join('').trim();
}

function statusOf(page) {
  return page.properties?.Status?.status?.name || null;
}

export async function createNotionTask({ title, status = 'To Do', priority = 'P1', type = 'Other', createdBy = 'Brain', forUseIn = '', acceptanceCriteria = '', deadline = null }) {
  const props = {
    Title: { title: [{ text: { content: title.slice(0, 199) } }] },
    Status: { status: { name: status } },
    Priority: { select: { name: priority } },
    Type: { select: { name: type } },
    'Created by': { select: { name: createdBy } },
  };
  if (forUseIn) props['For use in'] = { rich_text: [{ text: { content: forUseIn.slice(0, 1999) } }] };
  if (acceptanceCriteria) props['Acceptance criteria'] = { rich_text: [{ text: { content: acceptanceCriteria.slice(0, 1999) } }] };
  if (deadline) props.Deadline = { date: { start: deadline } };

  const r = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_DB_ID },
      properties: props,
    }),
  });
  if (!r.ok) {
    console.warn(`Notion task create failed (${title.slice(0, 50)}): ${r.status} ${await r.text()}`);
    return null;
  }
  return r.json();
}

export async function syncCitationTasks(citations, nap) {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) {
    console.warn('Notion sync skipped: missing NOTION_TOKEN or NOTION_DB_ID');
    return { created: 0, skipped: 0 };
  }
  if (!citations?.length) return { created: 0, skipped: 0 };

  const existing = await listAllTasks();
  const existingTitles = new Set(existing.filter((p) => statusOf(p) !== 'Done' && statusOf(p) !== 'Discarted').map(titleOf));

  let created = 0, skipped = 0;
  for (const c of citations) {
    const title = `Citation: ${c.name}`;
    if ([...existingTitles].some((t) => t.toLowerCase().includes(c.name.toLowerCase()))) {
      skipped++; continue;
    }
    const napBlock = [
      nap.name,
      `${nap.address}, ${nap.neighborhood}`,
      `${nap.city}, ${nap.region}`,
      nap.phone,
      nap.website,
    ].join('\n');
    await createNotionTask({
      title,
      priority: c.priority === 'high' ? 'P0' : c.priority === 'medium' ? 'P1' : 'P2',
      type: 'Citation',
      createdBy: 'Brain',
      forUseIn: `Citation building. ${c.tips || ''}`,
      acceptanceCriteria: `URL de registro: ${c.url}\n\nNAP exacto (copy-paste idéntico):\n${napBlock}\n\nTiempo estimado: ${c.estimatedTimeMin || '?'} min.`,
    });
    created++;
  }
  return { created, skipped };
}

export async function syncGapTasks(gaps, maxToCreate = 3) {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) {
    return { created: 0 };
  }
  if (!gaps?.length) return { created: 0 };

  const existing = await listAllTasks();
  const openTitles = new Set(existing.filter((p) => statusOf(p) !== 'Done' && statusOf(p) !== 'Discarted').map((p) => titleOf(p).toLowerCase()));

  let created = 0;
  for (const g of gaps.slice(0, maxToCreate)) {
    const title = `[BRAIN ${g.action.toUpperCase()}] "${g.query}"`;
    if (openTitles.has(title.toLowerCase())) continue;
    await createNotionTask({
      title,
      priority: g.type === 'cannibalization' ? 'P0' : g.type === 'edge_of_page_1' ? 'P1' : 'P2',
      type: 'Content asset',
      createdBy: 'Brain',
      forUseIn: `${g.type} detectado por gap-detector semanal.`,
      acceptanceCriteria: g.rationale + (g.page ? `\n\nURL involucrada: ${g.page}` : ''),
    });
    created++;
  }
  return { created };
}
