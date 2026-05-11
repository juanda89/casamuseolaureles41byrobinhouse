#!/usr/bin/env node
/**
 * Email renderer + Resend sender.
 *
 * Toma el output combinado del weekly-agent (skills + GSC + Bing + citations)
 * y lo formatea como HTML email bonito enviado vía Resend.
 *
 * Env:
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL (ej: agente@reportes.casamuseolaureles.com)
 *   RESEND_TO_EMAIL (ej: juandavid@robinhouse.co)
 */

const KANBAN_URL = 'https://www.notion.so/35c4539979ca81c1ba2ed72007c32487';

const css = `
  body { margin: 0; padding: 24px; background: #f8f8f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0B2A4A; }
  .wrap { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; }
  h1 { margin: 0 0 4px; font-size: 22px; color: #0B2A4A; }
  h2 { margin: 28px 0 10px; font-size: 16px; color: #0B2A4A; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  h3 { margin: 14px 0 6px; font-size: 14px; color: #555; }
  p { line-height: 1.55; font-size: 14px; margin: 0 0 10px; }
  .kpi { display: inline-block; background: #f4f6f9; padding: 10px 14px; margin: 4px 6px 4px 0; border-radius: 6px; min-width: 100px; }
  .kpi b { display: block; font-size: 18px; color: #0B2A4A; }
  .kpi span { font-size: 12px; color: #888; }
  .alert { background: #fdecec; border-left: 3px solid #b02a2a; padding: 10px 14px; margin: 6px 0; border-radius: 4px; font-size: 13px; }
  .win { background: #eff7ee; border-left: 3px solid #1f6b3d; padding: 10px 14px; margin: 6px 0; border-radius: 4px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  th { text-align: left; background: #f4f6f9; padding: 8px; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
  .cta { display: inline-block; background: #0B2A4A; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-top: 14px; }
  .muted { color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px; }
  code { background: #f4f6f9; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
`;

function pct(n) { return Math.round((n || 0) * 100) + '%'; }

export function renderEmail({ weekStr, gsc, bing, lighthouse, ahrefs, otterly, gaps, citations, allAlerts, allWins, issueUrl }) {
  const sections = [];

  // KPI snapshot
  sections.push(`<h2>📊 KPIs de la semana</h2>`);
  const kpis = [];
  if (gsc?.sitemap) {
    kpis.push(`<div class="kpi"><b>${gsc.sitemap.indexed}/${gsc.sitemap.submitted}</b><span>URLs indexadas</span></div>`);
  }
  if (gsc?.topQueries?.length) {
    const totalImp = gsc.topQueries.reduce((s, q) => s + q.impressions, 0);
    const totalClicks = gsc.topQueries.reduce((s, q) => s + q.clicks, 0);
    kpis.push(`<div class="kpi"><b>${totalImp}</b><span>impresiones top10 (28d)</span></div>`);
    kpis.push(`<div class="kpi"><b>${totalClicks}</b><span>clicks top10 (28d)</span></div>`);
  }
  if (lighthouse?.data?.audits?.length) {
    const avg = Math.round(lighthouse.data.audits.reduce((s, a) => s + a.performance, 0) / lighthouse.data.audits.length);
    kpis.push(`<div class="kpi"><b>${avg}/100</b><span>Lighthouse perf</span></div>`);
  }
  if (ahrefs?.ok && ahrefs.data?.ranks) {
    const ranking = ahrefs.data.ranks.filter((r) => r.position != null).length;
    kpis.push(`<div class="kpi"><b>${ranking}/${ahrefs.data.ranks.length}</b><span>kws rankeando</span></div>`);
  }
  if (otterly?.ok && !otterly.stale && otterly.data?.byEngine) {
    const cited = Object.values(otterly.data.byEngine).reduce((s, e) => s + e.cited, 0);
    const total = Object.values(otterly.data.byEngine).reduce((s, e) => s + e.total, 0);
    kpis.push(`<div class="kpi"><b>${cited}/${total}</b><span>citas LLM</span></div>`);
  }
  sections.push(`<div>${kpis.join('')}</div>`);

  // Wins
  if (allWins.length) {
    sections.push(`<h2>🟢 Wins</h2>`);
    allWins.forEach((w) => sections.push(`<div class="win">${w}</div>`));
  }

  // Alerts
  if (allAlerts.length) {
    sections.push(`<h2>🔴 Alertas (${allAlerts.length})</h2>`);
    allAlerts.slice(0, 10).forEach((a) => sections.push(`<div class="alert">${a}</div>`));
    if (allAlerts.length > 10) {
      sections.push(`<p class="muted">+${allAlerts.length - 10} alertas más en el JSON completo.</p>`);
    }
  }

  // GSC top queries
  if (gsc?.topQueries?.length) {
    sections.push(`<h2>🔍 Top queries Google (últimos 28 días)</h2>`);
    sections.push(`<table><tr><th>Query</th><th>Clicks</th><th>Imp</th><th>CTR</th><th>Pos</th></tr>` +
      gsc.topQueries.slice(0, 10).map((q) =>
        `<tr><td><code>${q.query}</code></td><td>${q.clicks}</td><td>${q.impressions}</td><td>${pct(q.ctr)}</td><td>${q.position.toFixed(1)}</td></tr>`
      ).join('') +
      `</table>`);
  } else if (gsc) {
    sections.push(`<h2>🔍 Top queries Google</h2><p class="muted">Sin datos aún. GSC tarda 24-72h en registrar tráfico orgánico de un sitio nuevo.</p>`);
  }

  // Ahrefs positions
  if (ahrefs?.ok && Array.isArray(ahrefs.data?.ranks)) {
    const ranking = ahrefs.data.ranks.filter((r) => r.position != null);
    if (ranking.length) {
      sections.push(`<h2>📈 Posiciones Ahrefs (keywords trackadas)</h2>`);
      sections.push(`<table><tr><th>Keyword</th><th>Pos</th><th>Vol/mes</th><th>Idioma</th></tr>` +
        ranking.slice(0, 12).map((r) => `<tr><td><code>${r.kw}</code></td><td>${r.position}</td><td>${r.volume ?? '—'}</td><td>${r.lang}</td></tr>`).join('') +
        `</table>`);
    } else {
      sections.push(`<h2>📈 Posiciones Ahrefs</h2><p class="muted">Ninguna keyword trackada rankea todavía. Normal en sitio nuevo (sin contenido publicado).</p>`);
    }

    // Oportunidades gap
    if (Array.isArray(ahrefs.data?.gapKeywords) && ahrefs.data.gapKeywords.length) {
      sections.push(`<h3>Oportunidades de contenido (competitor gap)</h3>`);
      sections.push(`<table><tr><th>Keyword</th><th>Vol</th><th>Dificultad</th></tr>` +
        ahrefs.data.gapKeywords.slice(0, 8).map((g) => `<tr><td><code>${g.kw}</code></td><td>${g.volume ?? '—'}</td><td>${g.kd ?? '—'}</td></tr>`).join('') +
        `</table>`);
    }
  }

  // LLM citations (Otterly)
  if (otterly) {
    sections.push(`<h2>🤖 Citaciones en LLMs</h2>`);
    if (otterly.stale) {
      sections.push(`<p class="muted">${otterly.summary}</p>`);
    } else if (otterly.data?.byEngine) {
      const rows = Object.entries(otterly.data.byEngine).map(([eng, d]) =>
        `<tr><td>${eng}</td><td>${d.cited}</td><td>${d.total}</td><td>${pct(d.cited/d.total)}</td></tr>`
      ).join('');
      sections.push(`<table><tr><th>Motor</th><th>Citas</th><th>Queries</th><th>Hit rate</th></tr>${rows}</table>`);
    }
  }

  // Gaps
  if (gaps?.ok && gaps.data?.gaps?.length) {
    sections.push(`<h2>🎯 Oportunidades de optimización</h2>`);
    const topGaps = gaps.data.gaps.slice(0, 8);
    sections.push(`<table><tr><th>Tipo</th><th>Query</th><th>Acción</th></tr>` +
      topGaps.map((g) => `<tr><td><code>${g.type}</code></td><td>${g.query}</td><td>${g.action}</td></tr>`).join('') +
      `</table>`);
  }

  // Citations (human tasks)
  if (citations?.length) {
    sections.push(`<h2>📍 Citation building (${citations.length} esta semana)</h2>`);
    sections.push(`<p>Tareas humanas creadas en Notion. Ver kanban completo:</p>`);
    sections.push(citations.map((c) => `<p>· <b>${c.name}</b> (${c.estimatedTimeMin} min) — <a href="${c.url}">${c.url}</a></p>`).join(''));
  }

  // Lighthouse summary
  if (lighthouse?.ok && lighthouse.data?.audits?.length) {
    sections.push(`<h2>⚡ Lighthouse (Core Web Vitals)</h2>`);
    sections.push(`<table><tr><th>URL</th><th>Strategy</th><th>Perf</th><th>SEO</th><th>LCP</th><th>CLS</th></tr>` +
      lighthouse.data.audits.map((a) => {
        const lcp = a.lcp != null ? (a.lcp / 1000).toFixed(2) + 's' : '—';
        const cls = a.cls != null ? a.cls.toFixed(3) : '—';
        const path = a.url.replace('https://casamuseolaureles.com', '') || '/';
        return `<tr><td><code>${path}</code></td><td>${a.strategy}</td><td>${a.performance}</td><td>${a.seo}</td><td>${lcp}</td><td>${cls}</td></tr>`;
      }).join('') +
      `</table>`);
  }

  // Kanban CTA + Issue link
  sections.push(`<p style="margin-top: 24px;"><a href="${KANBAN_URL}" class="cta">Abrir kanban en Notion →</a></p>`);
  if (issueUrl) {
    sections.push(`<p class="muted">Issue de GitHub con detalle técnico: <a href="${issueUrl}">${issueUrl}</a></p>`);
  }

  // Footer
  sections.push(`<p class="muted">— Brain semanal · Casa Museo Laureles · ${weekStr}<br>Generado automáticamente. Para ajustar el comportamiento, edita scripts/weekly-agent.mjs o data/agent-state.json. Run-id: ${process.env.GITHUB_RUN_ID || 'local'}.</p>`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="wrap"><h1>Reporte SEO/GEO · semana del ${weekStr}</h1><p style="color:#888; font-size:13px; margin-top:0;">Casa Museo Laureles · casamuseolaureles.com</p>${sections.join('\n')}</div></body></html>`;
}

export async function sendReportEmail({ subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'agente@reportes.casamuseolaureles.com';
  const to = process.env.RESEND_TO_EMAIL || 'juandavid@robinhouse.co';
  if (!apiKey) {
    console.warn('No RESEND_API_KEY — skipping email send');
    return { ok: false, error: 'missing key' };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Casa Museo Laureles <${from}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!r.ok) {
    return { ok: false, error: `Resend ${r.status}: ${await r.text()}` };
  }
  const j = await r.json();
  return { ok: true, id: j.id };
}
