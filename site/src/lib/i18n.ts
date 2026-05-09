import es from '../i18n/es.json';
import en from '../i18n/en.json';
import type { Locale } from './constants';

const dicts = { es, en } as const;

export type Dict = typeof es;

export function t(locale: Locale): Dict {
  return dicts[locale];
}

export function altLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}

export function localizedHref(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `/${locale}${clean ? `/${clean}` : ''}`;
}

/** Switch the current path to its equivalent in the other locale. */
export function altPath(currentPath: string): string {
  const seg = currentPath.split('/').filter(Boolean);
  if (seg.length === 0) return '/en';
  const [first, ...rest] = seg;
  if (first === 'es') return '/' + ['en', ...mapEsToEn(rest)].join('/');
  if (first === 'en') return '/' + ['es', ...mapEnToEs(rest)].join('/');
  return currentPath;
}

const ES_TO_EN: Record<string, string> = {
  unidades: 'units',
  contacto: 'contact',
  privacidad: 'privacy',
  terminos: 'terms',
  cancelacion: 'cancellation',
  cookies: 'cookies',
  laureles: 'laureles',
  faq: 'faq',
  blog: 'blog',
  reservar: 'book',
  standar: 'standard',
  familiar: 'family',
  deluxe: 'deluxe',
};

const EN_TO_ES: Record<string, string> = Object.fromEntries(
  Object.entries(ES_TO_EN).map(([k, v]) => [v, k]),
);

function mapEsToEn(parts: string[]): string[] {
  return parts.map((p) => ES_TO_EN[p] ?? p);
}
function mapEnToEs(parts: string[]): string[] {
  return parts.map((p) => EN_TO_ES[p] ?? p);
}
