#!/usr/bin/env node
/**
 * Casa Laureles 41 — Weekly agent.
 *
 * Corre semanalmente vía GitHub Actions.
 * Pulls health data de Search Console + Bing + GA4, revisa el state file
 * de citations y genera un Issue de GitHub con tareas priorizadas para el
 * equipo humano + auto-updates al state.
 *
 * Env vars requeridas:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   BING_WEBMASTER_API_KEY
 *   GITHUB_TOKEN, GITHUB_REPOSITORY (auto en Actions)
 *
 * Args (debug):
 *   --dry-run           : no crea Issue, no commitea
 *   --no-google         : skip GSC checks
 *   --no-bing           : skip Bing checks
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runLighthouse } from './skills/lighthouse-audit.mjs';
import { runAhrefs } from './skills/ahrefs-research.mjs';
import { runOtterly } from './skills/otterly-csv-ingest.mjs';
import { runGapDetector } from './skills/keyword-gap-detector.mjs';
import { runContentDraftGenerator } from './skills/content-draft-generator.mjs';
import { renderEmail, sendReportEmail } from './lib/email-renderer.mjs';
import { syncCitationTasks, syncGapTasks } from './lib/notion-sync.mjs';

const FLAGS = {
  dryRun: process.argv.includes('--dry-run'),
  noGoogle: process.argv.includes('--no-google'),
  noBing: process.argv.includes('--no-bing'),
  noLighthouse: process.argv.includes('--no-lighthouse'),
  noAhrefs: process.argv.includes('--no-ahrefs'),
  noOtterly: process.argv.includes('--no-otterly'),
  noGaps: process.argv.includes('--no-gaps'),
  noContent: process.argv.includes('--no-content'),
  noEmail: process.argv.includes('--no-email'),
  noNotion: process.argv.includes('--no-notion'),
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'data', 'agent-state.json');
const SITE = 'sc-domain:casamuseolaureles.com';
const SITE_URL = 'https://casamuseolaureles.com';
const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function loadState() {
  return JSON.parse(await fs.readFile(STATE_PATH, 'utf8'));
}

async function saveState(state) {
  if (FLAGS.dryRun) return;
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

async function getGoogleAccessToken() {
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
  if (!r.ok) throw new Error('Google OAuth refresh failed: ' + r.status);
  return (await r.json()).access_token;
}

// ─────────────────────────────────────────────────────────────────
// GSC
// ─────────────────────────────────────────────────────────────────

async function gscHealthCheck(token) {
  const A = { Authorization: 'Bearer ' + token };
  const out = { sitemap: null, topQueries: [], indexingStatus: [] };

  // Sitemap status
  const smRes = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps/${encodeURIComponent(SITE_URL + '/sitemap-index.xml')}`,
    { headers: A }
  );
  if (smRes.ok) {
    const sm = await smRes.json();
    const submitted = (sm.contents || []).reduce((a, c) => a + Number(c.submitted || 0), 0);
    const indexed = (sm.contents || []).reduce((a, c) => a + Number(c.indexed || 0), 0);
    out.sitemap = {
      lastDownloaded: sm.lastDownloaded,
      errors: Number(sm.errors) || 0,
      warnings: Number(sm.warnings) || 0,
      submitted,
      indexed,
    };
  }

  // Top queries (last 28 days)
  const end = new Date();
  const start = new Date(end.getTime() - 28 * 86400000);
  const saRes = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { ...A, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        dimensions: ['query'],
        rowLimit: 10,
      }),
    }
  );
  if (saRes.ok) {
    const sa = await saRes.json();
    out.topQueries = (sa.rows || []).map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
  }

  // Indexing status of pending URLs (max 10 to respect quota)
  const state = await loadState();
  const checkUrls = state.indexingTracker.pendingUrls.slice(0, 10);
  for (const url of checkUrls) {
    const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { ...A, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE, languageCode: 'es-CO' }),
    });
    if (r.ok) {
      const d = await r.json();
      const idx = d.inspectionResult?.indexStatusResult || {};
      out.indexingStatus.push({
        url,
        verdict: idx.verdict || 'UNKNOWN',
        coverageState: idx.coverageState || '',
        lastCrawl: idx.lastCrawlTime || null,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Bing
// ─────────────────────────────────────────────────────────────────

async function bingHealthCheck() {
  const key = process.env.BING_WEBMASTER_API_KEY;
  const out = { feeds: [], crawlStats: null };
  const fr = await fetch(
    `https://ssl.bing.com/webmaster/api.svc/json/GetFeeds?siteUrl=${encodeURIComponent(SITE_URL)}&apikey=${encodeURIComponent(key)}`
  );
  if (fr.ok) {
    const data = await fr.json();
    out.feeds = (data.d || []).map((f) => ({
      url: f.Url,
      status: f.Status,
      urlCount: f.UrlCount,
      lastCrawled: f.LastCrawled,
    }));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Citation tasks generator
// ─────────────────────────────────────────────────────────────────

function pickWeeklyCitations(state, count = 3) {
  const priorityOrder = { high: 0, medium: 1, low: 2, skip: 99 };
  return state.citations
    .filter((c) => c.status === 'pending')
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, count);
}

function citationToTaskMd(c, nap) {
  const napBlock =
    `\`\`\`\n` +
    `Name:    ${nap.name}\n` +
    `Address: ${nap.address}, ${nap.neighborhood}, ${nap.city}, ${nap.region}, ${nap.country}\n` +
    `ZIP:     ${nap.postalCode}\n` +
    `Phone:   ${nap.phone}\n` +
    `Email:   ${nap.email}\n` +
    `Website: ${nap.website}\n` +
    `Cat ES:  ${nap.categoryEs}\n` +
    `Cat EN:  ${nap.categoryEn}\n` +
    `Geo:     ${nap.lat}, ${nap.lng}\n` +
    `IG:      ${nap.instagram}\n` +
    `\`\`\``;
  return [
    `### ${c.name}  ·  prioridad ${c.priority}  ·  ~${c.estimatedTimeMin} min`,
    ``,
    `🔗 **Registrar en:** ${c.url}`,
    ``,
    `**NAP canónico** (copy-paste idéntico — la consistencia es lo que cuenta):`,
    napBlock,
    ``,
    c.tips ? `💡 **Tips:** ${c.tips}` : '',
    ``,
    `Cuando termines, marca esta task como done en la siguiente PR:`,
    `\`\`\``,
    `data/agent-state.json → citations[id="${c.id}"].status = "done"`,
    `data/agent-state.json → citations[id="${c.id}"].completedAt = "${new Date().toISOString().slice(0, 10)}"`,
    `\`\`\``,
  ]
    .filter(Boolean)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────
// Issue body builder
// ─────────────────────────────────────────────────────────────────

function buildIssueBody({ state, gsc, bing, citations, weekStr }) {
  const lines = [];
  lines.push(`> Reporte automático generado por el weekly-agent. PRs bienvenidos para corregir o extender.`);
  lines.push('');
  lines.push(`## 📊 SEO health check`);
  lines.push('');
  if (gsc?.sitemap) {
    const s = gsc.sitemap;
    lines.push(`### Search Console`);
    lines.push(`- Sitemap: ${s.errors === 0 ? '✅ sin errores' : '❌ ' + s.errors + ' errors'}, ${s.warnings === 0 ? 'sin warnings' : s.warnings + ' warnings'}`);
    lines.push(`- URLs submitted: **${s.submitted}** · indexed: **${s.indexed}** (${Math.round((s.indexed / Math.max(s.submitted, 1)) * 100)}%)`);
    lines.push(`- Last downloaded: ${s.lastDownloaded || '—'}`);
    lines.push('');
  }
  if (gsc?.topQueries?.length) {
    lines.push(`### Top queries (últimos 28 días)`);
    lines.push(`| Query | Clicks | Imp. | CTR | Pos. |`);
    lines.push(`|---|--:|--:|--:|--:|`);
    gsc.topQueries.forEach((q) => {
      lines.push(`| \`${q.query}\` | ${q.clicks} | ${q.impressions} | ${(q.ctr * 100).toFixed(1)}% | ${q.position.toFixed(1)} |`);
    });
    lines.push('');
  } else if (gsc) {
    lines.push(`### Top queries`);
    lines.push(`- Sin datos aún. Normal: GSC tarda 24-72h en empezar a registrar tráfico orgánico, y un sitio nuevo necesita 4-8 semanas para acumular impresiones medibles.`);
    lines.push('');
  }
  if (gsc?.indexingStatus?.length) {
    lines.push(`### Estado de indexación (URLs core pendientes)`);
    lines.push(`| URL | Verdict | Coverage | Last crawl |`);
    lines.push(`|---|---|---|---|`);
    gsc.indexingStatus.forEach((u) => {
      const path = u.url.replace('https://casamuseolaureles.com', '') || '/';
      lines.push(`| \`${path}\` | ${u.verdict} | ${u.coverageState || '—'} | ${u.lastCrawl ? u.lastCrawl.slice(0, 10) : '—'} |`);
    });
    const stillPending = gsc.indexingStatus.filter((u) => u.verdict !== 'PASS');
    if (stillPending.length) {
      lines.push('');
      lines.push(`> 🟡 ${stillPending.length} URLs descubiertas pero no indexadas. **Acción humana opcional:** ir a GSC → URL Inspection → pegar cada URL → "Request indexing". Acelera de 7-14 días a 1-3 días.`);
    }
    lines.push('');
  }

  if (bing?.feeds?.length) {
    lines.push(`### Bing Webmaster`);
    bing.feeds.forEach((f) => {
      lines.push(`- ${f.url} · status: ${f.status} · urlCount: ${f.urlCount}`);
    });
    lines.push('');
  }

  // Citations
  lines.push(`## 📍 Citation building (${citations.length} tareas esta semana)`);
  lines.push('');
  if (citations.length === 0) {
    lines.push(`✅ No hay citations pendientes con prioridad alta o media.`);
    const skipped = state.citations.filter((c) => c.status === 'pending');
    if (skipped.length) {
      lines.push(`Quedan ${skipped.length} pendientes de baja prioridad — los iremos haciendo gradualmente.`);
    }
  } else {
    lines.push(`Cada link abre el portal donde registrar Casa Museo. El bloque \`NAP canónico\` debe pegarse **idéntico carácter por carácter** — Google detecta inconsistencias y baja autoridad.`);
    lines.push('');
    citations.forEach((c, i) => {
      lines.push(`---`);
      lines.push('');
      lines.push(citationToTaskMd(c, state.nap));
      lines.push('');
    });
  }

  // Footer
  lines.push(`---`);
  lines.push('');
  lines.push(`<details><summary>Cómo este reporte se actualiza</summary>`);
  lines.push('');
  lines.push(`Este Issue lo crea \`scripts/weekly-agent.mjs\` cada lunes ~8 AM Bogotá vía GitHub Actions. Para ajustar el comportamiento, edita el script o \`data/agent-state.json\`. Para forzar una corrida, ve a Actions → Weekly agent → "Run workflow".`);
  lines.push('');
  lines.push(`</details>`);
  lines.push('');
  lines.push(`_Run: ${weekStr} · runId: ${process.env.GITHUB_RUN_ID || 'local'}_`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// GitHub Issue creation
// ─────────────────────────────────────────────────────────────────

async function createGitHubIssue(title, body) {
  if (FLAGS.dryRun) {
    console.log('--- DRY RUN: Issue body ---\n');
    console.log(body);
    console.log('\n--- end ---');
    return null;
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body, labels: ['weekly-agent', 'tasks'] }),
  });
  if (!r.ok) throw new Error('GH issue create failed: ' + r.status + ' ' + (await r.text()));
  const issue = await r.json();
  return issue.html_url;
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

(async () => {
  const state = await loadState();
  const now = new Date();
  const weekStr = now.toISOString().slice(0, 10);

  let gsc = null, bing = null, googleToken = null;
  if (!FLAGS.noGoogle) {
    try {
      googleToken = await getGoogleAccessToken();
      gsc = await gscHealthCheck(googleToken);
      console.log('✓ GSC checked:', gsc.sitemap?.submitted || 0, 'urls,', gsc.topQueries.length, 'queries');
    } catch (e) {
      console.error('✗ GSC failed:', e.message);
    }
  }
  if (!FLAGS.noBing) {
    try {
      bing = await bingHealthCheck();
      console.log('✓ Bing checked:', bing.feeds.length, 'feeds');
    } catch (e) {
      console.error('✗ Bing failed:', e.message);
    }
  }

  // ─── Skills nuevas (cada una con su try/catch para no romper la cadena) ─
  let lighthouse = null, ahrefs = null, otterly = null, gaps = null;

  if (!FLAGS.noLighthouse) {
    try {
      lighthouse = await runLighthouse(state);
      console.log('✓ Lighthouse:', lighthouse.summary);
    } catch (e) {
      console.error('✗ Lighthouse failed:', e.message);
      lighthouse = { ok: false, stale: true, summary: 'Lighthouse failed: ' + e.message, alerts: [], data: null };
    }
  }

  if (!FLAGS.noAhrefs) {
    try {
      ahrefs = await runAhrefs(state);
      console.log('✓ Ahrefs:', ahrefs.summary);
    } catch (e) {
      console.error('✗ Ahrefs failed:', e.message);
      ahrefs = { ok: false, stale: true, summary: 'Ahrefs failed: ' + e.message, alerts: [], data: null };
    }
  }

  if (!FLAGS.noOtterly) {
    try {
      otterly = await runOtterly(state);
      console.log('✓ Otterly:', otterly.summary);
    } catch (e) {
      console.error('✗ Otterly failed:', e.message);
      otterly = { ok: false, stale: true, summary: 'Otterly failed: ' + e.message, alerts: [], data: null };
    }
  }

  if (!FLAGS.noGaps && googleToken) {
    try {
      gaps = await runGapDetector(state, googleToken, ahrefs);
      console.log('✓ Gap detector:', gaps.summary);
    } catch (e) {
      console.error('✗ Gap detector failed:', e.message);
      gaps = { ok: false, stale: true, summary: 'Gap detector failed: ' + e.message, alerts: [], data: null };
    }
  }

  // ─── Content draft generator (Claude) — usa los gaps detectados ─
  let contentDraft = null;
  if (!FLAGS.noContent && gaps?.ok) {
    try {
      // Construimos una lista expandida de gaps: incluye keywords del tier "head"/"mid" sin tracking
      // de Ahrefs (que vienen como oportunidades grandes aunque no estén en GSC todavía).
      const expandedGaps = [
        ...(gaps.data?.gaps || []),
        // Si no hay gaps reales todavía (sitio nuevo), pero el ahrefs trae gapKeywords, usarlos
        ...(ahrefs?.data?.gapKeywords || []).slice(0, 5).map((g) => ({
          type: 'content_gap',
          query: g.kw,
          volume: g.volume,
          kd: g.kd,
          action: 'create-content',
          rationale: `Competitor "${g.competitor}" rankea en pos ${g.position} para "${g.kw}" (vol ${g.volume}/mes). Nosotros no.`,
        })),
        // Si seguimos sin gaps, usar keywords tier head/mid del state como fallback (estrategia agresiva)
        ...((!gaps.data?.gaps?.length && !(ahrefs?.data?.gapKeywords?.length))
          ? (state.keywordsToTrack || [])
              .filter((k) => ['head', 'mid'].includes(k.tier))
              .slice(0, 3)
              .map((k) => ({
                type: 'content_gap',
                query: k.kw,
                kw: k.kw,
                action: 'create-content',
                rationale: `Keyword tier "${k.tier}" (${k.intent}) sin contenido propio. Estrategia agresiva multi-tier — atacar antes que la competencia se posicione en LLMs.`,
              }))
          : []),
      ];
      contentDraft = await runContentDraftGenerator(state, { data: { gaps: expandedGaps } });
      console.log('✓ Content draft:', contentDraft.summary);
    } catch (e) {
      console.error('✗ Content draft failed:', e.message);
      contentDraft = { ok: false, stale: true, summary: 'Content draft failed: ' + e.message, alerts: [], data: null };
    }
  }

  // ─── Consolidación de alertas y wins ─
  const allAlerts = [
    ...(lighthouse?.alerts || []),
    ...(ahrefs?.alerts || []),
    ...(otterly?.alerts || []),
    ...(gaps?.alerts || []),
    ...(contentDraft?.alerts || []),
  ];
  const allWins = [];
  // Wins simples derivados:
  if (gsc?.sitemap && gsc.sitemap.indexed === gsc.sitemap.submitted && gsc.sitemap.submitted > 0) {
    allWins.push(`Todas las URLs del sitemap (${gsc.sitemap.submitted}) están indexadas en Google.`);
  }
  if (ahrefs?.ok && Array.isArray(ahrefs.data?.newBacklinks) && ahrefs.data.newBacklinks.length > 0) {
    allWins.push(`${ahrefs.data.newBacklinks.length} backlinks nuevos en los últimos 7 días.`);
  }
  if (otterly?.ok && !otterly.stale && otterly.data?.byEngine) {
    const totalCited = Object.values(otterly.data.byEngine).reduce((s, e) => s + e.cited, 0);
    if (totalCited > 0) allWins.push(`Citados en ${totalCited} respuestas de LLMs esta semana.`);
  }
  if (contentDraft?.ok && !contentDraft.stale && contentDraft.data?.prUrl) {
    allWins.push(`Nuevo draft de blog generado por Claude (PR abierto): <a href="${contentDraft.data.prUrl}">${contentDraft.data.gap?.query || 'draft'}</a>`);
  }

  // ─── GitHub Issue (sigue siendo el respaldo técnico) ─
  const citations = pickWeeklyCitations(state, 3);
  const title = `🌱 Weekly tasks · ${weekStr} · ${citations.length} citations + SEO check`;
  const body = buildIssueBody({ state, gsc, bing, citations, weekStr });
  let issueUrl = null;
  try {
    issueUrl = await createGitHubIssue(title, body);
    if (issueUrl) console.log('✓ Issue created:', issueUrl);
  } catch (e) {
    console.error('✗ GH Issue failed:', e.message);
  }

  // ─── Email semanal vía Resend ─
  if (!FLAGS.noEmail && !FLAGS.dryRun) {
    try {
      const html = renderEmail({ weekStr, gsc, bing, lighthouse, ahrefs, otterly, gaps, citations, allAlerts, allWins, issueUrl });
      const subject = `📊 SEO/GEO · ${weekStr} · ${allAlerts.length ? `${allAlerts.length} alertas` : 'todo en verde'}`;
      const res = await sendReportEmail({ subject, html });
      if (res.ok) console.log('✓ Email sent:', res.id);
      else console.error('✗ Email failed:', res.error);
    } catch (e) {
      console.error('✗ Email render/send failed:', e.message);
    }
  }

  // ─── Notion sync (crear tarjetas humanas) ─
  if (!FLAGS.noNotion && !FLAGS.dryRun) {
    try {
      const cs = await syncCitationTasks(citations, state.nap);
      console.log(`✓ Notion citations: ${cs.created} created, ${cs.skipped} skipped`);
      if (gaps?.ok && gaps.data?.gaps?.length) {
        const gs = await syncGapTasks(gaps.data.gaps, 3);
        console.log(`✓ Notion gap tasks: ${gs.created} created`);
      }
    } catch (e) {
      console.error('✗ Notion sync failed:', e.message);
    }
  }

  // ─── Update state ─
  state.lastRun = now.toISOString();
  state.runs = [
    {
      ts: now.toISOString(),
      citationsPicked: citations.map((c) => c.id),
      gscOk: !!gsc, bingOk: !!bing,
      lighthouseOk: !!lighthouse?.ok,
      ahrefsOk: !!ahrefs?.ok,
      otterlyOk: !!otterly?.ok && !otterly?.stale,
      gapsOk: !!gaps?.ok,
      contentDraftOk: !!contentDraft?.ok && !contentDraft?.stale,
      contentDraftPr: contentDraft?.data?.prUrl || null,
      alertsCount: allAlerts.length,
      winsCount: allWins.length,
    },
    ...(state.runs || []),
  ].slice(0, 12);
  state.indexingTracker.lastChecked = now.toISOString();
  await saveState(state);
  console.log('✓ State saved · summary:', { alerts: allAlerts.length, wins: allWins.length });
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
