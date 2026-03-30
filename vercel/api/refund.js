var crypto = require('crypto');
var https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  var REFUND_SECRET = process.env.REFUND_SECRET || '';
  if (!REFUND_SECRET) {
    return res.status(200).send(buildPage('Errore di configurazione', 'REFUND_SECRET non configurato su Vercel.', 'error'));
  }

  // Generate a session token from the secret (deterministic, so we can verify it)
  var SESSION_TOKEN = crypto.createHash('sha256').update('refund-session:' + REFUND_SECRET).digest('hex');

  // Check authentication via cookie or POST login
  var cookies = parseCookies(req.headers.cookie || '');
  var isAuthenticated = cookies.refund_session === SESSION_TOKEN;

  // Handle login POST
  if (req.method === 'POST' && req.body && req.body.password !== undefined) {
    if (req.body.password === REFUND_SECRET) {
      res.setHeader('Set-Cookie', 'refund_session=' + SESSION_TOKEN + '; Path=/api/refund; HttpOnly; Secure; SameSite=Strict; Max-Age=3600');
      res.setHeader('Location', '/api/refund');
      return res.status(303).end();
    } else {
      return res.status(200).send(buildLoginPage('Password non corretta.'));
    }
  }

  // Handle logout
  if (req.query.logout === 'true') {
    res.setHeader('Set-Cookie', 'refund_session=; Path=/api/refund; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return res.status(200).send(buildLoginPage('Sessione terminata.'));
  }

  // Not authenticated: show login
  if (!isAuthenticated) {
    return res.status(200).send(buildLoginPage(''));
  }

  // --- AUTHENTICATED FROM HERE ---

  var KEY_ID = process.env.SATISPAY_KEY_ID;
  var PRIVATE_KEY = (process.env.SATISPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  var paymentId = req.query.paymentId || '';
  var amountParam = req.query.amount || '';
  var action = req.query.action || '';

  // Show form if no paymentId
  if (!paymentId) {
    return res.status(200).send(buildFormPage());
  }

  // Get payment details
  var payment = await satispayRequest('GET', '/g_business/v1/payments/' + paymentId, '', KEY_ID, PRIVATE_KEY);

  if (payment.error || payment.code) {
    return res.status(200).send(buildPage('Errore', 'Impossibile recuperare il pagamento: ' + (payment.message || payment.error || JSON.stringify(payment)), 'error'));
  }

  if (payment.status !== 'ACCEPTED') {
    return res.status(200).send(buildPage('Non rimborsabile', 'Il pagamento ha stato: <strong>' + payment.status + '</strong>. Solo i pagamenti ACCEPTED possono essere rimborsati.', 'error'));
  }

  var paymentAmount = payment.amount_unit || 0;
  var refundAmount = amountParam ? parseInt(amountParam) : paymentAmount;
  var paymentDisplay = (paymentAmount / 100).toFixed(2);
  var refundDisplay = (refundAmount / 100).toFixed(2);

  // Show confirmation if not confirmed
  if (action !== 'confirm') {
    return res.status(200).send(buildConfirmPage(paymentId, payment, paymentDisplay, refundAmount, refundDisplay));
  }

  // Execute refund
  var refundBody = JSON.stringify({
    flow: "REFUND",
    amount_unit: refundAmount,
    currency: payment.currency || "EUR",
    parent_payment_uid: paymentId
  });

  var refundResult = await satispayRequest('POST', '/g_business/v1/payments', refundBody, KEY_ID, PRIVATE_KEY);

  if (refundResult.id && refundResult.status === 'ACCEPTED') {
    return res.status(200).send(buildPage(
      'Rimborso completato!',
      'Rimborso di &euro; ' + refundDisplay + ' eseguito con successo.<br><br>ID rimborso: <code>' + refundResult.id + '</code>',
      'success'
    ));
  } else {
    return res.status(200).send(buildPage(
      'Errore nel rimborso',
      'Satispay ha risposto: ' + (refundResult.message || JSON.stringify(refundResult)),
      'error'
    ));
  }
};

function parseCookies(cookieHeader) {
  var cookies = {};
  cookieHeader.split(';').forEach(function(cookie) {
    var parts = cookie.trim().split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return cookies;
}

function baseStyles() {
  return '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:"DM Sans",sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}' +
    '.card{background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:420px;width:100%;overflow:hidden}' +
    '.header{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:20px 24px;color:#fff;font-size:18px;font-weight:700;display:flex;justify-content:space-between;align-items:center}' +
    '.header a{color:rgba(255,255,255,0.5);font-size:12px;text-decoration:none}' +
    '.header a:hover{color:#fff}' +
    '.body{padding:24px}' +
    '.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}' +
    '.row:last-child{border:none}' +
    '.label{color:#888}.value{font-weight:600;color:#1a1a2e}' +
    '.refund-box{margin-top:16px;background:#fff8f0;border:1px solid #ffe0b2;border-radius:10px;padding:16px;text-align:center}' +
    '.refund-amount{font-size:28px;font-weight:700;color:#e42313;margin:8px 0}' +
    '.btn{display:block;width:100%;margin-top:16px;padding:14px;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer}' +
    '.btn-refund{background:#e42313;color:#fff}.btn-refund:hover{background:#c41f10}' +
    '.btn-primary{background:#1a1a2e;color:#fff}.btn-primary:hover{background:#16213e}' +
    '.btn-cancel{background:none;color:#999;margin-top:8px;padding:10px;font-size:13px}' +
    '.warning{font-size:11px;color:#999;margin-top:12px;text-align:center}' +
    'label{display:block;font-size:13px;color:#888;margin-bottom:4px;margin-top:16px}' +
    'input{width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px}' +
    'input:focus{outline:none;border-color:#1a1a2e}' +
    '.hint{font-size:11px;color:#bbb;margin-top:4px}' +
    '.error-msg{background:#fef0f0;border:1px solid #f5c6cb;color:#dc3545;padding:10px;border-radius:8px;font-size:13px;margin-bottom:12px}' +
    '.icon{font-size:48px;margin-bottom:16px}.msg{font-size:14px;color:#666;line-height:1.6}' +
    '.title{font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:12px}' +
    'code{background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:11px}' +
    '.lock{font-size:32px;margin-bottom:16px}' +
    '</style>';
}

function buildLoginPage(errorMsg) {
  return '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Rimborso Satispay - Login</title>' +
    baseStyles() +
    '</head><body><div class="card">' +
    '<div class="header">Rimborso Satispay</div>' +
    '<div class="body" style="text-align:center">' +
    '<div class="lock">&#128274;</div>' +
    (errorMsg ? '<div class="error-msg">' + errorMsg + '</div>' : '') +
    '<p style="font-size:14px;color:#888;margin-bottom:20px">Inserisci la password per accedere</p>' +
    '<form method="POST" action="/api/refund">' +
    '<input type="password" name="password" placeholder="Password" autofocus required style="text-align:center">' +
    '<button type="submit" class="btn btn-primary" style="margin-top:16px">Accedi</button>' +
    '</form>' +
    '</div></div></body></html>';
}

function buildFormPage() {
  return '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Rimborso Satispay</title>' +
    baseStyles() +
    '</head><body><div class="card">' +
    '<div class="header"><span>Rimborso Satispay</span><a href="?logout=true">Esci</a></div>' +
    '<div class="body">' +
    '<label>Payment ID</label>' +
    '<input type="text" id="pid" placeholder="es. 019d211b-e29c-78c2-...">' +
    '<label>Importo (opzionale, in centesimi)</label>' +
    '<input type="text" id="amt" placeholder="Lascia vuoto per rimborso totale">' +
    '<div class="hint">Es: 9500 = &euro;95.00</div>' +
    '<button class="btn btn-primary" onclick="go()">Cerca pagamento</button>' +
    '</div></div>' +
    '<script>function go(){var p=document.getElementById("pid").value;var a=document.getElementById("amt").value;' +
    'var url="?paymentId="+encodeURIComponent(p);if(a)url+="&amount="+encodeURIComponent(a);window.location.href=url;}</script>' +
    '</body></html>';
}

function buildConfirmPage(paymentId, payment, paymentDisplay, refundAmount, refundDisplay) {
  return '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Conferma Rimborso</title>' +
    baseStyles() +
    '</head><body><div class="card">' +
    '<div class="header"><span>Rimborso Satispay</span><a href="?logout=true">Esci</a></div>' +
    '<div class="body">' +
    '<div class="row"><span class="label">Payment ID</span><span class="value" style="font-size:11px;word-break:break-all">' + paymentId + '</span></div>' +
    '<div class="row"><span class="label">Importo originale</span><span class="value">&euro; ' + paymentDisplay + '</span></div>' +
    '<div class="row"><span class="label">Stato</span><span class="value" style="color:#28a745">' + payment.status + '</span></div>' +
    '<div class="row"><span class="label">Data</span><span class="value">' + (payment.insert_date || '').substring(0, 10) + '</span></div>' +
    (payment.sender && payment.sender.name ? '<div class="row"><span class="label">Cliente</span><span class="value">' + payment.sender.name + '</span></div>' : '') +
    '<div class="refund-box">' +
    '<div style="font-size:13px;color:#888">Importo da rimborsare</div>' +
    '<div class="refund-amount">&euro; ' + refundDisplay + '</div>' +
    '</div>' +
    '<a class="btn btn-refund" href="?paymentId=' + paymentId + '&amount=' + refundAmount + '&action=confirm" style="text-align:center;text-decoration:none;display:block">Conferma rimborso</a>' +
    '<button class="btn btn-cancel" onclick="window.location.href=\'/api/refund\'">Annulla</button>' +
    '<div class="warning">Attenzione: il rimborso &egrave; irreversibile.</div>' +
    '</div></div></body></html>';
}

function buildPage(title, message, type) {
  var color = type === 'success' ? '#28a745' : '#e42313';
  var icon = type === 'success' ? '&#10003;' : '&#10007;';
  return '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + title + '</title>' +
    baseStyles() +
    '</head><body><div class="card">' +
    '<div class="header"><span>Rimborso Satispay</span><a href="/api/refund">Indietro</a></div>' +
    '<div class="body" style="text-align:center">' +
    '<div class="icon" style="color:' + color + '">' + icon + '</div>' +
    '<div class="title">' + title + '</div>' +
    '<div class="msg">' + message + '</div>' +
    '</div></div></body></html>';
}

async function satispayRequest(method, path, body, keyId, privateKey) {
  var host = 'authservices.satispay.com';
  var date = new Date().toUTCString();
  var hash = crypto.createHash('sha256').update(body).digest('base64');
  var digest = 'SHA-256=' + hash;

  var requestTarget = method.toLowerCase() + ' ' + path;
  var signingString = '(request-target): ' + requestTarget + '\nhost: ' + host + '\ndate: ' + date + '\ndigest: ' + digest;

  var sign = crypto.createSign('RSA-SHA256');
  sign.update(signingString);
  sign.end();
  var signature = sign.sign(privateKey, 'base64');

  var authorization = 'Signature keyId="' + keyId + '", algorithm="rsa-sha256", headers="(request-target) host date digest", signature="' + signature + '"';

  var headers = {
    'Accept': 'application/json',
    'Host': host,
    'Date': date,
    'Digest': digest,
    'Authorization': authorization
  };
  if (body) headers['Content-Type'] = 'application/json';

  return new Promise(function(resolve, reject) {
    var options = { hostname: host, path: path, method: method, headers: headers };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({ error: 'parse_error', raw: data }); }
      });
    });
    req.on('error', function(e) { resolve({ error: e.message }); });
    if (body) req.write(body);
    req.end();
  });
}
