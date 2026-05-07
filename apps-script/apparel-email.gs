// Source of truth lives in the bound Apps Script project. This is a checked-in reference copy. Update both when changing.

/**
 * Apparel order notification — Apps Script Web App.
 *
 * Deployed as a Web App (Deploy > New deployment > Type: Web app):
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * The apparel form on contact.html POSTs a JSON body to this endpoint.
 * doPost(e) parses it, sends the styled HTML email to NOTIFY_TO, and
 * (optionally) appends a row to the Google Sheet identified by SHEET_ID.
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
var SHEET_ID = '';
var SHEET_TAB = 'Orders';

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
      fullName: str_(data.name || data.fullName),
      email:    str_(data.email),
      phone:    str_(data.phone),
      inquiry:  str_(data.inquiry),
      details:  str_(data.details),
      shipping: str_(data.shipping),
      address:  str_(data.address),
      city:     str_(data.city),
      state:    str_(data.state),
      zip:      str_(data.zip)
    };

    var subject = '👕 New Apparel Order — ' + (d.inquiry || 'Inquiry') + ' — ' + (d.fullName || 'No name');

    var opts = {
      to: NOTIFY_TO,
      subject: subject,
      htmlBody: renderHtml_(d),
      body: renderPlain_(d),
      name: 'Swavey Orders'
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
  return jsonOut_({ ok: true, service: 'Swavey apparel orders', method: 'POST JSON to this URL' });
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

function logToSheet_(d) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) sh = ss.insertSheet(SHEET_TAB);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp','Name','Email','Phone','Inquiry','Details','Shipping','Address','City','State','Zip']);
  }
  sh.appendRow([
    new Date(),
    d.fullName, d.email, d.phone,
    d.inquiry, d.details,
    d.shipping, d.address, d.city, d.state, d.zip
  ]);
}

function renderHtml_(d) {
  var rows = [
    ['Name', d.fullName],
    ['Email', d.email ? '<a href="mailto:' + esc_(d.email) + '" style="color:' + ACCENT + ';text-decoration:none;">' + esc_(d.email) + '</a>' : ''],
    ['Phone', d.phone ? '<a href="tel:' + esc_(d.phone.replace(/[^0-9+]/g, '')) + '" style="color:' + ACCENT + ';text-decoration:none;">' + esc_(d.phone) + '</a>' : ''],
    ['Inquiry', d.inquiry]
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

  var detailsHtml = '';
  if (d.details) {
    detailsHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Order Details</h3>'
      + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">' + esc_(d.details) + '</p>';
  }

  var shippingHtml = '';
  if (d.shipping === 'Yes') {
    var addrLine = [d.address, d.city, d.state, d.zip].filter(function(x) { return x; }).join(', ');
    shippingHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Shipping</h3>'
      + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">' + esc_(addrLine || '(address not provided)') + '</p>';
  } else if (d.shipping === 'No') {
    shippingHtml = ''
      + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Shipping</h3>'
      + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">Local pickup / no shipping required.</p>';
  }

  return ''
    + '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">'
    + '<tr><td align="center" style="padding:32px 12px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">'
    + '<tr><td style="background:linear-gradient(135deg,' + HERO_FROM + ' 0%,' + HERO_TO + ' 100%);padding:36px 32px;text-align:center;">'
    + '<img src="' + BRAND_LOGO + '" alt="Swavey Services" width="220" style="display:inline-block;max-width:220px;height:auto;">'
    + '<p style="margin:18px 0 0;color:' + HERO_LABEL + ';font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">New Apparel Order</p>'
    + '<h1 style="margin:8px 0 0;color:' + HERO_TEXT + ';font-size:24px;font-weight:700;">' + esc_(d.inquiry || 'Order Request') + '</h1>'
    + '</td></tr>'
    + '<tr><td style="padding:32px;">'
    + '<h3 style="margin:0 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + ACCENT + ';font-weight:700;">Customer</h3>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">' + rowHtml + '</table>'
    + detailsHtml
    + shippingHtml
    + '</td></tr>'
    + '<tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">'
    + '<p style="margin:0;font-size:12px;color:#64748b;">Reply directly to this email to reach the customer.</p>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr>'
    + '</table></body></html>';
}

function renderPlain_(d) {
  var lines = [];
  lines.push('NEW APPAREL ORDER');
  lines.push('=================');
  lines.push('');
  lines.push('CUSTOMER');
  if (d.fullName) lines.push('  Name:     ' + d.fullName);
  if (d.email)    lines.push('  Email:    ' + d.email);
  if (d.phone)    lines.push('  Phone:    ' + d.phone);
  if (d.inquiry)  lines.push('  Inquiry:  ' + d.inquiry);

  if (d.details) {
    lines.push('');
    lines.push('DETAILS');
    lines.push(d.details);
  }

  lines.push('');
  lines.push('SHIPPING');
  if (d.shipping === 'Yes') {
    if (d.address) lines.push('  ' + d.address);
    var cityLine = [d.city, d.state, d.zip].filter(function(x) { return x; }).join(', ');
    if (cityLine) lines.push('  ' + cityLine);
  } else {
    lines.push('  Local pickup / no shipping required.');
  }

  lines.push('');
  lines.push('— Reply directly to this email to reach the customer.');
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
