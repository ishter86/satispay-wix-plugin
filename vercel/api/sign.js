const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Credenziali dalle variabili d'ambiente Vercel
  const KEY_ID = process.env.SATISPAY_KEY_ID;
  const PRIVATE_KEY = (process.env.SATISPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!KEY_ID || !PRIVATE_KEY) {
    return res.status(500).json({ error: 'Variabili d\'ambiente non configurate' });
  }

  try {
    // Parsa il body manualmente se necessario
    let data = req.body;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Body JSON non valido' });
    }

    const method = data.method;
    const path = data.path;
    const body = data.body;
    const host = data.host;

    if (!method || !path || !host) {
      return res.status(400).json({ error: 'Campi mancanti: method, path, host' });
    }

    // 1. Data HTTP
    const date = new Date().toUTCString();

    // 2. Digest SHA-256 del body
    const bodyContent = body || '';
    const hash = crypto.createHash('sha256').update(bodyContent).digest('base64');
    const digest = 'SHA-256=' + hash;

    // 3. Stringa da firmare
    const requestTarget = method.toLowerCase() + ' ' + path;
    const signingString = [
      '(request-target): ' + requestTarget,
      'host: ' + host,
      'date: ' + date,
      'digest: ' + digest
    ].join('\n');

    // 4. Firma RSA-SHA256
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingString);
    sign.end();
    const signature = sign.sign(PRIVATE_KEY, 'base64');

    // 5. Header Authorization
    const authorization = [
      'Signature keyId="' + KEY_ID + '"',
      'algorithm="rsa-sha256"',
      'headers="(request-target) host date digest"',
      'signature="' + signature + '"'
    ].join(', ');

    return res.status(200).json({
      Host: host,
      Date: date,
      Digest: digest,
      Authorization: authorization
    });

  } catch (err) {
    return res.status(500).json({ error: 'Firma fallita: ' + err.message });
  }
};
