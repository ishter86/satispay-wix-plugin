var crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  var paymentId = req.query.paymentId || '';
  if (!paymentId || paymentId === 'debug') {
    return res.status(400).json({ error: 'Missing paymentId' });
  }

  var KEY_ID = process.env.SATISPAY_KEY_ID;
  var PRIVATE_KEY = (process.env.SATISPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!KEY_ID || !PRIVATE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    var host = 'authservices.satispay.com';
    var path = '/g_business/v1/payments/' + paymentId;
    var method = 'GET';
    var body = '';

    var date = new Date().toUTCString();
    var hash = crypto.createHash('sha256').update(body).digest('base64');
    var digest = 'SHA-256=' + hash;

    var requestTarget = method.toLowerCase() + ' ' + path;
    var signingString = [
      '(request-target): ' + requestTarget,
      'host: ' + host,
      'date: ' + date,
      'digest: ' + digest
    ].join('\n');

    var sign = crypto.createSign('RSA-SHA256');
    sign.update(signingString);
    sign.end();
    var signature = sign.sign(PRIVATE_KEY, 'base64');

    var authorization = [
      'Signature keyId="' + KEY_ID + '"',
      'algorithm="rsa-sha256"',
      'headers="(request-target) host date digest"',
      'signature="' + signature + '"'
    ].join(', ');

    var https = require('https');

    var result = await new Promise(function(resolve, reject) {
      var options = {
        hostname: host,
        path: path,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Host': host,
          'Date': date,
          'Digest': digest,
          'Authorization': authorization
        }
      };

      var req2 = https.request(options, function(res2) {
        var data = '';
        res2.on('data', function(chunk) { data += chunk; });
        res2.on('end', function() {
          try {
            resolve(JSON.parse(data));
          } catch(e) {
            resolve({ error: 'parse_error', raw: data });
          }
        });
      });
      req2.on('error', function(e) { reject(e); });
      req2.end();
    });

    return res.status(200).json({
      status: result.status || 'UNKNOWN',
      expired: result.expired || false,
      id: result.id || paymentId
    });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
