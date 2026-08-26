// API Endpoint: Create Payment (PIX)
// Serverless function for Vercel
//
// Variáveis de ambiente (configure na Vercel):
// - BUCKPAY_SECRET_TOKEN: secret token da BuckPay

const https = require('https');

function gerarCPFValido() {
  const rnd = (n) => Math.floor(Math.random() * n);
  let n = [];
  for (let i = 0; i < 9; i++) n.push(rnd(10));
  let d1 = n.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d1 = (d1 * 10) % 11;
  if (d1 === 10) d1 = 0;
  n.push(d1);
  let d2 = n.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d2 = (d2 * 10) % 11;
  if (d2 === 10) d2 = 0;
  n.push(d2);
  return n.join('');
}

function makeRequest(body, options) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: response.statusCode, data: data });
        }
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const BUCKPAY_TOKEN = process.env.BUCKPAY_SECRET_TOKEN;
  if (!BUCKPAY_TOKEN) {
    console.error('BUCKPAY_SECRET_TOKEN não configurado');
    return res.status(500).json({ error: 'Configuração de servidor inválida' });
  }

  // Parseia body raw caso req.body venha vazio ou como string
  let bodyData = {};
  try {
    if (req.body) {
      if (typeof req.body === 'string') {
        bodyData = JSON.parse(req.body);
      } else {
        bodyData = req.body;
      }
    }
  } catch (e) {
    console.error('Erro ao parsear body:', e);
  }

  const name = (bodyData.name || 'Cliente').trim();
  const email = (bodyData.email || `cliente_${Date.now()}@email.com`).trim();
  const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    external_id: externalId,
    payment_method: 'pix',
    amount: 3000,
    buyer: {
      name: name,
      email: email,
      document: gerarCPFValido(),
      phone: '5511999999999'
    }
  };

  const body = JSON.stringify(payload);
  console.log('Payload enviado para BuckPay:', payload);

  const options = {
    hostname: '://buckpay.com.br',
    port: 443,
    path: '/v1/transactions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BUCKPAY_TOKEN}`,
      'User-Agent': 'Buckpay API',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  try {
    const result = await makeRequest(body, options);
    console.log('BuckPay response status:', result.statusCode);
    console.log('BuckPay response body:', JSON.stringify(result.data));

    if (result.statusCode >= 200 && result.statusCode < 300) {
      const d = result.data.data || result.data;

      let pixCode = null;
      let qrcodeBase64 = null;

      if (d.pix) {
        pixCode = d.pix.code || d.pix.emv || d.pix.pix_code || null;
        qrcodeBase64 = d.pix.qrcode_base64 || d.pix.qr_code_base64 || null;
      }

      res.status(200).json({
        id: d.id || externalId,
        external_id: d.external_id || externalId,
        status: d.status || 'pending',
        payment_method: d.payment_method || 'pix',
        pix: {
          code: pixCode,
          qrcode_base64: qrcodeBase64
        },
        total_amount: d.total_amount || d.amount || 3000,
        created_at: d.created_at || new Date().toISOString()
      });
    } else {
      console.error('BuckPay error:', result.statusCode, JSON.stringify(result.data));
      res.status(result.statusCode).json({
        error: 'Falha ao criar transação',
        detail: result.data?.error?.detail || result.data?.error?.message || JSON.stringify(result.data)
      });
    }
  } catch (err) {
    console.error('Request error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
