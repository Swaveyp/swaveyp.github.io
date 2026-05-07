// Source of truth lives in the bound Apps Script project. This is a checked-in reference copy. Update both when changing.

/**
 * Photoshoot booking notification — Apps Script Web App.
 *
 * Deployed as a Web App (Deploy > New deployment > Type: Web app):
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * The wizard on book-photoshoot.html POSTs a JSON body to this endpoint.
 * doPost(e) parses it, sends the styled HTML email to NOTIFY_TO, and
 * (optionally) appends a row to the Google Sheet identified by SHEET_ID.
 *
 * No Google Form is involved.
 */

var NOTIFY_TO = 'support@swavey.biz';
var BRAND_LOGO = 'https://swavey.biz/images/swaveylogo2final.png';
var ACCENT = '#28ABE3';
var ACCENT_DEEP = '#1a8fbf';
var HERO_FROM = '#e8f2fc';
var HERO_TO = '#d4e8f8';
var HERO_TEXT = '#0a1628';
var HERO_LABEL = '#1a8fbf';

// Optional: paste a Google Sheet ID to also append a row per submission.
// Leave as '' to email-only.
var SHEET_ID = '';
var SHEET_TAB = 'Submissions';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: 'No payload' });
    }
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonOut_({ ok: false, error: 'Invalid JSON' });
    }

    var d = {
      fullName:     str_(data.fullName),
      email:        str_(data.email),
      phone:        str_(data.phone),
      shootType:    str_(data.shootType),
      dateOrTime:   str_(data.dateOrTimeframe || data.dateValue),
      timeOfDay:    str_(data.timeOfDay),
      location:     str_(data.location || data.locationPref),
      people:       str_(data.numberOfPeople || data.peopleCount),
      budget:       str_(data.budget),
      workedBefore: str_(data.workedBefore || data.priorExperience),
      heard:        str_(data.heardAbout || data.referral),
      inspiration:  str_(data.inspirationLinks),
      visionText:   str_(data.vision),
      additional:   str_(data.additionalDetails),
      shootSpecific: normalizeShootSpecific_(data.shootSpecific)
    };

    var subject = '🎬 New Photoshoot Booking — ' + (d.shootType || 'Type unknown') + ' — ' + (d.fullName || 'No name');

    var opts = {
      to: NOTIFY_TO,
      subject: subject,
      htmlBody: renderHtml_(d),
      body: renderPlain_(d),
      name: 'Swavey Bookings'
    };
    if (d.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      opts.replyTo = d.email;
    }
    MailApp.sendEmail(opts);

    if (SHEET_ID) {
      try { logToSheet_(d); } catch (sheetErr) {
        console.error('Sheet append failed:', sheetErr && sheetErr.stack ? sheetErr.stack : sheetErr);
      }
    }

    return jsonOut_({ ok: true });
  } catch (err) {
    console.error('doPost failed:', err && err.stack ? err.stack : err);
    return jsonOut_({ ok: false, error: 'Server error' });
  }
}

function doGet() {
  return jsonOut_({ ok: true, service: 'Swavey photoshoot booking', method: 'POST JSON to this URL' });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function str_(v) {
  if (v == null) return '';
  return String(v).trim();
}

function normalizeShootSpecific_(raw) {
  if (!raw || typeof raw !== 'object') return [];
  var out = [];
  Object.keys(raw).forEach(function(k) {
    var v = raw[k];
    if (v == null || String(v).trim() === '') return;
    out.push({ label: k, value: String(v).trim() });
  });
  return out;
}

function logToSheet_(d) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) sh = ss.insertSheet(SHEET_TAB);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp','Name','Email','Phone','Shoot Type','Date/Timeframe','Time of Day','Location','People','Budget','Worked Before','Heard','Inspiration','Vision','Shoot-Specific','Additional Notes']);
  }
  var ss_text = d.shootSpecific.map(function(it) { return it.label + ': ' + it.value; }).join('\n');
  sh.appendRow([
    new Date(),
    d.fullName, d.email, d.phone,
    d.shootType, d.dateOrTime, d.timeOfDay, d.location, d.people,
    d.budget, d.workedBefore, d.heard,
    d.inspiration, d.visionText, ss_text, d.additional
  ]);
}

function renderHtml_(d) {
  var rows = [
    ['Name', d.fullName],
    ['Email', d.email ? '<a href="mailto:' + esc_(d.email) + '" style="color:' + ACCENT + ';text-decoration:none;">' + esc_(d.email) + '</a>' : ''],
    ['Phone', d.phone ? '<a href="tel:' + esc_(d.phone.replace(/[^0-9+]/g, '')) + '" style="color:' + ACCENT + ';text-decoration:none;">' + esc_(d.phone) + '</a>' : ''],
    ['Shoot Type', d.shootType],
    ['Date / Timeframe', d.dateOrTime],
    ['Time of Day', d.timeOfDay],
    ['Location', d.location],
    ['Number of People', d.people],
    ['Budget', d.budget],
    ['Worked w/ photographer before?', d.workedBefore],
    ['How they heard', d.heard]
  ];

  var rowHtml = rows
    .filter(function(r) { return r[1]; })
    .map(function(r) {
      return ''
        + '<tr>'
        + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#64748b;width:42%;vertical-align:top;">' + esc_(r[0]) + '</td>'
        + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:14px;color:#0f172a;font-weight:600;">' + r[1] + '</td>'
        + '</tr>';
    })
    .join('');

  var specificHtml = '';
  if (d.shootSpecific && d.shootSpecific.length) {
    specificHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Shoot-Specific Details</h3>'
      + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">'
      + d.shootSpecific.map(function(item) {
          return ''
            + '<tr>'
            + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#64748b;width:42%;vertical-align:top;">' + esc_(item.label) + '</td>'
            + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:14px;color:#0f172a;font-weight:600;">' + esc_(item.value) + '</td>'
            + '</tr>';
        }).join('')
      + '</table>';
  }

  var visionHtml = '';
  if (d.visionText) {
    visionHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Vision</h3>'
      + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">' + esc_(d.visionText) + '</p>';
  }

  var inspirationHtml = '';
  if (d.inspiration) {
    var linksLinkified = esc_(d.inspiration).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:' + ACCENT + ';" target="_blank" rel="noopener">$1</a>');
    inspirationHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Inspiration Links</h3>'
      + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">' + linksLinkified + '</p>';
  }

  var additionalHtml = '';
  if (d.additional) {
    additionalHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Additional Notes</h3>'
      + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">' + esc_(d.additional) + '</p>';
  }

  return ''
    + '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">'
    + '<tr><td align="center" style="padding:32px 12px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">'
    + '<tr><td style="background:linear-gradient(135deg,' + HERO_FROM + ' 0%,' + HERO_TO + ' 100%);padding:36px 32px;text-align:center;">'
    + '<img src="' + BRAND_LOGO + '" alt="Swavey Services" width="140" style="display:inline-block;max-width:140px;height:auto;">'
    + '<p style="margin:18px 0 0;color:' + HERO_LABEL + ';font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">New Photoshoot Booking</p>'
    + '<h1 style="margin:8px 0 0;color:' + HERO_TEXT + ';font-size:24px;font-weight:700;">' + esc_(d.shootType || 'Photoshoot Request') + '</h1>'
    + '</td></tr>'
    + '<tr><td style="padding:32px;">'
    + '<h3 style="margin:0 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Client</h3>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">' + rowHtml + '</table>'
    + visionHtml
    + inspirationHtml
    + specificHtml
    + additionalHtml
    + '</td></tr>'
    + '<tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">'
    + '<p style="margin:0;font-size:12px;color:#64748b;">Reply directly to this email to reach the client.</p>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr>'
    + '</table></body></html>';
}

function renderPlain_(d) {
  var lines = [];
  lines.push('NEW PHOTOSHOOT BOOKING');
  lines.push('======================');
  lines.push('');
  lines.push('CLIENT');
  if (d.fullName)     lines.push('  Name:                 ' + d.fullName);
  if (d.email)        lines.push('  Email:                ' + d.email);
  if (d.phone)        lines.push('  Phone:                ' + d.phone);
  lines.push('');
  lines.push('SHOOT');
  if (d.shootType)    lines.push('  Type:                 ' + d.shootType);
  if (d.dateOrTime)   lines.push('  Date / Timeframe:     ' + d.dateOrTime);
  if (d.timeOfDay)    lines.push('  Time of Day:          ' + d.timeOfDay);
  if (d.location)     lines.push('  Location:             ' + d.location);
  if (d.people)       lines.push('  Number of People:     ' + d.people);
  if (d.budget)       lines.push('  Budget:               ' + d.budget);
  if (d.workedBefore) lines.push('  Prior experience:     ' + d.workedBefore);
  if (d.heard)        lines.push('  Heard via:            ' + d.heard);

  if (d.visionText) {
    lines.push('');
    lines.push('VISION');
    lines.push(d.visionText);
  }
  if (d.inspiration) {
    lines.push('');
    lines.push('INSPIRATION LINKS');
    lines.push(d.inspiration);
  }
  if (d.shootSpecific && d.shootSpecific.length) {
    lines.push('');
    lines.push('SHOOT-SPECIFIC');
    d.shootSpecific.forEach(function(item) {
      lines.push('  ' + item.label + ': ' + item.value);
    });
  }
  if (d.additional) {
    lines.push('');
    lines.push('ADDITIONAL NOTES');
    lines.push(d.additional);
  }
  lines.push('');
  lines.push('— Reply directly to this email to reach the client.');
  return lines.join('\n');
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
