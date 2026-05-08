// Best-effort conversion of free-text date hints from the wizard into a
// YYYY-MM-DD string usable as a sort key. Returns "" when nothing usable is
// present — the caller skips the gsi2 entry in that case.

const MONTHS = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sept: '09', sep: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12'
};

export function parseDateOrTimeframe(input) {
  if (!input) return '';
  const s = String(input).trim();
  if (!s) return '';

  // Already YYYY-MM-DD or YYYY-MM-DDT...
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // ISO / RFC 3339 fallthrough
  const iso = new Date(s);
  if (!isNaN(iso.getTime()) && /\d{4}/.test(s)) {
    return iso.toISOString().slice(0, 10);
  }

  // "MM/DD/YYYY" or "M/D/YYYY"
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) {
    const mm = m[1].padStart(2, '0'), dd = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }

  // "Month D, YYYY"  or  "Month D YYYY"
  m = s.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
  }

  return '';
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
