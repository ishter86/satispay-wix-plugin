var QRCode = require('qrcode');

module.exports = async (req, res) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  var paymentId = req.query.paymentId || '';
  var successUrl = req.query.successUrl || '';
  var errorUrl = req.query.errorUrl || '';
  var amount = req.query.amount || '0';
  var environment = req.query.environment || 'production';
  var signerUrl = req.query.signerUrl || '';
  var debug = req.query.debug || '';

  if (paymentId === 'debug' || debug) {
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<style>body{font-family:monospace;padding:20px;background:#fff;}h2{color:#e42313;}pre{background:#f5f5f5;padding:15px;border-radius:8px;word-wrap:break-word;white-space:pre-wrap;}</style>' +
      '</head><body><h2>Satispay Debug</h2><pre>' + (debug ? decodeURIComponent(debug) : 'No debug info') + '</pre>' +
      '<p>paymentId: ' + paymentId + '</p><p>amount: ' + amount + '</p><p>environment: ' + environment + '</p>' +
      '<p>signerUrl: ' + (signerUrl ? 'present' : 'missing') + '</p><p>successUrl: ' + (successUrl ? 'present' : 'missing') + '</p>' +
      '</body></html>';
    return res.status(200).send(html);
  }

  if (!paymentId) {
    return res.status(400).send('<html><body><h2>Errore: ID pagamento mancante</h2></body></html>');
  }

  var amountDisplay = (parseFloat(amount) / 100).toFixed(2);
  var qrData = 'https://online.satispay.com/pay/' + paymentId;

  var qrSvg = '';
  try {
    qrSvg = await QRCode.toString(qrData, { type: 'svg', width: 200, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' } });
  } catch (e) {
    qrSvg = '<p style="color:red">Errore generazione QR</p>';
  }

  var statusBaseUrl = '';
  var confirmBaseUrl = '';
  if (signerUrl) {
    statusBaseUrl = signerUrl.replace('/api/sign', '/api/status');
    confirmBaseUrl = signerUrl.replace('/api/sign', '/api/confirm');
  }

  // Satispay official SVG logo (red, from uploaded file)
  var satispayLogo = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="30" fill="none"><path fill="#FF3D00" d="M73.281 12.106c0-.663.715-1.042 2.221-1.042 3.35 0 6.174 2.462 6.174 2.462V8.981a10.2 10.2 0 0 0-5.722-1.723c-4.649 0-6.286 2.822-6.286 4.696 0 5.227 8.695 3.94 8.695 5.985 0 .89-1.054 1.098-2.164 1.098-3.859 0-6.268-2.746-6.268-2.746v5.17c.602.55 3.35 1.554 5.948 1.554 4.122 0 6.569-2.349 6.569-4.356 0-5.55-9.167-4.508-9.167-6.553Zm-20.309 2.235c0-1.458-.32-7.083-6.644-7.083-3.049 0-5.213 1.269-5.835 1.723v4.545s2.184-2.462 5.176-2.462c2.993 0 2.937 2.727 2.937 2.727-.828-.151-2.052-.265-3.313-.265-3.99 0-6.136 2.481-6.136 5.152 0 3.049 2.767 4.337 5.157 4.337 2.221 0 3.595-1.175 4.33-2.898h.15l-.15 2.178v.397h4.385l-.057-8.351Zm-7.397 5.265c-1.355 0-2.296-.682-2.296-1.743 0-2.007 3.106-2.537 5.063-2.026-.15 2.803-1.449 3.769-2.767 3.769Zm66.705-5.265c0-1.458-.32-7.083-6.644-7.083-3.049 0-5.213 1.269-5.835 1.723v4.545s2.184-2.462 5.176-2.462c2.993 0 2.937 2.727 2.937 2.727-.829-.151-1.995-.265-3.313-.265-3.99 0-6.136 2.481-6.136 5.152 0 3.049 2.767 4.337 5.157 4.337 2.221 0 3.595-1.175 4.329-2.898h.151l-.151 2.178v.397h4.386l-.057-8.351Zm-7.397 5.265c-1.355 0-2.296-.682-2.296-1.743 0-2.007 3.106-2.537 5.063-2.026-.15 2.803-1.449 3.769-2.767 3.769ZM59.315 5.08h-3.143c0 1.212-.564 2.67-2.654 2.67v2.727h1.299v7.898c0 2.784 1.223 4.64 3.877 4.64 1.638 0 2.899-.53 3.445-1.232v-3.995s-.621 1.041-1.525 1.041c-.96 0-1.299-.739-1.299-1.875v-6.477h2.636v-3.22h-2.636V5.08Zm-29.813 7.026c0-.663.715-1.042 2.22-1.042 3.35 0 6.174 2.462 6.174 2.462V8.981a10.2 10.2 0 0 0-5.722-1.723c-4.649 0-6.286 2.822-6.286 4.696 0 5.227 8.695 3.94 8.695 5.985 0 .89-1.054 1.098-2.164 1.098-3.859 0-6.268-2.746-6.268-2.746v5.17c.602.55 3.35 1.554 5.948 1.554 4.122 0 6.569-2.349 6.569-4.356 0-5.55-9.166-4.508-9.166-6.553ZM66.11 8.981c1.506 0 2.673-1.117 2.673-2.5 0-1.382-1.167-2.5-2.673-2.5s-2.729 1.137-2.729 2.5c0 1.364 1.186 2.5 2.73 2.5Zm2.315 13.711V9.72s-.903.435-2.315.435-2.334-.435-2.334-.435v12.972h4.65ZM122.068 7.58h.056c-1.543 6.439-2.447 9.772-2.616 10.643-.057-.871-1.299-4.204-2.823-10.643h-4.875l3.802 11.344c.301.814.979 1.818 2.56 1.818 1.279 0 2.032-.682 2.446-1.06h.076c-.377 1.003-1.337 2.405-3.539 2.405-1.543 0-3.181-.74-3.181-.74v4.035s1.148.663 3.181.663c1.468 0 3.727-.55 5.534-5.208.132-.228 4.31-13.257 4.31-13.257h-4.931Zm-29.776-.322c-1.958 0-3.35.87-4.273 2.935l-.113-.038.207-2.575h-4.611v18.143h4.442V20.57l.131-.038c.79 1.534 2.259 2.482 4.216 2.482 4.066 0 5.967-4.375 5.967-7.917 0-3.825-1.901-7.84-5.966-7.84Zm-1.45 11.25c-1.637 0-3.313-.986-3.313-3.448 0-2.462 1.676-3.465 3.313-3.465 1.638 0 3.463 1.003 3.463 3.465 0 2.462-1.806 3.447-3.463 3.447Z"/><path fill="#FF3D00" fill-rule="evenodd" d="M3.765 5.128h6.504l8.841 8.327c.513.483.814 1.162.814 1.868a2.606 2.606 0 0 1-.78 1.868l-8.854 8.423H3.744a.27.27 0 0 1-.184-.469l10.33-9.563a.323.323 0 0 0 .096-.232.329.329 0 0 0-.102-.23L3.58 5.596c-.184-.163-.061-.468.185-.468ZM.793 17.184A2.635 2.635 0 0 1 0 15.303c0-.707.3-1.386.813-1.868l4.749-4.497 3.566 3.315-3.095 2.84a.322.322 0 0 0-.096.23c0 .089.041.17.103.231l3.13 2.894-3.567 3.315-4.81-4.579Zm11.082 8.444h4.352c.246 0 .37-.306.185-.469l-2.043-1.895-2.494 2.364Zm4.503-20.032-2.023 1.861-2.487-2.33h4.325a.27.27 0 0 1 .185.47Z" clip-rule="evenodd"/></svg>';

  // CUSTOMIZE: Replace with your own logo URL
  var merchantLogoUrl = 'https://your-site.com/your-logo.png';

  var logoUrl = '';
  if (signerUrl) {
    logoUrl = signerUrl.replace('/api/sign', '/api/logo');
  }

  var html = '<!DOCTYPE html>' +
'<html lang="it">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <title>Paga con Satispay</title>' +
'  <link rel="preconnect" href="https://fonts.googleapis.com">' +
'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
'  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">' +
'  <style>' +
'    * { margin: 0; padding: 0; box-sizing: border-box; }' +
'    body {' +
'      font-family: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;' +
'      background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);' +
'      min-height: 100vh;' +
'      display: flex;' +
'      align-items: flex-start;' +
'      justify-content: center;' +
'      padding: 20px 16px;' +
'    }' +
'    .card {' +
'      background: #ffffff;' +
'      border-radius: 20px;' +
'      box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);' +
'      max-width: 380px;' +
'      width: 100%;' +
'      overflow: hidden;' +
'    }' +
'    .card-header {' +
'      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);' +
'      padding: 20px 24px;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'    }' +
'    .card-header .logo-cb { height: 40px; }' +
'    .card-header .logo-sp { height: 22px; filter: brightness(0) invert(1); object-fit: contain; }' +
'    .card-header .divider {' +
'      width: 1px; height: 30px; background: rgba(255,255,255,0.2);' +
'    }' +
'    .card-body { padding: 28px 24px 20px; text-align: center; }' +
'    .amount-label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; margin-bottom: 4px; }' +
'    .amount {' +
'      font-size: 36px; font-weight: 700; color: #1a1a2e;' +
'      margin-bottom: 20px; letter-spacing: -0.5px;' +
'    }' +
'    .amount .eur { font-size: 22px; color: #666; font-weight: 500; vertical-align: super; margin-right: 2px; }' +
'    .qr-container {' +
'      background: #fff;' +
'      border: 2px solid #f0f0f0;' +
'      border-radius: 16px;' +
'      padding: 16px;' +
'      display: inline-block;' +
'      margin-bottom: 8px;' +
'      transition: all 0.5s ease;' +
'    }' +
'    .qr-container svg { display: block; }' +
'    .qr-instruction {' +
'      font-size: 13px; color: #aaa; margin-bottom: 20px;' +
'    }' +
'    .status-bar {' +
'      display: flex; align-items: center; justify-content: center;' +
'      gap: 8px; padding: 14px; margin: 0 -24px;' +
'      background: #fafafa; border-top: 1px solid #f0f0f0;' +
'    }' +
'    .status-bar.ok { background: #f0faf0; border-color: #d4edda; }' +
'    .status-bar.fail { background: #fef0f0; border-color: #f5c6cb; }' +
'    .pulse {' +
'      width: 8px; height: 8px; border-radius: 50%; background: #FF3D00;' +
'      animation: pulse 1.5s ease-in-out infinite;' +
'    }' +
'    @keyframes pulse { 0%,100%{opacity:.3;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.1)} }' +
'    .status-text { font-size: 13px; color: #888; font-weight: 500; }' +
'    .status-bar.ok .status-text { color: #28a745; }' +
'    .status-bar.fail .status-text { color: #dc3545; }' +
'    .check-icon { font-size: 18px; color: #28a745; }' +
'    .card-footer { padding: 12px 24px 18px; text-align: center; }' +
'    .cancel-link {' +
'      font-size: 12px; color: #ccc; cursor: pointer;' +
'      text-decoration: none; transition: color 0.2s;' +
'    }' +
'    .cancel-link:hover { color: #999; }' +
'    .mobile-btn {' +
'      display: none; background: #FF3D00; color: #fff;' +
'      border: none; border-radius: 12px; padding: 14px 32px;' +
'      font-family: inherit; font-size: 15px; font-weight: 600;' +
'      cursor: pointer; text-decoration: none; margin-bottom: 12px;' +
'      transition: background 0.2s; width: 100%;' +
'    }' +
'    .mobile-btn:hover { background: #e03500; }' +
'    @media (max-width: 500px) {' +
'      .mobile-btn { display: block; }' +
'      .qr-instruction { font-size: 12px; }' +
'    }' +
'    .powered {' +
'      font-size: 10px; color: #ccc; margin-top: 12px;' +
'      text-align: center; letter-spacing: 0.5px;' +
'    }' +
'    .fade-out { opacity: 0; transform: scale(0.95); transition: all 0.4s ease; }' +
'    .fade-in { animation: fadeIn 0.4s ease forwards; }' +
'    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="card">' +
'    <div class="card-header">' +
'      <img src="' + merchantLogoUrl + '" alt="Logo" class="logo-cb">' +
'      <div class="divider"></div>' +
'      <img src="' + logoUrl + '" alt="Satispay" class="logo-sp">' +
'    </div>' +
'    <div class="card-body">' +
'      <div class="amount-label">Importo</div>' +
'      <div class="amount"><span class="eur">&euro;</span>' + amountDisplay + '</div>' +
'      <div id="qr-section">' +
'        <div class="qr-container" id="qr-box">' + qrSvg + '</div>' +
'        <div class="qr-instruction">Scansiona il QR code con l\'app Satispay</div>' +
'        <a href="https://online.satispay.com/pay/' + paymentId + '" class="mobile-btn" target="_blank">Paga con Satispay</a>' +
'      </div>' +
'      <div id="success-section" style="display:none" class="fade-in">' +
'        <div style="font-size:64px;margin-bottom:12px;color:#28a745">&#10003;</div>' +
'        <div style="font-size:16px;font-weight:600;color:#1a1a2e;margin-bottom:6px">Pagamento ricevuto!</div>' +
'        <div style="font-size:13px;color:#999;line-height:1.5">Il tuo acquisto &egrave; stato completato.<br>Verrai reindirizzato automaticamente.</div>' +
'      </div>' +
'    </div>' +
'    <div class="status-bar" id="status-bar">' +
'      <div class="pulse" id="pulse-dot"></div>' +
'      <span class="status-text" id="status-text">In attesa del pagamento&hellip;</span>' +
'    </div>' +
'    <div class="card-footer">' +
'      <a class="cancel-link" id="cancel-link" onclick="doCancel()">Annulla pagamento</a>' +
'    </div>' +
'    <div class="powered">Pagamento sicuro tramite Satispay</div>' +
'  </div>' +
'  <script>' +
'    var polling = true;' +
'    var paymentId = "' + paymentId + '";' +
'    var successUrl = "' + (successUrl || '').replace(/"/g, '\\"') + '";' +
'    var errorUrl = "' + (errorUrl || '').replace(/"/g, '\\"') + '";' +
'    var statusUrl = "' + (statusBaseUrl || '').replace(/"/g, '\\"') + '";' +
'    var confirmUrl = "' + (confirmBaseUrl || '').replace(/"/g, '\\"') + '";' +
'    async function checkStatus() {' +
'      if (!polling || !statusUrl) return;' +
'      try {' +
'        var resp = await fetch(statusUrl + "?paymentId=" + paymentId);' +
'        if (resp.ok) {' +
'          var d = await resp.json();' +
'          if (d.status === "ACCEPTED") {' +
'            polling = false;' +
'            document.getElementById("qr-section").style.display = "none";' +
'            document.getElementById("success-section").style.display = "block";' +
'            document.getElementById("status-bar").className = "status-bar ok";' +
'            document.getElementById("pulse-dot").style.display = "none";' +
'            document.getElementById("status-text").innerHTML = "&#10003; Pagamento confermato";' +
'            document.getElementById("cancel-link").style.display = "none";' +
'            try { await fetch(confirmUrl + "?paymentId=" + paymentId); } catch(ce) {}' +
'            setTimeout(function(){' +
'              if (successUrl) { try { window.location.href = successUrl; } catch(e) {} }' +
'            }, 2500);' +
'            return;' +
'          }' +
'          if (d.status === "CANCELED" || d.status === "EXPIRED" || d.expired === true) {' +
'            polling = false;' +
'            document.getElementById("status-bar").className = "status-bar fail";' +
'            document.getElementById("pulse-dot").style.display = "none";' +
'            document.getElementById("status-text").innerHTML = "Pagamento annullato o scaduto";' +
'            setTimeout(function(){' +
'              if (errorUrl) { try { window.location.href = errorUrl; } catch(e) {} }' +
'            }, 2500);' +
'            return;' +
'          }' +
'        }' +
'      } catch(e) { console.error("Poll error:", e); }' +
'      setTimeout(checkStatus, 3000);' +
'    }' +
'    setTimeout(checkStatus, 2500);' +
'    function doCancel() { polling = false; if (errorUrl) { try { window.location.href = errorUrl; } catch(e) {} } }' +
'  </script>' +
'</body></html>';

  return res.status(200).send(html);
};
