#!/usr/bin/env node
/**
 * Image pipeline — modo generic.
 *
 * Cuando se genera un draft de blog, esta skill genera 1 hero image usando
 * OpenAI gpt-image-1 (modelo más estable, gpt-image-2 disponible pero más caro).
 * La imagen se guarda en site/public/blog/<slug>/hero.jpg y se referencia
 * en el frontmatter `hero_image` del .md.
 *
 * Estrategia: archivos PNG/JPEG servidos por Vercel CDN. Sin Cloudinary
 * (no necesario hasta tener >200 imágenes).
 *
 * NO genera fotos del producto/propiedad — eso siempre debe venir del equipo.
 * Solo genera ilustrativas / conceptuales: paisajes Medellín, conceptos abstractos
 * de diseño, mapas estilizados, etc.
 *
 * Env: OPENAI_API_KEY
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC_BLOG = path.join(ROOT, 'site', 'public', 'blog');
const HISTORY_PATH = path.join(ROOT, 'data', 'image-pipeline-history.json');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-image-1';   // gpt-image-2 también disponible pero ~3x más caro
const SIZE = '1536x1024';      // 3:2 aspect — perfecto para hero de blog

// ─────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────

function buildImagePrompt({ title, primaryKeyword, lang }) {
  const styleBase = `Editorial photography style for a boutique design hotel blog. Medellín, Colombia setting. Warm natural light, soft shadows, mid-day sun. Aspirational but authentic — not stocky. No people in close-up faces. No text overlay. Subtle warm color palette: deep terracotta, sage green, cream, dark navy. Visual composition: rule of thirds, breathing room. Avoid neon signs, busy crowds, generic stock imagery.`;

  const conceptES = `Concepto para ilustrar: "${title}". Keyword: ${primaryKeyword}.`;
  const conceptEN = `Concept to illustrate: "${title}". Keyword: ${primaryKeyword}.`;

  return `${lang === 'es' ? conceptES : conceptEN} ${styleBase}`;
}

// ─────────────────────────────────────────────────────────────────
// OpenAI Image API
// ─────────────────────────────────────────────────────────────────

async function generateImage(prompt) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: SIZE,
      n: 1,
      quality: 'high',
      output_format: 'jpeg',
      output_compression: 85,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI Image API ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = await r.json();
  const first = j.data?.[0];
  if (!first) throw new Error('No image returned');
  // gpt-image-1 retorna base64 por default (b64_json)
  if (first.b64_json) {
    return Buffer.from(first.b64_json, 'base64');
  }
  // Si vino URL, descargar
  if (first.url) {
    const imgR = await fetch(first.url);
    return Buffer.from(await imgR.arrayBuffer());
  }
  throw new Error('No image data in response');
}

// ─────────────────────────────────────────────────────────────────
// Frontmatter helpers
// ─────────────────────────────────────────────────────────────────

function parseFrontmatterMeta(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const get = (key) => {
    const r = new RegExp(`^${key}:\\s*["']?(.+?)["']?$`, 'm');
    const x = fm.match(r);
    return x ? x[1].trim() : null;
  };
  return {
    fm, body: m[2],
    slug: get('slug'),
    lang: get('lang'),
    title: get('title'),
    primaryKeyword: get('primary_keyword'),
    hasHeroImage: /^hero_image:\s*\S/m.test(fm),
  };
}

async function applyHeroImageToFrontmatter({ draftPath, imageUrl, alt }) {
  const original = await fs.readFile(draftPath, 'utf8');
  const m = original.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return false;
  let fm = m[1];
  const body = m[2];

  // Remover hero_image y hero_alt previos si existen
  fm = fm.replace(/^hero_image:[^\n]*\n?/m, '');
  fm = fm.replace(/^hero_alt:[^\n]*\n?/m, '');
  fm = fm.replace(/^hero_credit:[^\n]*\n?/m, '');

  // Agregar al final del frontmatter
  fm = fm.trimEnd();
  fm += `\nhero_image: "${imageUrl}"`;
  fm += `\nhero_alt: ${JSON.stringify(alt)}`;
  fm += `\nhero_credit: "Imagen ilustrativa (AI-generated). Foto real próximamente."`;

  await fs.writeFile(draftPath, `---\n${fm}\n---\n${body}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────────

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8')); }
  catch { return { images: [] }; }
}
async function saveHistory(h) { await fs.writeFile(HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }

// ─────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────

/**
 * Genera hero image para un draft específico.
 * Se llama desde content-draft-generator.mjs después de escribir el .md.
 */
export async function generateHeroForDraft({ draftPath }) {
  if (!OPENAI_API_KEY) {
    return { ok: false, error: 'no OPENAI_API_KEY' };
  }

  const original = await fs.readFile(draftPath, 'utf8');
  const meta = parseFrontmatterMeta(original);
  if (!meta) return { ok: false, error: 'frontmatter no parseable' };
  if (meta.hasHeroImage) return { ok: false, error: 'ya tiene hero_image' };

  const prompt = buildImagePrompt({
    title: meta.title || meta.slug,
    primaryKeyword: meta.primaryKeyword || meta.slug,
    lang: meta.lang || 'es',
  });

  let imgBuffer;
  try {
    imgBuffer = await generateImage(prompt);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  // Guardar en site/public/blog/<slug>/hero.jpg
  const outDir = path.join(PUBLIC_BLOG, meta.slug);
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'hero.jpg');
  await fs.writeFile(outPath, imgBuffer);

  const imageUrl = `/blog/${meta.slug}/hero.jpg`;
  const alt = `Ilustración: ${meta.title}`;
  await applyHeroImageToFrontmatter({ draftPath, imageUrl, alt });

  const history = await loadHistory();
  history.images.push({
    ts: new Date().toISOString(),
    slug: meta.slug,
    lang: meta.lang,
    imageUrl,
    prompt,
    sizeBytes: imgBuffer.length,
    model: MODEL,
  });
  if (history.images.length > 200) history.images = history.images.slice(-200);
  await saveHistory(history);

  return { ok: true, imageUrl, sizeBytes: imgBuffer.length };
}

/**
 * Procesa todos los drafts sin hero_image y les genera uno.
 * Útil para correr standalone después de generar drafts.
 */
export async function runImagePipeline() {
  if (!OPENAI_API_KEY) {
    return { ok: false, stale: true, summary: 'Image pipeline: sin OPENAI_API_KEY', data: null, alerts: [] };
  }

  const generated = [];
  const errors = [];

  for (const lang of ['es', 'en']) {
    const dir = path.join(ROOT, 'site', 'src', 'content', 'blog', lang);
    let files;
    try { files = await fs.readdir(dir); } catch { continue; }

    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const filePath = path.join(dir, f);
      const content = await fs.readFile(filePath, 'utf8');
      const meta = parseFrontmatterMeta(content);
      if (!meta || meta.hasHeroImage) continue;

      const r = await generateHeroForDraft({ draftPath: filePath });
      if (r.ok) {
        generated.push({ lang, slug: meta.slug, imageUrl: r.imageUrl, kb: Math.round(r.sizeBytes / 1024) });
      } else {
        errors.push(`${lang}/${meta.slug}: ${r.error}`);
      }
    }
  }

  return {
    ok: true,
    stale: generated.length === 0,
    summary: `Image pipeline: ${generated.length} heros generados`,
    data: { generated },
    alerts: errors,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await runImagePipeline();
  console.log(JSON.stringify(r, null, 2));
}
