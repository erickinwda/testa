// API Endpoint: Create Payment (PIX)
// Serverless function for Vercel
// Full path: api/create-payment.js

const https = require('https');

module.exports = async (req, res) => {
  // Cabeçalhos CORS para o navegador aceitar
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

  const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    external_id: externalId,
    payment_method: 'pix',
    amount: 3000,
    buyer: {
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      document: '00000000000',
      phone: '5511999999999'
    }
  };

  const body = JSON.stringify(payload);

  // 🛠️ CONFIGURAÇÃO DE REDE ULTRA-CORRIGIDA E LIMPA SEM PROTOCOLOS:
  const options = {
    hostname: 'api.realtechdev.com.br',
    port: 443,
    path: '/v1/transactions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BUCKPAY_TOKEN}`,
      'User-Agent': process.env.BUCKPAY_USER_AGENT || 'Buckpay API',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const request = https.request(options, (response) => {
    let responseData = '';
    response.on('data', (chunk) => { responseData += chunk; });
    response.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          const d = parsed.data || parsed;

          // Varre todas as propriedades de retorno possíveis da BuckPay
          const pixCode = d.pix?.code || d.emv || d.pix_code || d.pix?.emv || parsed.pix_code || '';
          const qrcodeBase64 = d.pix?.qrcode_base64 || d.qrcode_base64 || parsed.qrcode_base64 || '';

          res.status(200).json({
            id: d.id,
            external_id: d.external_id,
            status: d.status,
            payment_method: d.payment_method,
            pix: {
              code: pixCode,
              qrcode_base64: qrcodeBase64
            },
            total_amount: d.total_amount || d.amount || 3000,
            created_at: d.created_at
          });
        } else {
          console.error('BuckPay error:', response.statusCode, parsed);
          res.status(response.statusCode).json({
            error: 'Falha ao criar transação',
            detail: parsed?.error?.detail || parsed?.error?.message || responseData
          });
        }
      } catch (err) {
        console.error('Parse error:', err, responseData);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  request.on('error', (err) => {
    console.error('Request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  request.write(body);
  request.end();
};
