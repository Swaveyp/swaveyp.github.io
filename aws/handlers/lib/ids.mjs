import crypto from 'node:crypto';

export function newBookingId() {
  return crypto.randomUUID();
}

export function pkFor(id) { return `BOOKING#${id}`; }
export const SK = 'META';

export function gsi1For(status, submittedAt, pk) {
  return {
    gsi1pk: `STATUS#${status}`,
    gsi1sk: `${submittedAt}#${pk}`
  };
}

// gsi2 is only set when status=confirmed AND eventDate is present.
export function gsi2For(type, eventDate, pk) {
  if (!eventDate) return null;
  return {
    gsi2pk: `STATUS#confirmed#TYPE#${type}`,
    gsi2sk: `${eventDate}#${pk}`
  };
}
