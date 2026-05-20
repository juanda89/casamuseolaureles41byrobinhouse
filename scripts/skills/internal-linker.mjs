#!/usr/bin/env node
/**
 * Internal linker.
 *
 * Lee todos los blog posts publicados (draft: false) + las páginas core del sitio,
 * construye índice de keywords→URL, y sugiere 3-5 links internos contextuales
 * cuando se genera un draft nuevo.
 *
 * Inyecta los links en el frontmatter `internal_links` del draft.
 * El template del blog (src/pages/<lang>/blog/[slug].astro) renderea esos links
 * al final del post como "También te puede interesar".
 *
 * También puede correrse standalone para refrescar links de posts existentes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG_BASE = path.join(ROOT, 'site', 'src', 'content', 'blog');

// Páginas core estáticas del sitio (no son blog pero son targets válidos de internal link).
const CORE_PAGES = {
  es: [
    { url: '/es', anchor: 'Casa Museo Laureles', keywords: ['casa museo', 'inicio', 'home', 'reservar'] },
    { url: '/es/laureles', anchor: 'Guía completa de Laureles', keywords: ['laureles', 'barrio', 'medellín', 'donde quedarse', 'guía'] },
    { url: '/es/faq', anchor: 'Preguntas frecuentes', keywords: ['faq', 'preguntas', 'políticas', 'cancelación'] },
    { url: '/es/unidades/standar', anchor: 'Loft Standar (2 huéspedes)', keywords: ['standar', 'loft', '2 personas', 'pareja'] },
    { url: '/es/unidades/familiar', anchor: 'Loft Familiar (4 huéspedes)', keywords: ['familiar', '4 personas', 'familia', 'grupo'] },
    { url: '/es/unidades/deluxe', anchor: 'Loft Deluxe con Jacuzzi', keywords: ['deluxe', 'jacuzzi', 'romántico', 'lujo'] },
    { url: '/es/contacto', anchor: 'Contacto y WhatsApp', keywords: ['contacto', 'whatsapp', 'reservas'] },
  ],
  en: [
    { url: '/en', anchor: 'Casa Museo Laureles', keywords: ['casa museo', 'home', 'book'] },
    { url: '/en/laureles', anchor: 'Complete Laureles guide', keywords: ['laureles', 'neighborhood', 'medellín', 'where to stay', 'guide'] },
    { url: '/en/faq', anchor: 'Frequently asked questions', keywords: ['faq', 'questions', 'policy', 'cancellation'] },
    { url: '/en/units/standard', anchor: 'Standard Loft (2 guests)', keywords: ['standard', 'loft', '2 people', 'couple'] },
    { url: '/en/units/family', anchor: 'Family Loft (4 guests)', keywords: ['family', '4 people', 'group'] },
    { url: '/en/units/deluxe', anchor: 'Deluxe Loft with Jacuzzi', keywords: ['deluxe', 'jacuzzi', 'romantic', 'luxury'] },
    { url: '/en/contact', anchor: 'Contact & WhatsApp', keywords: ['contact', 'whatsapp', 'booking'] },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const body = m[2];
  const get = (key) => {
    const r = new RegExp(`^${key}:\\s*["']?(.+?)["']?$`, 'm');
    const x = fm.match(r);
    return x ? x[1].trim() : null;
  };
  const getArr = (key) => {
    const r = new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm');
    const x = fm.match(r);
    if (!x) return [];
    return x[1].split(',').map((s) => s.replace(/["']/g, '').trim()).filter(Boolean);
  };
  return {
    title: get('title'),
    slug: get('slug'),
    lang: get('lang'),
    description: get('description'),
    primaryKeyword: get('primary_keyword'),
    secondaryKeywords: getArr('secondary_keywords'),
    tags: getArr('tags'),
    draft: /^draft:\s*true\b/m.test(fm),
    fm, body,
    raw: md,
  };
}

async function listBlogPosts(lang) {
  const dir = path.join(BLOG_BASE, lang);
  try {
    const files = await fs.readdir(dir);
    const posts = [];
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(dir, f), 'utf8');
      const parsed = parseFrontmatter(content);
      if (!parsed) continue;
      parsed.filePath = path.join(dir, f);
      posts.push(parsed);
    }
    return posts;
  } catch {
    return [];
  }
}

function tokenize(text) {
  return (text || '').toLowerCase()
    .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c]))
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function relevance(targetKeywords, draftKeywords) {
  const setT = new Set(targetKeywords.flatMap(tokenize));
  const setD = new Set(draftKeywords.flatMap(tokenize));
  let overlap = 0;
  for (const t of setT) if (setD.has(t)) overlap++;
  return overlap;
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

export async function suggestInternalLinks({ draftPath, lang, max = 5 }) {
  const draftContent = await fs.readFile(draftPath, 'utf8');
  const draft = parseFrontmatter(draftContent);
  if (!draft) return [];

  const draftKeywords = [
    draft.primaryKeyword,
    ...(draft.secondaryKeywords || []),
    ...(draft.tags || []),
    draft.title || '',
  ].filter(Boolean);

  const candidates = [];

  // Páginas core del sitio
  for (const page of (CORE_PAGES[lang] || [])) {
    const score = relevance(page.keywords, draftKeywords);
    if (score > 0) {
      candidates.push({ url: page.url, anchor: page.anchor, score, source: 'core' });
    }
  }

  // Otros blog posts del mismo idioma (excluyendo el draft mismo)
  const allPosts = await listBlogPosts(lang);
  for (const post of allPosts) {
    if (post.slug === draft.slug) continue;
    if (post.draft) continue; // solo posts publicados
    const postKeywords = [post.primaryKeyword, ...(post.secondaryKeywords || []), ...(post.tags || [])];
    const score = relevance(postKeywords, draftKeywords);
    if (score > 0) {
      candidates.push({
        url: `/${lang}/blog/${post.slug}`,
        anchor: post.title,
        score,
        source: 'blog',
      });
    }
  }

  // Top N por score
  return candidates.sort((a, b) => b.score - a.score).slice(0, max);
}

/**
 * Inyecta o reemplaza el bloque internal_links en el frontmatter de un .md.
 */
export async function applyInternalLinksToDraft({ draftPath, lang, max = 5 }) {
  const links = await suggestInternalLinks({ draftPath, lang, max });
  if (!links.length) return { updated: false, links: [] };

  const original = await fs.readFile(draftPath, 'utf8');
  const m = original.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { updated: false, links };
  let fm = m[1];
  const body = m[2];

  // Remover bloque internal_links existente si lo hubiera
  fm = fm.replace(/^internal_links:[\s\S]*?(?=\n[a-z_]+:\s|\n*$)/m, '').trimEnd();

  // Construir nuevo bloque YAML
  const block = '\ninternal_links:\n' + links.map((l) =>
    `  - url: "${l.url}"\n    anchor: ${JSON.stringify(l.anchor)}`
  ).join('\n');

  const newFm = fm + block;
  const newContent = `---\n${newFm}\n---\n${body}`;
  await fs.writeFile(draftPath, newContent);
  return { updated: true, links };
}

export async function runInternalLinker() {
  // Run standalone: para cada draft (incluso draft:true), sugerí internal_links.
  // Útil al final del weekly-agent después de generar drafts nuevos.
  const updates = [];
  for (const lang of ['es', 'en']) {
    const posts = await listBlogPosts(lang);
    for (const post of posts) {
      const r = await applyInternalLinksToDraft({ draftPath: post.filePath, lang, max: 5 });
      if (r.updated) {
        updates.push({ lang, slug: post.slug, linksAdded: r.links.length });
      }
    }
  }
  return {
    ok: true,
    stale: updates.length === 0,
    summary: `Internal linker: ${updates.length} posts actualizados con links internos`,
    data: { updates },
    alerts: [],
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await runInternalLinker();
  console.log(JSON.stringify(r, null, 2));
}
