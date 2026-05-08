/**
 * Swavey unified email sender — Apps Script Web App.
 * Called by AWS Lambda. Renders styled HTML emails (admin notify / client
 * confirmation / decline) and attaches an .ics calendar invite when the
 * caller passes a `calendar` block.
 *
 * Deploy as Web App: Execute as Me, Who has access: Anyone.
 * Set the shared secret in Script Properties:
 *   File > Project settings > Script properties:
 *       EMAIL_SCRIPT_SHARED_SECRET = <random-long-string>
 */

var BRAND_LOGO  = 'https://swavey.biz/images/swaveylogo2final.png';
var ACCENT      = '#28ABE3';
var ACCENT_DEEP = '#1a8fbf';
var HERO_FROM   = '#e8f2fc';
var HERO_TO     = '#d4e8f8';
var HERO_TEXT   = '#0a1628';
var HERO_LABEL  = '#1a8fbf';
var SUPPORT_EMAIL = 'support@swavey.biz';
var SENDER_NAME_BOOKING = 'Swavey Bookings';
var SENDER_NAME_ORDERS  = 'Swavey Orders';
var IG_SHOTS  = 'https://www.instagram.com/swavey.shots/';
var IG_PRINTS = 'https://www.instagram.com/swaveyprints/';

// =============================================================
// Web entrypoints
// =============================================================
function doGet() {
  return jsonOut_({ ok: true, service: 'swavey email sender' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonOut_({ ok:false, error:'No payload' });
    var body;
    try { body = JSON.parse(e.postData.contents); }
    catch (err) { return jsonOut_({ ok:false, error:'Invalid JSON' }); }

    // Auth
    var expected = PropertiesService.getScriptProperties().getProperty('EMAIL_SCRIPT_SHARED_SECRET');
    if (!expected || !body.secret || body.secret !== expected) {
      return jsonOut_({ ok:false, error:'Unauthorized' });
    }

    var kind = String(body.kind || '');
    var to   = Array.isArray(body.to) ? body.to.filter(Boolean) : (body.to ? [body.to] : []);
    if (!to.length) return jsonOut_({ ok:false, error:'No recipients' });
    var data = body.data || {};
    var calendar = body.calendar || null;
    var replyTo = body.replyTo || (kind.indexOf('admin-notify')>=0 ? (data.email || null) : SUPPORT_EMAIL);

    var rendered = renderForKind_(kind, data);
    if (!rendered) return jsonOut_({ ok:false, error:'Unknown kind: ' + kind });

    var attachments = [];
    if (calendar && /-confirmation$/.test(kind)) {
      var icsText = buildIcs_(calendar, kind, data);
      var filename = (kind.indexOf('photoshoot') === 0 ? 'swavey-photoshoot.ics' : 'swavey-pickup.ics');
      attachments.push(Utilities.newBlob(icsText, 'text/calendar; method=PUBLISH; charset=UTF-8', filename));
    }

    var senderName = (kind.indexOf('apparel') === 0) ? SENDER_NAME_ORDERS : SENDER_NAME_BOOKING;

    GmailApp.sendEmail(to.join(','), rendered.subject, rendered.plain, {
      htmlBody:    rendered.html,
      attachments: attachments,
      name:        senderName,
      replyTo:     replyTo || SUPPORT_EMAIL,
      noReply:     false
    });

    return jsonOut_({ ok:true, sent: to.length });
  } catch (err) {
    console.error('doPost failed:', err && err.stack ? err.stack : err);
    return jsonOut_({ ok:false, error:'Server error' });
  }
}

// =============================================================
// Dispatch
// =============================================================
function renderForKind_(kind, d) {
  switch (kind) {
    case 'photoshoot-admin-notify': return renderPhotoshootAdminNotify_(normPhoto_(d));
    case 'apparel-admin-notify':    return renderApparelAdminNotify_(normApparel_(d));
    case 'photoshoot-confirmation': return renderPhotoshootConfirmation_(normPhoto_(d));
    case 'apparel-confirmation':    return renderApparelConfirmation_(normApparel_(d));
    case 'photoshoot-decline':      return renderDecline_(normPhoto_(d), 'photoshoot');
    case 'apparel-decline':         return renderDecline_(normApparel_(d), 'apparel');
  }
  return null;
}

// =============================================================
// Field normalization (matches what Lambda + admin store)
// =============================================================
function normPhoto_(data) {
  var first = str_(data.firstName);
  var last  = str_(data.lastName);
  var full  = str_(data.fullName) || (first + ' ' + last).trim();
  return {
    id:           str_(data.id),
    firstName:    first,
    fullName:     full,
    email:        str_(data.email),
    phone:        str_(data.phone),
    shootType:    str_(data.shootType),
    dateOrTime:   str_(data.dateOrTimeframe || data.dateValue || data.dateExact || data.dateFlexible),
    timeOfDay:    str_(data.timeOfDay),
    location:     str_(data.location || data.locationPref),
    locationAddr: str_(data.locationAddress),
    people:       str_(data.numberOfPeople || data.peopleCount),
    budget:       str_(data.budget),
    workedBefore: str_(data.workedBefore || data.priorExperience),
    heard:        str_(data.heardAbout || data.referral),
    inspiration:  str_(data.inspirationLinks),
    inspirationImageCount: (Array.isArray(data.inspirationImages) ? data.inspirationImages.length : 0),
    visionText:   str_(data.vision),
    additional:   str_(data.additionalDetails),
    adminNotes:   str_(data.adminNotes),
    scheduledISO: str_(data.scheduledAtISO),
    scheduledHuman: str_(data.scheduledAtHuman),
    shootSpecific: normalizeShootSpecific_(data.shootSpecific)
  };
}
function normApparel_(data) {
  var first = str_(data.firstName);
  var last  = str_(data.lastName);
  var full  = str_(data.fullName) || str_(data.name) || (first + ' ' + last).trim();
  return {
    id:           str_(data.id),
    firstName:    first,
    fullName:     full,
    email:        str_(data.email),
    phone:        str_(data.phone),
    inquiry:      str_(data.inquiry),
    details:      str_(data.details),
    shipping:     str_(data.shipping),
    address:      str_(data.address),
    city:         str_(data.city),
    state:        str_(data.state),
    zip:          str_(data.zip),
    scheduledType:  str_(data.scheduledType),
    scheduledISO:   str_(data.scheduledAtISO),
    scheduledHuman: str_(data.scheduledAtHuman),
    finalPrice:     str_(data.finalPrice),
    adminNotes:     str_(data.adminNotes)
  };
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

// =============================================================
// Photoshoot admin notify
// =============================================================
function renderPhotoshootAdminNotify_(d) {
  var subject = '🎬 New Photoshoot Booking — ' + (d.shootType || 'Type unknown') + ' — ' + (d.fullName || 'No name');
  var rows = [
    ['Name', d.fullName],
    ['Email', linkMail_(d.email)],
    ['Phone', linkPhone_(d.phone)],
    ['Shoot Type', d.shootType],
    ['Date / Timeframe', d.dateOrTime],
    ['Time of Day', d.timeOfDay],
    ['Location', d.location],
    ['Number of People', d.people],
    ['Budget', d.budget],
    ['Worked w/ photographer before?', d.workedBefore],
    ['How they heard', d.heard]
  ];
  var rowHtml = renderRows_(rows);

  var sections = '';
  if (d.visionText)    sections += sectionPara_('Vision', d.visionText);
  if (d.inspirationImageCount > 0) {
    sections += sectionPara_('Inspiration Photos', d.inspirationImageCount + ' uploaded — view in admin panel');
  } else if (d.inspiration) {
    sections += sectionLinks_('Inspiration Links', d.inspiration);
  }
  if (d.shootSpecific && d.shootSpecific.length) {
    sections += sectionTable_('Shoot-Specific Details', d.shootSpecific.map(function(it){return [it.label,it.value];}));
  }
  if (d.additional)    sections += sectionPara_('Additional Notes', d.additional);

  var html = wrapEmail_({
    eyebrow: 'New Photoshoot Booking',
    title:   d.shootType || 'Photoshoot Request',
    body:    sectionTitle_('Client') + tableRows_(rowHtml) + sections,
    footerNote: 'Reply directly to this email to reach the client.'
  });

  var plain = plainPhotoshootAdmin_(d);
  return { subject: subject, html: html, plain: plain };
}

function plainPhotoshootAdmin_(d) {
  var L = [];
  L.push('NEW PHOTOSHOOT BOOKING'); L.push('======================'); L.push('');
  L.push('CLIENT');
  if (d.fullName)     L.push('  Name:                 ' + d.fullName);
  if (d.email)        L.push('  Email:                ' + d.email);
  if (d.phone)        L.push('  Phone:                ' + d.phone);
  L.push(''); L.push('SHOOT');
  if (d.shootType)    L.push('  Type:                 ' + d.shootType);
  if (d.dateOrTime)   L.push('  Date / Timeframe:     ' + d.dateOrTime);
  if (d.timeOfDay)    L.push('  Time of Day:          ' + d.timeOfDay);
  if (d.location)     L.push('  Location:             ' + d.location);
  if (d.people)       L.push('  Number of People:     ' + d.people);
  if (d.budget)       L.push('  Budget:               ' + d.budget);
  if (d.workedBefore) L.push('  Prior experience:     ' + d.workedBefore);
  if (d.heard)        L.push('  Heard via:            ' + d.heard);
  if (d.visionText)   { L.push(''); L.push('VISION'); L.push(d.visionText); }
  if (d.inspirationImageCount > 0) {
    L.push(''); L.push('INSPIRATION PHOTOS'); L.push('  ' + d.inspirationImageCount + ' uploaded — view in admin panel');
  } else if (d.inspiration) {
    L.push(''); L.push('INSPIRATION LINKS'); L.push(d.inspiration);
  }
  if (d.shootSpecific && d.shootSpecific.length) {
    L.push(''); L.push('SHOOT-SPECIFIC');
    d.shootSpecific.forEach(function(it){ L.push('  ' + it.label + ': ' + it.value); });
  }
  if (d.additional)   { L.push(''); L.push('ADDITIONAL NOTES'); L.push(d.additional); }
  L.push(''); L.push('— Reply directly to this email to reach the client.');
  return L.join('\n');
}

// =============================================================
// Apparel admin notify
// =============================================================
function renderApparelAdminNotify_(d) {
  var subject = '👕 New Apparel Order — ' + (d.inquiry || 'Inquiry') + ' — ' + (d.fullName || 'No name');
  var rows = [
    ['Name', d.fullName],
    ['Email', linkMail_(d.email)],
    ['Phone', linkPhone_(d.phone)],
    ['Inquiry', d.inquiry]
  ];
  var rowHtml = renderRows_(rows);

  var sections = '';
  if (d.details) sections += sectionPara_('Order Details', d.details);
  if (d.shipping === 'Yes') {
    var addr = [d.address, d.city, d.state, d.zip].filter(function(x){return x;}).join(', ');
    sections += sectionPara_('Shipping', addr || '(address not provided)');
  } else if (d.shipping === 'No') {
    sections += sectionPara_('Shipping', 'Local pickup / no shipping required.');
  }

  var html = wrapEmail_({
    eyebrow: 'New Apparel Order',
    title:   d.inquiry || 'Order Request',
    body:    sectionTitle_('Customer') + tableRows_(rowHtml) + sections,
    footerNote: 'Reply directly to this email to reach the customer.'
  });

  var plain = plainApparelAdmin_(d);
  return { subject: subject, html: html, plain: plain };
}

function plainApparelAdmin_(d) {
  var L = [];
  L.push('NEW APPAREL ORDER'); L.push('================='); L.push('');
  L.push('CUSTOMER');
  if (d.fullName) L.push('  Name:     ' + d.fullName);
  if (d.email)    L.push('  Email:    ' + d.email);
  if (d.phone)    L.push('  Phone:    ' + d.phone);
  if (d.inquiry)  L.push('  Inquiry:  ' + d.inquiry);
  if (d.details)  { L.push(''); L.push('DETAILS'); L.push(d.details); }
  L.push(''); L.push('SHIPPING');
  if (d.shipping === 'Yes') {
    if (d.address) L.push('  ' + d.address);
    var city = [d.city, d.state, d.zip].filter(function(x){return x;}).join(', ');
    if (city) L.push('  ' + city);
  } else { L.push('  Local pickup / no shipping required.'); }
  L.push(''); L.push('— Reply directly to this email to reach the customer.');
  return L.join('\n');
}

// =============================================================
// Photoshoot CONFIRMATION
// =============================================================
function renderPhotoshootConfirmation_(d) {
  var subject = '✓ Booking Confirmed — ' + (d.shootType || 'Photoshoot') + ' — ' + (d.scheduledHuman || d.dateOrTime || '');
  var first = d.firstName || (d.fullName.split(' ')[0]) || 'there';

  var detailRows = [
    ['Date & Time',          d.scheduledHuman || d.dateOrTime],
    ['Location',             d.locationAddr || d.location],
    ['Shoot Type',           d.shootType],
    ['Number of People',     d.people],
    ['Photographer Contact', '<a href="mailto:'+SUPPORT_EMAIL+'" style="color:'+ACCENT+';">'+SUPPORT_EMAIL+'</a>']
  ];

  var body =
      '<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#0f172a;">'
    +   'Hi '+esc_(first)+', your <strong>'+esc_(d.shootType || 'photoshoot')+'</strong> session is locked in! '
    +   'Here are the confirmed details:'
    + '</p>'
    + sectionTitle_('Confirmed Details')
    + tableRows_(renderRows_(detailRows))
    + sectionTitle_("What's Next")
    + '<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;">'
    +   'Your photographer will reach out about 24 hours before your session to confirm final logistics '
    +   '(meeting spot, parking, weather backup if applicable). If anything changes on your end, '
    +   'just reply to this email and we\'ll sort it out.'
    + '</p>'
    + sectionTitle_('Add to Your Calendar')
    + '<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;">'
    +   'A calendar invite (<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">.ics</code>) '
    +   'is attached to this email — open it on your phone or computer to add this session to '
    +   'Google Calendar, Apple Calendar, or Outlook in one tap.'
    + '</p>';

  if (d.adminNotes) {
    body += sectionPara_('A note from us', d.adminNotes);
  }

  var html = wrapEmail_({
    eyebrow: '✓ Booking Confirmed',
    title:   'You\'re booked!',
    body:    body,
    footerNote: 'Questions? Reply to this email or DM us on Instagram @swavey.shots.'
  });

  var plain = plainPhotoshootConfirm_(d, first);
  return { subject: subject, html: html, plain: plain };
}

function plainPhotoshootConfirm_(d, first) {
  var L = [];
  L.push('✓ BOOKING CONFIRMED'); L.push('===================='); L.push('');
  L.push('Hi ' + first + ', your ' + (d.shootType||'photoshoot') + ' session is locked in!');
  L.push('');
  L.push('CONFIRMED DETAILS');
  if (d.scheduledHuman || d.dateOrTime) L.push('  Date & Time: ' + (d.scheduledHuman||d.dateOrTime));
  if (d.locationAddr || d.location)     L.push('  Location:    ' + (d.locationAddr||d.location));
  if (d.shootType)                      L.push('  Type:        ' + d.shootType);
  if (d.people)                         L.push('  People:      ' + d.people);
  L.push('  Contact:     ' + SUPPORT_EMAIL);
  L.push('');
  L.push('WHAT\'S NEXT');
  L.push('Your photographer will reach out ~24 hours before to confirm final logistics.');
  L.push('');
  L.push('ADD TO CALENDAR');
  L.push('A .ics calendar file is attached — open it on your phone or computer to add the session.');
  if (d.adminNotes) { L.push(''); L.push('A NOTE FROM US'); L.push(d.adminNotes); }
  L.push(''); L.push('Questions? Reply to this email or DM @swavey.shots on Instagram.');
  return L.join('\n');
}

// =============================================================
// Apparel CONFIRMATION
// =============================================================
function renderApparelConfirmation_(d) {
  var subject = '✓ Order Confirmed — ' + (d.inquiry || 'Apparel Order');
  var first = d.firstName || (d.fullName.split(' ')[0]) || 'there';

  var summaryRows = [
    ['Inquiry', d.inquiry],
    ['Details', d.details ? esc_(d.details).replace(/\n/g,'<br>') : '']
  ];

  var body =
      '<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#0f172a;">'
    +   'Hi '+esc_(first)+', your <strong>'+esc_(d.inquiry || 'apparel')+'</strong> order is in the queue! '
    +   'Here\'s a summary so we\'re both on the same page:'
    + '</p>'
    + sectionTitle_('Order Summary')
    + tableRows_(renderRows_(summaryRows));

  if (d.scheduledISO) {
    var label = (d.scheduledType === 'Delivery') ? 'Delivery Details' : 'Pickup Details';
    var addr = [d.address, d.city, d.state, d.zip].filter(function(x){return x;}).join(', ');
    var rows = [
      ['When', d.scheduledHuman || d.scheduledISO],
      ['Where', addr || '(we\'ll confirm the spot via email)']
    ];
    body += sectionTitle_(label) + tableRows_(renderRows_(rows));
  }

  if (d.finalPrice) {
    body += sectionTitle_('Final Pricing')
      + '<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;">'
      +   esc_(d.finalPrice)
      + '</p>';
  }

  if (d.scheduledISO) {
    body += sectionTitle_('Add to Your Calendar')
      + '<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;">'
      +   'A calendar invite (<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">.ics</code>) '
      +   'is attached so you can add this to Google Calendar, Apple Calendar, or Outlook.'
      + '</p>';
  }

  if (d.adminNotes) body += sectionPara_('A note from us', d.adminNotes);

  var html = wrapEmail_({
    eyebrow: '✓ Order Confirmed',
    title:   'You\'re in the queue!',
    body:    body,
    footerNote: 'Questions? Reply to this email or DM us on Instagram @swaveyprints.'
  });

  var plain = plainApparelConfirm_(d, first);
  return { subject: subject, html: html, plain: plain };
}

function plainApparelConfirm_(d, first) {
  var L = [];
  L.push('✓ ORDER CONFIRMED'); L.push('=================='); L.push('');
  L.push('Hi ' + first + ', your ' + (d.inquiry||'apparel') + ' order is in the queue!');
  L.push('');
  L.push('ORDER SUMMARY');
  if (d.inquiry) L.push('  Inquiry: ' + d.inquiry);
  if (d.details) L.push('  Details: ' + d.details);
  if (d.scheduledISO) {
    L.push('');
    L.push((d.scheduledType==='Delivery'?'DELIVERY':'PICKUP') + ' DETAILS');
    L.push('  When:  ' + (d.scheduledHuman||d.scheduledISO));
    var addr = [d.address,d.city,d.state,d.zip].filter(function(x){return x;}).join(', ');
    if (addr) L.push('  Where: ' + addr);
  }
  if (d.finalPrice) { L.push(''); L.push('FINAL PRICING'); L.push('  ' + d.finalPrice); }
  if (d.scheduledISO) { L.push(''); L.push('A .ics calendar file is attached.'); }
  if (d.adminNotes) { L.push(''); L.push('A NOTE FROM US'); L.push(d.adminNotes); }
  L.push(''); L.push('Questions? Reply to this email or DM @swaveyprints on Instagram.');
  return L.join('\n');
}

// =============================================================
// Decline
// =============================================================
function renderDecline_(d, kind) {
  var first = d.firstName || (d.fullName.split(' ')[0]) || 'there';
  var what = (kind === 'photoshoot') ? (d.shootType || 'photoshoot') : (d.inquiry || 'apparel order');
  var subject = (kind === 'photoshoot')
    ? 'About your photoshoot request'
    : 'About your apparel order';

  var body =
      '<p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#0f172a;">Hi '+esc_(first)+',</p>'
    + '<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">'
    +   'Thank you so much for reaching out about a <strong>'+esc_(what)+'</strong> with Swavey. '
    +   'Unfortunately, we\'re not able to take on this booking — either the date doesn\'t work for our schedule '
    +   'or it isn\'t a great fit for our current focus.'
    + '</p>'
    + '<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">'
    +   'We\'d still love to work with you down the road. If your timing or scope changes, '
    +   'reply to this email and we\'ll do our best to make it happen.'
    + '</p>';
  if (d.adminNotes) body += sectionPara_('A note from us', d.adminNotes);

  var html = wrapEmail_({
    eyebrow: 'A quick update',
    title:   'Thanks for your interest',
    body:    body,
    footerNote: 'Stay in touch on Instagram @swavey.shots and @swaveyprints.'
  });

  var plain = 'Hi ' + first + ',\n\nThank you for reaching out about a ' + what + '. '
    + 'Unfortunately we\'re not able to take this on. We\'d still love to work with you '
    + 'down the road — reply if your timing changes.\n\n— Swavey Services';
  return { subject: subject, html: html, plain: plain };
}

// =============================================================
// HTML helpers (shared)
// =============================================================
function wrapEmail_(opt) {
  return ''
    + '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">'
    + '<tr><td align="center" style="padding:32px 12px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">'
    + '<tr><td style="background:linear-gradient(135deg,'+HERO_FROM+' 0%,'+HERO_TO+' 100%);padding:36px 32px;text-align:center;">'
    +   '<img src="'+BRAND_LOGO+'" alt="Swavey Services" width="220" style="display:inline-block;max-width:220px;height:auto;">'
    +   '<p style="margin:18px 0 0;color:'+HERO_LABEL+';font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">'+esc_(opt.eyebrow)+'</p>'
    +   '<h1 style="margin:8px 0 0;color:'+HERO_TEXT+';font-size:24px;font-weight:700;">'+esc_(opt.title)+'</h1>'
    + '</td></tr>'
    + '<tr><td style="padding:32px;">' + opt.body + '</td></tr>'
    + '<tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">'
    +   '<p style="margin:0 0 6px;font-size:12px;color:#64748b;">'+esc_(opt.footerNote||'')+'</p>'
    +   '<p style="margin:0;font-size:11px;color:#94a3b8;">© Swavey Services · '
    +     '<a href="'+IG_SHOTS+'" style="color:'+ACCENT+';text-decoration:none;">@swavey.shots</a> · '
    +     '<a href="'+IG_PRINTS+'" style="color:'+ACCENT+';text-decoration:none;">@swaveyprints</a>'
    +   '</p>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr></table></body></html>';
}

function sectionTitle_(label) {
  return '<h3 style="margin:0 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:'+ACCENT+';font-weight:700;">'+esc_(label)+'</h3>';
}
function sectionPara_(label, text) {
  return ''
    + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:'+ACCENT+';font-weight:700;">'+esc_(label)+'</h3>'
    + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">'+esc_(text)+'</p>';
}
function sectionLinks_(label, text) {
  var linked = esc_(text).replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" style="color:'+ACCENT+';" target="_blank" rel="noopener">$1</a>');
  return ''
    + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:'+ACCENT+';font-weight:700;">'+esc_(label)+'</h3>'
    + '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">'+linked+'</p>';
}
function sectionTable_(label, pairs) {
  return ''
    + '<h3 style="margin:32px 0 12px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:'+ACCENT+';font-weight:700;">'+esc_(label)+'</h3>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">'
    +   pairs.map(function(p){
          return '<tr>'
            + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#64748b;width:42%;vertical-align:top;">'+esc_(p[0])+'</td>'
            + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:14px;color:#0f172a;font-weight:600;">'+esc_(p[1])+'</td>'
            + '</tr>';
        }).join('')
    + '</table>';
}
function tableRows_(rowHtml) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">'+rowHtml+'</table>';
}
function renderRows_(rows) {
  return rows
    .filter(function(r){ return r[1]; })
    .map(function(r){
      return '<tr>'
        + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#64748b;width:42%;vertical-align:top;">'+esc_(r[0])+'</td>'
        + '<td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:14px;color:#0f172a;font-weight:600;">'+r[1]+'</td>'
        + '</tr>';
    })
    .join('');
}
function linkMail_(em)   { return em ? '<a href="mailto:'+esc_(em)+'" style="color:'+ACCENT+';text-decoration:none;">'+esc_(em)+'</a>' : ''; }
function linkPhone_(ph)  { return ph ? '<a href="tel:'+esc_(ph.replace(/[^0-9+]/g,''))+'" style="color:'+ACCENT+';text-decoration:none;">'+esc_(ph)+'</a>' : ''; }

// =============================================================
// .ics generation (RFC 5545)
// =============================================================
function buildIcs_(cal, kind, d) {
  var dtStart = isoToIcsUtc_(cal.startISO);
  var dtEnd   = cal.endISO ? isoToIcsUtc_(cal.endISO) : isoToIcsUtc_(addHours_(cal.startISO, 2));
  var dtStamp = formatIcsUtcDate_(new Date());
  var uidBase = (d && d.id) ? d.id : Utilities.getUuid();
  var uid     = uidBase + '@swavey.biz';
  var summary  = icsEscape_(cal.title || (kind.indexOf('photoshoot')===0 ? 'Swavey Photoshoot' : 'Swavey Pickup'));
  var location = icsEscape_(cal.location || '');
  var desc     = icsEscape_(cal.description || '');

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Swavey Services//Email Sender//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + dtStamp,
    'DTSTART:' + dtStart,
    'DTEND:' + dtEnd,
    'SUMMARY:' + summary,
    'DESCRIPTION:' + desc,
    'LOCATION:' + location,
    'ORGANIZER;CN=Swavey Services:mailto:' + SUPPORT_EMAIL,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: ' + summary,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  // Fold lines >75 octets per RFC 5545 §3.1
  var folded = lines.map(foldIcsLine_).join('\r\n');
  return folded + '\r\n';
}

function isoToIcsUtc_(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error('Invalid ISO date for .ics: ' + iso);
  return formatIcsUtcDate_(d);
}
function formatIcsUtcDate_(d) {
  function p(n){ return n < 10 ? '0'+n : ''+n; }
  return d.getUTCFullYear()
       + p(d.getUTCMonth()+1)
       + p(d.getUTCDate())
       + 'T'
       + p(d.getUTCHours())
       + p(d.getUTCMinutes())
       + p(d.getUTCSeconds())
       + 'Z';
}
function addHours_(iso, h) {
  var d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + h);
  return d.toISOString();
}
function icsEscape_(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
function foldIcsLine_(line) {
  if (line.length <= 75) return line;
  var out = '';
  var i = 0;
  while (i < line.length) {
    if (i === 0) { out += line.substr(i, 75); i += 75; }
    else         { out += '\r\n ' + line.substr(i, 74); i += 74; }
  }
  return out;
}

// =============================================================
// Misc
// =============================================================
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function str_(v) { return v == null ? '' : String(v).trim(); }
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
