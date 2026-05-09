import { BOOKING, UNITS, type UnitSlug } from './constants';

/**
 * Build a Housy Host booking URL with verified params.
 * Format confirmed (mayo 2026):
 *   https://booking.housyhost.com/listings/<id>?start=<YYYY-MM-DD>&end=<YYYY-MM-DD>&numberOfGuests=<N>
 */
export function bookingUrl(
  slug: UnitSlug,
  start: string,
  end: string,
  numberOfGuests: number,
): string {
  const unit = UNITS[slug];
  const guests = Math.min(Math.max(1, numberOfGuests | 0), unit.maxGuests);
  const params = new URLSearchParams({
    start,
    end,
    numberOfGuests: String(guests),
  });
  return `${BOOKING.base}/listings/${unit.id}?${params.toString()}`;
}

/**
 * Auto-select unit when user picks "Cualquiera" / "Any unit".
 * Spec §5.3:
 *   1-2 guests → Standar
 *   3-4 guests → Familiar
 *   5+ guests  → null (caller should redirect to WhatsApp)
 */
export function autoSelectUnit(guests: number): UnitSlug | null {
  if (guests <= 2) return 'standar';
  if (guests <= 4) return 'familiar';
  return null;
}

/** YYYY-MM-DD in local time */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultRange(): { start: string; end: string } {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const fourDays = new Date(today.getTime() + 4 * 86400000);
  return { start: toISODate(tomorrow), end: toISODate(fourDays) };
}
