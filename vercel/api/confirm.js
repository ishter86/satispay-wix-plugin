var https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  var paymentId = req.query.paymentId || '';
  if (!paymentId) {
    return res.status(400).json({ error: 'Missing paymentId' });
  }

  try {
    // Use CALLBACK_BASE_URL env var, or fallback to query parameter
    var callbackBase = process.env.CALLBACK_BASE_URL || req.query.callbackBase || '';
    if (!callbackBase) {
      return res.status(400).json({ error: 'Missing CALLBACK_BASE_URL env var or callbackBase query param' });
    }
    var callbackUrl = callbackBase + '/_functions/satispayCallback?paymentId=' + paymentId;

    var result = await new Promise(function(resolve, reject) {
      var url = new URL(callbackUrl);
      var options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      };

      var req2 = https.request(options, function(res2) {
        var data = '';
        res2.on('data', function(chunk) { data += chunk; });
        res2.on('end', function() {
          try {
            resolve({ status: res2.statusCode, body: JSON.parse(data) });
          } catch(e) {
            resolve({ status: res2.statusCode, body: data });
          }
        });
      });
      req2.on('error', function(e) { reject(e); });
      req2.end();
    });

    return res.status(200).json({
      confirmed: true,
      paymentId: paymentId,
      wixCallback: result
    });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
