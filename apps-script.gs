/**
 * Privacute Privacy Pulse - response collector
 * ---------------------------------------------------------------
 * This runs inside a Google Sheet (Extensions > Apps Script) and
 * receives each survey submission, appending one row per response.
 *
 * Deploy steps are in README.md. Short version:
 *   Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *   Copy the /exec URL into index.html  ->  CONFIG.ENDPOINT
 * ---------------------------------------------------------------
 */

var SHEET_NAME = 'Responses';

// Column order for the sheet. Covers every question id across all
// personas, so each response fills the ones it has and leaves the
// rest blank. Add a new question id here if you add questions.
var COLUMNS = [
  'submittedAt', 'persona', 'readiness_pct',
  'role', 'trigger', 'posture',
  'decisionmaker', 'budget', 'offshore', 'transit_o', 'rest_o', 'baa_o',
  'thirdparty', 'ba_program', 'dlp', 'evidence',
  'weak', 'rest_s', 'access', 'ir',
  'asked', 'lostdeal', 'baa_v', 'proof_v',
  'open',
  'name', 'email', 'org', 'consent'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // avoid two submissions writing the same instant
  try {
    var data = JSON.parse(e.postData.contents);
    var answers = data.answers || {};
    var sheet = getSheet_();
    var row = COLUMNS.map(function (col) {
      // top-level fields (submittedAt, persona, readiness_pct, name, email, org, consent)
      if (Object.prototype.hasOwnProperty.call(data, col) && col !== 'answers') {
        return data[col];
      }
      // question answers (role, trigger, posture, ...)
      if (Object.prototype.hasOwnProperty.call(answers, col)) {
        return answers[col];
      }
      return '';
    });
    sheet.appendRow(row);

    // Email the respondent a copy of their result, if they gave an address and
    // opted in. Wrapped on its own so a mail failure never blocks the capture:
    // the row is already saved above and we still return ok.
    try { maybeEmailResult_(data); } catch (mailErr) {}

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the /exec URL in a browser to confirm it is live.
function doGet() {
  return json_({ ok: true, msg: 'Privacute Privacy Pulse collector is live' });
}

/* ---------------------------------------------------------------
 * Emails the respondent a copy of their result.
 *
 * Runs only when an email is present AND consent is "yes" (the survey's
 * contact step couples the two: the checkbox okays both the research use
 * and sending the result). The band and copy are built here from
 * readiness_pct; the gap lines are passed in from the client, which
 * already computes them, so the wording lives in one place. Nothing here
 * is written to the sheet: `gaps` is transient, used only for the email.
 *
 * IMPORTANT: MailApp needs an authorization scope the row-only version did
 * not. After pasting this in, redeploy (Manage deployments > edit > New
 * version) or run doGet once from the editor, and approve the new prompt
 * that mentions sending email as you. Until you do, sends fail silently.
 * --------------------------------------------------------------- */
function maybeEmailResult_(data) {
  var email = String(data.email || '').trim();
  var consent = String(data.consent || '').toLowerCase();
  if (!email || consent !== 'yes') return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return; // basic sanity check

  var name = String(data.name || '').trim();
  var pct = data.readiness_pct;
  var hasPct = pct !== '' && pct !== null && pct !== undefined && !isNaN(Number(pct));
  var band = bandLabel_(pct);
  var gaps = Array.isArray(data.gaps) ? data.gaps.slice(0, 5) : [];

  var hello = name ? ('Hi ' + name + ',') : 'Hi,';
  var scoreLine = hasPct
    ? ('Readiness signal: ' + pct + '% of the basics we checked are in place.')
    : 'Thanks for taking the read.';
  var disclaimer = 'This is a self-check to show you where you stand, not a ' +
    'certification or legal advice, and not a substitute for the formal HIPAA ' +
    'risk analysis. Getting audit-ready and being independently certified are ' +
    'two separate steps.';

  // ----- plain-text body (fallback for clients that strip HTML) -----
  var lines = [hello, '', 'Your Privacy Pulse: ' + band + '.', scoreLine];
  if (gaps.length) {
    lines.push('', 'Where to look first:');
    for (var i = 0; i < gaps.length; i++) { lines.push((i + 1) + '. ' + gaps[i]); }
  }
  lines.push('', disclaimer, '',
    'Want to talk it through? Just reply to this email and it reaches us directly.',
    '', 'Patient privacy, made provable.', 'Privacute');
  var textBody = lines.join('\n');

  // ----- HTML body (inline styles; email clients do not read <style>) -----
  var v = '#6D28C9';
  var gapsHtml = '';
  if (gaps.length) {
    var items = '';
    for (var j = 0; j < gaps.length; j++) {
      items += '<tr><td style="padding:9px 0;border-top:1px solid #ece9f4;' +
        'color:#141419;font-size:15px;line-height:1.5;">' +
        '<strong style="color:' + v + ';">' + (j + 1) + '.</strong> ' +
        escapeHtml_(gaps[j]) + '</td></tr>';
    }
    gapsHtml = '<h3 style="color:#141419;font-size:16px;margin:26px 0 4px;">' +
      'Where to look first</h3>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
      'style="border-collapse:collapse;">' + items + '</table>';
  }
  var htmlBody =
    '<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#141419;line-height:1.6;">' +
      '<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:' + v + ';font-weight:bold;margin:0 0 8px;">Your Privacy Pulse</p>' +
      '<p style="margin:0 0 16px;">' + escapeHtml_(hello) + '</p>' +
      '<div style="display:inline-block;background:#f2ecfb;color:' + v + ';font-weight:bold;padding:7px 15px;border-radius:6px;font-size:15px;">' + escapeHtml_(band) + '</div>' +
      '<p style="font-size:16px;margin:16px 0;">' + escapeHtml_(scoreLine) + '</p>' +
      gapsHtml +
      '<p style="font-size:12px;color:#6b6b73;background:#faf9f5;border:1px solid #ece9f4;border-radius:8px;padding:13px 15px;margin:26px 0 0;">' + escapeHtml_(disclaimer) + '</p>' +
      '<p style="font-size:14px;color:#141419;margin:22px 0 0;">Want to talk it through? Just reply to this email and it reaches us directly.</p>' +
      '<p style="font-size:13px;color:#6b6b73;margin:18px 0 0;">Patient privacy, made <strong style="color:' + v + ';">provable</strong>.<br>Privacute</p>' +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: 'Your Privacute Privacy Pulse result',
    body: textBody,
    htmlBody: htmlBody,
    name: 'Privacute'
  });
}

// Mirrors bandFor() in index.html. Keep the thresholds in sync with it.
function bandLabel_(pct) {
  if (pct === '' || pct === null || pct === undefined) return 'Thanks for the read';
  var n = Number(pct);
  if (isNaN(n)) return 'Thanks for the read';
  if (n >= 80) return 'Strong footing';
  if (n >= 45) return 'Solid base, real gaps';
  return 'Meaningful exposure';
}

function escapeHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); }
  if (sheet.getLastRow() === 0) { sheet.appendRow(COLUMNS); } // header row once
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
