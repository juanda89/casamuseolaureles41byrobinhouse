/**
 * Bootstrap photos from Hostaway CDN (account 43085).
 * Spec §12: migrate to Cloudinary in Sprint 3 — keep this module as the
 * single switch point.
 */
import type { UnitSlug } from './constants';

const HOSTAWAY = 'https://bookingenginecdn.hostaway.com/listing';

function img(slug: number, hash: string) {
  return {
    full: `${HOSTAWAY}/43085-${slug}-${hash}?width=1920&quality=80&format=webp&v=2`,
    large: `${HOSTAWAY}/43085-${slug}-${hash}?width=1280&quality=80&format=webp&v=2`,
    card: `${HOSTAWAY}/43085-${slug}-${hash}?width=900&quality=80&format=webp&v=2`,
    thumb: `${HOSTAWAY}/43085-${slug}-${hash}?width=480&quality=75&format=webp&v=2`,
  };
}

export const PHOTOS: Record<UnitSlug, { hero: ReturnType<typeof img>; gallery: ReturnType<typeof img>[] }> = {
  standar: {
    hero: img(485562, 'U0d0jEVXeFZwIBN74Pk9Rc9Tnl8GrqPHKMSM9btvAWo-698a23aa4a8b1'),
    gallery: [
      img(485562, 'U0d0jEVXeFZwIBN74Pk9Rc9Tnl8GrqPHKMSM9btvAWo-698a23aa4a8b1'),
      img(485562, 'R--yY--jA05Fz4VmjitB2fN4inYyJESzhjxgYcKtwTBd0-698a23ab8adec'),
      img(485562, 'ABTa--A2APUgDcWeAYoaplfwlR8QabVvwvRp--5xTC-Ps-698a23a6da1de'),
      img(485562, 'dPNAQG7tfPxu1wRaDzFpZHPMuy6yxrbzM1mPUoMwGTQ-698a23a8695b1'),
      img(485562, '4SP8KLUJVNkDtqXK-rLhfggIfXa--tGSu0tURuUkQUG4-698a7befdcb8d'),
    ],
  },
  familiar: {
    hero: img(486242, 'oYhw3yKKeHHlZu--zD--RAua1LKEprKLYfryaMt-Ai360-698be2cac2add'),
    gallery: [
      img(486242, 'oYhw3yKKeHHlZu--zD--RAua1LKEprKLYfryaMt-Ai360-698be2cac2add'),
      img(486242, 'bC1MvTkAPRdqAVc9a-wbo91KptBPKGycYw-a--j----818-698be2ce7ab9a'),
      img(486242, '2AU--x3RaVG9Sdou6QfWrOBEn0w0aSTN5--CtUHcUSkrU-698bea31a7a8b'),
      img(486242, 'G2L01LNNOA3KyZYUfoN0oJrmFRUxirV3Tf69-nb3zto-698be2cc27add'),
      img(486242, 'kPxmzHb5pjM3zxxhCZOlASe3ZO5i22iPA4E6AfwQ8uc-698be2cd43db4'),
    ],
  },
  deluxe: {
    hero: img(489587, 'k0FRsjz--ZbNHlNlunrTL3lsFTC2NWufe9wh--FOXdOVk-6997d6fbcf12a'),
    gallery: [
      img(489587, 'k0FRsjz--ZbNHlNlunrTL3lsFTC2NWufe9wh--FOXdOVk-6997d6fbcf12a'),
      img(489587, 'QsUeAtW14hZgidbMlyYok7NAQmgiJoiOxDZ1bLffod8-6997d6fa76fc2'),
      img(489587, 'JpDEAJ-vrKA6zNX5IiWpPJVzhBG7Pq--l24oDgt-029k-6997d6f77d9f7'),
      img(489587, '8Y7aE7fUdPU33--6zkObtqgY9kljbb7J--xaydegAkj08-6997d6f92a07b'),
      img(489587, '80xj6UxxyzOAleqQupDNFnEXTzr8Aq7X4JDAoe49bTw-6997d6f602404'),
    ],
  },
};

/** Hero of the homepage — the iconic Deluxe shot (replace with pro photo in Sprint 3). */
export const HOMEPAGE_HERO = PHOTOS.deluxe.hero;

/** Concept-section detail shot (architecture/material). */
export const CONCEPT_DETAIL = PHOTOS.deluxe.gallery[1];
