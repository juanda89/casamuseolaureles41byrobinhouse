#!/usr/bin/env node
/**
 * Content draft generator.
 *
 * Toma el gap más prioritario del gap-detector y genera un draft de blog
 * post ES+EN usando Claude API. Aplica reglas paper GEO Princeton.
 * Escribe los .md en site/src/content/blog/<lang>/<slug>.md con frontmatter
 * draft:true (no se publica hasta que un humano lo apruebe en el PR).
 *
 * Opens PR en GitHub via API.
 *
 * Env:
 *   ANTHROPIC_API_KEY (required)
 *   GITHUB_TOKEN, GITHUB_REPOSITORY (for PR creation)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG_BASE = path.join(ROOT, 'site', 'src', 'content', 'blog');
const HISTORY_PATH = path.join(ROOT, 'data', 'content-drafts-history.json');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-5';
const MAX_DRAFTS_PER_RUN = 3; // founder mode aggressive

// ─────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(state) {
  const nap = state.nap;
  return `Eres un editor SEO/GEO de Casa Museo Laureles by HOUSY, un proyecto boutique de 3 lofts en Laureles, Medellín.

CONTEXTO DEL PROYECTO:
- Nombre: ${nap.name}
- Dirección: ${nap.address}, ${nap.neighborhood}, ${nap.city}, ${nap.region}
- Coordenadas: ${nap.lat}, ${nap.lng}
- Dominio: ${nap.website}
- Operador: HOUSY · Developer: Robin House
- Inventario: 3 lofts boutique (Standar 2p, Familiar 4p, Deluxe Jacuzzi 2p)
- Diferencial: diseño curado tipo galería de arte, barrio Laureles caminable y auténtico (no Poblado turístico)

TU TAREA:
Vas a producir un artículo de blog en formato Markdown con frontmatter Astro, en el idioma que se te pida (es o en). El objetivo es posicionar el contenido para queries reales de viajeros (Google + Claude/ChatGPT/Gemini citations).

REGLAS NO NEGOCIABLES:

1. **Datos cuantitativos verificables**: incluye mínimo 4 datos específicos con números (precios, distancias en metros/km, tiempos, porcentajes, años, capacidades). Ejemplo: "Laureles está a 7 minutos en carro del Estadio Atanasio", NO "Laureles está cerca del Estadio".

2. **Sources externas verificables**: mínimo 2 fuentes credibles (sitio oficial Alcaldía Medellín, prensa local seria como El Colombiano/Semana, datos de turismo Medellín, El Tiempo, Lonely Planet). Inclúyelas en el frontmatter \`external_sources\`. NO inventes URLs — usa solo dominios reales conocidos (ej: medellin.gov.co, eltiempo.com, lonelyplanet.com, situr.gov.co).

3. **FAQ con 3-5 preguntas reales** en el frontmatter \`faq\`. Las preguntas deben ser las que realmente busca un viajero (no genéricas). Cada respuesta debe tener mínimo un dato cuantitativo.

4. **Headings tipo pregunta cuando sea natural**: H2 y H3 ayudan al parsing de LLMs. Ejemplo: "## ¿Cuánto cuesta hospedarse en Laureles?" mejor que "## Costos de hospedaje".

5. **Bloques de párrafo autocontenidos**: 100-180 palabras cada uno. Cada bloque debe poder leerse standalone (para que LLMs los citen como snippets).

6. **NO inventes testimoniales** ni atribuyas citas a personas reales. NO uses frases tipo "según Juan Pérez". Si necesitas autoridad, cita la fuente oficial.

7. **Tabla comparativa si hay 3+ opciones a comparar** (ej: barrios, tipos de alojamiento, precios).

8. **Mención orgánica de Casa Museo Laureles** una sola vez al final, no spam. El artículo debe ser ÚTIL primero — la mención viene como contexto natural.

9. **Tono: directo, sin floritura**. Estilo founder-mode honesto. NO uses "descubre", "déjate sorprender", clichés de copywriting de viajes.

10. **Longitud**: 1200-1800 palabras de body (sin contar frontmatter).

FORMATO DE OUTPUT REQUERIDO (estricto, parseable):

\`\`\`
---
title: "Título completo (10-120 caracteres)"
description: "Meta description optimizada para SERP (80-200 caracteres, vende el click)"
slug: "kebab-case-en-el-idioma-del-post"
lang: "es"  # o "en"
date_published: 2026-05-11
author: "Equipo Casa Museo Laureles"
tags: ["tag1", "tag2", "tag3"]
primary_keyword: "keyword principal exacta"
secondary_keywords: ["kw secundaria 1", "kw secundaria 2"]
faq:
  - q: "Pregunta 1?"
    a: "Respuesta con dato cuantitativo. Mínimo 2 frases."
  - q: "Pregunta 2?"
    a: "Respuesta..."
external_sources:
  - title: "Nombre del recurso"
    url: "https://dominio-real.com/path"
brain_generated: true
validated_by_geo_rules: true
draft: true
---

# H1 (mismo que title, descriptivo)

Párrafo intro autocontenido (100-180 palabras) con la promesa del artículo y al menos un dato cuantitativo. Sin floritura, directo al valor.

## ¿Subheading H2 tipo pregunta?

Bloque autocontenido con datos específicos. Enlazá a fuentes externas con [texto del enlace](https://url-real.com) cuando aplique.

### Subheading H3 cuando sea necesario

...

## Tabla comparativa si aplica

| Columna | Columna | Columna |
|---|---|---|
| dato | dato | dato |

## Otra sección

...

## Y Casa Museo Laureles ¿qué tiene que ver?

(Un solo párrafo al final con mención orgánica del proyecto y link sutil al sitio principal. NO marketing spam.)
\`\`\`

IMPORTANTE: tu output debe ser SOLO el archivo markdown completo (frontmatter + body). Sin explicaciones extras, sin "aquí tienes el artículo", sin código triple-backtick englobando todo. Solo el contenido raw del .md.`;
}

function buildUserPrompt(gap, lang) {
  const langLabel = lang === 'es' ? 'español de Colombia' : 'English (US/international, no Spanglish)';
  return `Necesito un artículo de blog en ${langLabel}.

GAP DETECTADO (oportunidad SEO/GEO):
- Tipo: ${gap.type}
- Keyword principal: "${gap.query || gap.kw}"
${gap.volume ? `- Volumen mensual estimado: ${gap.volume}` : ''}
${gap.kd ? `- Dificultad: ${gap.kd}` : ''}
${gap.position ? `- Posición actual (si existe): ${gap.position}` : ''}
- Acción sugerida: ${gap.action}
- Rationale: ${gap.rationale || 'Gap detectado en análisis automático.'}

ANGULO RECOMENDADO:
${suggestAngle(gap, lang)}

Generá el .md completo siguiendo las reglas del system prompt. Slug debe ser kebab-case, descriptivo, en el idioma del post. NO uses "casa-museo" en el slug — la mención de la marca va solo en el body al final.`;
}

function suggestAngle(gap, lang) {
  const q = (gap.query || gap.kw || '').toLowerCase();
  if (q.includes('vs') || q.includes('versus') || q.includes('mejor que')) {
    return lang === 'es'
      ? 'Comparativa honesta. Tabla con criterios (seguridad, precio, vibe, distancias, transporte). NO favorecer Laureles a la ligera — datos reales.'
      : 'Honest comparison. Table with criteria (safety, price, vibe, distances, transit). Do NOT favor Laureles uncritically — real data wins.';
  }
  if (q.includes('seguro') || q.includes('safe')) {
    return lang === 'es'
      ? 'Datos verificables de seguridad. Cita Alcaldía Medellín o INMLCF si tienes datos. Distingue entre zonas y horas. Sin clichés ni alarmismo.'
      : 'Verifiable safety data. Cite Alcaldía Medellín or INMLCF stats. Distinguish between zones and hours. No clichés or alarmism.';
  }
  if (q.includes('donde') || q.includes('where to stay') || q.includes('mejor barrio')) {
    return lang === 'es'
      ? 'Guía práctica de barrios: Poblado, Laureles, Envigado, Estadio. Tabla con perfil de viajero ideal para cada uno. Recomendación honesta según tipo.'
      : 'Practical neighborhood guide: Poblado, Laureles, Envigado, Estadio. Table with ideal traveler profile per area. Honest recommendation by traveler type.';
  }
  if (q.includes('cuanto cuesta') || q.includes('how much') || q.includes('precio')) {
    return lang === 'es'
      ? 'Rangos de precio reales en USD y COP, por tipo de alojamiento (hostal / mid-range / boutique / lujo). Costos adicionales (impuesto al turismo, propinas).'
      : 'Real price ranges in USD and COP, by accommodation type (hostel / mid-range / boutique / luxury). Hidden costs (tourism tax, tips).';
  }
  if (q.includes('estadio') || q.includes('stadium') || q.includes('atanasio')) {
    return lang === 'es'
      ? 'Foco geográfico: distancia exacta del Estadio Atanasio Girardot a las zonas hoteleras. Mapa mental: caminando, en metro, en carro. Eventos típicos en el estadio.'
      : 'Geographic focus: exact distance from Atanasio Girardot Stadium to lodging zones. Mental map: walking, metro, car. Typical events at the stadium.';
  }
  if (q.includes('nomad') || q.includes('digital')) {
    return lang === 'es'
      ? 'Para nómadas digitales: wifi speeds reales por zona, coworking spots, costos mensuales, comunidad. Datos de SpeedTest cuando aplique.'
      : 'For digital nomads: real wifi speeds per area, coworking spots, monthly costs, community. SpeedTest data when applicable.';
  }
  return lang === 'es'
    ? 'Artículo informacional con foco práctico. Datos verificables, sin clichés. Estructura: contexto → datos → recomendación.'
    : 'Informational article with practical focus. Verifiable data, no clichés. Structure: context → data → recommendation.';
}

// ─────────────────────────────────────────────────────────────────
// Claude API
// ─────────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userPrompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Anthropic ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || '').join('');
  return { text, usage: j.usage };
}

// ─────────────────────────────────────────────────────────────────
// Frontmatter parse + validate
// ─────────────────────────────────────────────────────────────────

function parseFrontmatter(md) {
  // Limpia code fences accidentales que el modelo pudiera añadir
  let cleaned = md.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n/, '').replace(/\n```\s*$/, '');

  const m = cleaned.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { frontmatter: m[1], body: m[2].trim(), full: cleaned };
}

function countQuantitativeData(body) {
  // Heurística simple: cuenta números seguidos de unidad (km, m, %, $, min, h, etc.)
  const patterns = [
    /\b\d+([,.]\d+)?\s*(km|metros?|m\b|minutos?|min|horas?|h\b|%|años?|años|usd|cop|pesos?|\$|€|huéspedes?|personas?|días?)/gi,
    /\b\d{2,4}\b/g, // numbers >=10 (años, precios, etc.)
  ];
  let count = 0;
  for (const p of patterns) count += (body.match(p) || []).length;
  return count;
}

function countExternalLinks(body) {
  return (body.match(/\]\(https?:\/\/[^)]+\)/g) || []).length;
}

function validateDraft(parsed, gap) {
  const errors = [];
  if (!parsed) {
    errors.push('Frontmatter no se pudo parsear (formato incorrecto)');
    return { ok: false, errors };
  }
  const fm = parsed.frontmatter;
  const body = parsed.body;

  if (!fm.includes('title:')) errors.push('falta title en frontmatter');
  if (!fm.includes('description:')) errors.push('falta description');
  if (!fm.includes('slug:')) errors.push('falta slug');
  if (!fm.includes('lang:')) errors.push('falta lang');
  if (!fm.includes('faq:')) errors.push('falta faq');

  const wordCount = body.split(/\s+/).length;
  if (wordCount < 800) errors.push(`body muy corto: ${wordCount} palabras (target 1200-1800)`);

  const quantData = countQuantitativeData(body);
  if (quantData < 4) errors.push(`solo ${quantData} datos cuantitativos (min 4)`);

  const extLinks = countExternalLinks(body);
  if (extLinks < 2) errors.push(`solo ${extLinks} enlaces externos (min 2)`);

  const faqCount = (fm.match(/^\s*- q:/gm) || []).length;
  if (faqCount < 3) errors.push(`solo ${faqCount} FAQ entries (min 3)`);

  return { ok: errors.length === 0, errors, stats: { wordCount, quantData, extLinks, faqCount } };
}

function extractSlug(parsed) {
  const m = parsed.frontmatter.match(/^slug:\s*['"]?([a-z0-9-]+)['"]?$/m);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────────

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { drafts: [] }; }
}
async function saveHistory(h) { await fs.writeFile(HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }

// ─────────────────────────────────────────────────────────────────
// PR creation via GitHub API
// ─────────────────────────────────────────────────────────────────

async function createBranchAndPR({ branchName, files, title, body }) {
  const REPO = process.env.GITHUB_REPOSITORY || 'juanda89/casamuseolaureles41byrobinhouse';
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('No GITHUB_TOKEN — skipping PR creation, dejando archivos en main');
    return null;
  }

  // Estrategia simple: usamos git CLI local. En GH Actions hay git disponible.
  // Esto evita el complejo dance de la GitHub Contents API para múltiples archivos.
  try {
    execSync(`git -C "${ROOT}" config user.name "casa-museo-brain[bot]"`, { stdio: 'pipe' });
    execSync(`git -C "${ROOT}" config user.email "brain@casamuseolaureles.com"`, { stdio: 'pipe' });
    execSync(`git -C "${ROOT}" checkout -b ${branchName}`, { stdio: 'pipe' });
    for (const f of files) {
      execSync(`git -C "${ROOT}" add "${f.path}"`, { stdio: 'pipe' });
    }
    execSync(`git -C "${ROOT}" commit -m "${title.replace(/"/g, "'")}"`, { stdio: 'pipe' });
    // push usando el token (overwrite remote URL temporalmente)
    const pushUrl = `https://x-access-token:${token}@github.com/${REPO}.git`;
    execSync(`git -C "${ROOT}" push "${pushUrl}" ${branchName}`, { stdio: 'pipe' });
    // Open PR via API
    const r = await fetch(`https://api.github.com/repos/${REPO}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, head: branchName, base: 'main' }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.warn(`PR create failed: ${r.status} ${txt}`);
      execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' });
      return null;
    }
    const pr = await r.json();
    execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' });
    return pr.html_url;
  } catch (e) {
    console.warn(`PR creation error: ${e.message}`);
    try { execSync(`git -C "${ROOT}" checkout main`, { stdio: 'pipe' }); } catch {}
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────────────────────────

function pickTopGaps(gapsData, limit = MAX_DRAFTS_PER_RUN) {
  if (!gapsData?.gaps?.length) return [];
  const priorityOrder = { content_gap: 0, edge_of_page_1: 1, cannibalization: 2, ctr_gap: 3 };
  const sorted = [...gapsData.gaps].sort((a, b) => {
    const pa = priorityOrder[a.type] ?? 99;
    const pb = priorityOrder[b.type] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.volume || b.impressions || 0) - (a.volume || a.impressions || 0);
  });
  // Dedupe por query
  const seen = new Set();
  return sorted.filter((g) => {
    const k = (g.query || g.kw || '').toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────
// Notion review task creator
// ─────────────────────────────────────────────────────────────────

async function createNotionReviewTask({ gap, generated, prUrl }) {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) return null;
  const title = `[BRAIN DRAFT REVIEW] ${(gap.query || gap.kw).slice(0, 100)}`;
  const filesList = generated.map((g) => `• ${g.path} (${g.stats.wordCount}w, ${g.stats.quantData} datos)`).join('\n');
  const acceptance = `📄 Draft generado automáticamente por Claude. ANTES de aprobar:

1. Abre el preview deploy del PR ${prUrl ? `(${prUrl})` : '(buscar PR en el repo)'}
2. Lee los archivos:
${filesList}
3. Verifica con cuidado las cifras específicas (precios, %, distancias) — Claude puede alucinar números.
4. Verifica que las URLs en external_sources sean reales y respondan 200.

⚠️ CÓMO MARCAR DECISIÓN al cambiar el status a Done:

🟢 PUBLICAR (queda live): escribe "publicar" o "publish" en un comentario de esta tarea.
   → El sistema cambia draft:true→false, hace push, Vercel deploya, queda live en /blog/<slug>.

🟡 REFINAR: escribe tus comentarios con cambios específicos (ej: "la cifra de 4.2 hurtos está mal, según Alcaldía es 6.8" / "el FAQ 3 está flojo, reescribilo más concreto").
   → El sistema lee tus comentarios, regenera el draft con esas correcciones, force-push al mismo PR, devuelve la tarea a "To Do" para revisar v2.

🔴 DESCARTAR: cambia status a Discarted directamente.
   → El sistema cierra el PR sin merge y archiva los .md.`;

  const props = {
    Title: { title: [{ text: { content: title } }] },
    Status: { status: { name: 'Review' } },
    Priority: { select: { name: 'P1' } },
    Type: { select: { name: 'Content asset' } },
    'Created by': { select: { name: 'Brain' } },
    'For use in': { rich_text: [{ text: { content: `Gap: ${gap.type} · ${(gap.rationale || '').slice(0, 1500)}` } }] },
    'Acceptance criteria': { rich_text: [{ text: { content: acceptance.slice(0, 1999) } }] },
  };
  if (prUrl) props['Linked PR'] = { url: prUrl };

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
    console.warn(`Notion review task create failed: ${r.status}`);
    return null;
  }
  const j = await r.json();
  return { id: j.id, url: j.url };
}

async function generateOneDraft({ state, gap, systemPrompt }) {
  const generated = [];
  const errors = [];

  for (const lang of ['es', 'en']) {
    const userPrompt = buildUserPrompt(gap, lang);
    let attempt = 0;
    let validResult = null;
    let lastErrors = [];

    while (attempt < 2 && !validResult) {
      attempt++;
      try {
        const { text } = await callClaude(systemPrompt, userPrompt + (attempt > 1 ? `\n\nINTENTO ${attempt} — el anterior falló validación con: ${lastErrors.join('; ')}. Corregí esos puntos.` : ''));
        const parsed = parseFrontmatter(text);
        const validation = validateDraft(parsed, gap);
        if (validation.ok && parsed) {
          const slug = extractSlug(parsed);
          if (!slug) { lastErrors = ['slug no se pudo extraer']; continue; }
          validResult = { parsed, slug, validation };
        } else {
          lastErrors = validation.errors;
        }
      } catch (e) {
        lastErrors = [`Claude API error: ${e.message}`];
        break;
      }
    }

    if (!validResult) {
      errors.push(`${lang}: ${lastErrors.join('; ')}`);
      continue;
    }

    const targetPath = path.join(BLOG_BASE, lang, `${validResult.slug}.md`);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, validResult.parsed.full + '\n');
    generated.push({ lang, slug: validResult.slug, path: path.relative(ROOT, targetPath), stats: validResult.validation.stats });
  }

  return { generated, errors };
}

export async function runContentDraftGenerator(state, gapsResult) {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, stale: true, summary: 'Content draft: sin ANTHROPIC_API_KEY', data: null, alerts: [] };
  }
  const candidates = pickTopGaps(gapsResult?.data, MAX_DRAFTS_PER_RUN);
  if (!candidates.length) {
    return { ok: true, stale: true, summary: 'Content draft: sin gaps prioritarios para esta semana', data: { generated: [] }, alerts: [] };
  }

  const history = await loadHistory();
  const recentQueries = new Set(history.drafts.slice(-30).map((d) => (d.gap?.query || '').toLowerCase().trim()).filter(Boolean));

  const systemPrompt = buildSystemPrompt(state);
  const allDrafts = [];
  const allErrors = [];

  for (const gap of candidates) {
    const queryKey = (gap.query || gap.kw || '').toLowerCase().trim();
    if (recentQueries.has(queryKey)) {
      console.log(`  skipping "${queryKey}" — ya generado recientemente`);
      continue;
    }

    const { generated, errors } = await generateOneDraft({ state, gap, systemPrompt });
    if (!generated.length) {
      allErrors.push(`"${gap.query || gap.kw}": ${errors.join('; ')}`);
      continue;
    }

    // PR
    const slug = generated[0].slug;
    const branchName = `brain/content-draft-${slug}-${new Date().toISOString().slice(0, 10)}`;
    const files = generated.map((g) => ({ path: g.path }));
    const prTitle = `[BRAIN DRAFT] ${gap.query || gap.kw} (${generated.length} idiomas)`;
    const prBody = `Draft auto-generado por el brain.

**Gap:** ${gap.type} · "${gap.query || gap.kw}"
**Rationale:** ${gap.rationale || '—'}

**Archivos:**
${generated.map((g) => `- \`${g.path}\` (${g.stats.wordCount}w, ${g.stats.quantData} datos, ${g.stats.extLinks} links, ${g.stats.faqCount} FAQs)`).join('\n')}

⚠️ Aprobación se hace desde Notion (tarea \`[BRAIN DRAFT REVIEW] ${gap.query || gap.kw}\`), no desde este PR. Ver acceptance criteria de la tarea.`;

    const prUrl = await createBranchAndPR({ branchName, files, title: prTitle, body: prBody });

    // Notion review task
    const notionTask = await createNotionReviewTask({ gap, generated, prUrl });

    allDrafts.push({ slug, gap, generated, prUrl, notionTask });
    recentQueries.add(queryKey);

    history.drafts.push({
      ts: new Date().toISOString(),
      gap: { type: gap.type, query: gap.query || gap.kw },
      slug,
      files: generated.map((g) => g.path),
      prUrl,
      branch: branchName,
      notionTaskId: notionTask?.id || null,
      status: 'pending_review',
    });
  }

  await saveHistory(history);

  if (!allDrafts.length) {
    return {
      ok: false, stale: false,
      summary: `Content draft falló: ${allErrors.join(' | ')}`,
      data: null, alerts: allErrors,
    };
  }

  return {
    ok: true, stale: false,
    summary: `Content drafts generados: ${allDrafts.length} (${allDrafts.map((d) => `"${d.gap.query || d.gap.kw}"`).join(', ')})`,
    data: { generated: allDrafts, drafts: allDrafts, gap: allDrafts[0].gap, prUrl: allDrafts[0].prUrl },
    alerts: allErrors,
  };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'agent-state.json'), 'utf8'));
  // Para CLI: tomar gap manualmente o usar uno hardcoded de test
  const testGap = process.argv[2]
    ? { type: 'content_gap', query: process.argv[2], action: 'create-content', rationale: 'CLI test' }
    : { type: 'content_gap', query: 'donde quedarse en medellín', volume: 8000, kd: 35, action: 'create-content', rationale: 'High-volume head keyword, aggressive multi-tier strategy.' };
  const r = await runContentDraftGenerator(state, { data: { gaps: [testGap] } });
  console.log(JSON.stringify(r, null, 2));
}
