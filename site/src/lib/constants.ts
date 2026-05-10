/**
 * Casa Museo · Casa Laureles 41 — constants
 * Source of truth: Landing_CasaLaureles41.docx §20.6 + datos verificados mayo 2026.
 * NO editar sin actualizar también el .docx y la documentación de marca.
 */

export const SITE = {
  url: 'https://casamuseolaureles.com',
  name: 'Casa Laureles 41 by Robin House',
  shortName: 'Casa Museo',
  description: {
    es: 'Lofts boutique en Laureles, Medellín. Diseñados por Robin House. Casa Museo: vivir Medellín como una obra de arte.',
    en: 'Boutique lofts in Laureles, Medellín. Designed by Robin House. Casa Museo: live Medellín like a work of art.',
  },
} as const;

export const NAP = {
  streetAddress: 'Tv. 41 #73-42',
  locality: 'Medellín',
  region: 'Antioquia',
  postalCode: '050031',
  country: 'CO',
  countryName: { es: 'Colombia', en: 'Colombia' },
  neighborhood: { es: 'Laureles - Estadio', en: 'Laureles - Estadio' },
  geo: { lat: 6.2476716, lng: -75.5928653 },
  gmapsUrl: 'https://maps.app.goo.gl/HubC8W76MZEjB2js5',
  phone: '+573117337110',
  phoneDisplay: '+57 311 733 7110',
  whatsapp: '573117337110',
  email: 'hello@casamuseolaureles.com',
  emailOperator: 'hello@housyhost.com',
} as const;

export const PARENT = {
  name: 'Robin House',
  url: 'https://robinhouse.co',
  instagram: 'robinhouse.co',
  instagramUrl: 'https://www.instagram.com/robinhouse.co',
} as const;

export const SOCIAL = {
  instagram: 'casalaureles41',
  instagramUrl: 'https://www.instagram.com/casalaureles41',
} as const;

export const BOOKING = {
  base: 'https://booking.housyhost.com',
  hostawayAccountId: 43085,
} as const;

export type UnitSlug = 'standar' | 'familiar' | 'deluxe';

export const UNITS: Record<UnitSlug, {
  id: number;
  slug: UnitSlug;
  enSlug: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  bed: { es: string; en: string };
  name: { es: string; en: string };
  shortName: { es: string; en: string };
  tagline: { es: string; en: string };
  highlight: { es: string; en: string } | null;
  amenities: { icon: string; es: string; en: string }[];
}> = {
  standar: {
    id: 485562,
    slug: 'standar',
    enSlug: 'standard',
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    bed: { es: 'Cama Queen', en: 'Queen bed' },
    name: { es: 'Casa Museo · Standar', en: 'Casa Museo · Standard' },
    shortName: { es: 'Standar', en: 'Standard' },
    tagline: {
      es: 'Loft curado para dos. Diseño tranquilo, funcional y luminoso.',
      en: 'A curated loft for two. Calm, functional, and full of light.',
    },
    highlight: null,
    amenities: [
      { icon: 'wifi', es: 'WiFi de alta velocidad', en: 'High-speed Wi-Fi' },
      { icon: 'snowflake', es: 'Aire acondicionado', en: 'Air conditioning' },
      { icon: 'utensils', es: 'Kitchenette equipada', en: 'Equipped kitchenette' },
      { icon: 'waves', es: 'Piscina compartida', en: 'Shared pool' },
    ],
  },
  familiar: {
    id: 486242,
    slug: 'familiar',
    enSlug: 'family',
    maxGuests: 4,
    bedrooms: 1,
    bathrooms: 1,
    bed: { es: 'Dos camas', en: 'Two beds' },
    name: { es: 'Casa Museo · Familiar', en: 'Casa Museo · Family' },
    shortName: { es: 'Familiar', en: 'Family' },
    tagline: {
      es: 'Espacio amplio para hasta cuatro. Mismo lujo orgánico, doble capacidad.',
      en: 'Spacious for up to four. Same organic luxury, double capacity.',
    },
    highlight: { es: 'Para grupos', en: 'For groups' },
    amenities: [
      { icon: 'users', es: 'Hasta 4 huéspedes', en: 'Up to 4 guests' },
      { icon: 'wifi', es: 'WiFi de alta velocidad', en: 'High-speed Wi-Fi' },
      { icon: 'snowflake', es: 'Aire acondicionado', en: 'Air conditioning' },
      { icon: 'waves', es: 'Piscina compartida', en: 'Shared pool' },
    ],
  },
  deluxe: {
    id: 489587,
    slug: 'deluxe',
    enSlug: 'deluxe',
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    bed: { es: 'Cama Queen', en: 'Queen bed' },
    name: { es: 'Casa Museo · Deluxe Jacuzzi', en: 'Casa Museo · Deluxe Jacuzzi' },
    shortName: { es: 'Deluxe Jacuzzi', en: 'Deluxe Jacuzzi' },
    tagline: {
      es: 'Loft con jacuzzi privado. La experiencia más íntima de la casa.',
      en: 'Loft with a private jacuzzi. The most intimate stay of the house.',
    },
    highlight: { es: 'Más reservada', en: 'Most booked' },
    amenities: [
      { icon: 'bath', es: 'Jacuzzi privado', en: 'Private jacuzzi' },
      { icon: 'wifi', es: 'WiFi de alta velocidad', en: 'High-speed Wi-Fi' },
      { icon: 'snowflake', es: 'Aire acondicionado', en: 'Air conditioning' },
      { icon: 'waves', es: 'Piscina compartida', en: 'Shared pool' },
    ],
  },
} as const;

export const UNIT_ORDER: UnitSlug[] = ['standar', 'deluxe', 'familiar'];

export const POLICIES = {
  checkIn: '15:00',
  checkOut: '11:00',
  cancellation: {
    full: 14, // días antes para 100% reembolso
    half: 7,  // días antes para 50% reembolso
  },
  longStay: [
    { nights: 7, discount: 0.15 },
    { nights: 28, discount: 0.30 },
  ],
  pets: false,
  smoking: false,
  parking: 'no-private', // 'no-private' | 'private' — Casa Laureles 41 no tiene parqueo privado
} as const;

export const ANALYTICS = {
  ga4Id: import.meta.env.PUBLIC_GA4_ID ?? '',
  gtmId: import.meta.env.PUBLIC_GTM_ID ?? '',
  gbpPlaceId: import.meta.env.PUBLIC_GBP_PLACE_ID ?? '',
} as const;

export type Locale = 'es' | 'en';

export const LOCALES: Locale[] = ['es', 'en'];
