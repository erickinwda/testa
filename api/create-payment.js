// API Endpoint: Create Payment (PIX)
// Serverless function for Vercel
//
// Variáveis de ambiente (configure na Vercel):
// - BUCKPAY_SECRET_TOKEN: secret token da BuckPay
// - BUCKPAY_USER_AGENT: valor fornecido pelo gerente (opcional, usa "Buckpay API" como fallback)

const https = require('https');

/**
 * Gera um CPF estruturalmente válido (11 dígitos) usando o algoritmo
 * oficial de dígitos verificadores. Não consulta a Receita Federal.
 */
function gerarCPFValido() {
  const rnd = (n) => Math.floor(Math.random() * n);

  let n = [];
  for (let i = 0; i < 9; i++) n.push(rnd(10));

  // 1º DV
  let d1 = n.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d1 = (d1 * 10) % 11;
  if (d1 === 10) d1 = 0;
  n.push(d1);

  // 2º DV
  let d2 = n.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d2 = (d2 * 10) % 11;
  if (d2 === 10) d2 = 0;
  n.push(d2);

  return n.join('');
}

module.exports = async (req, res) => {
  // CORS
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

  // Captura nome e e-mail do frontend (campos públicos permitidos)
  const { name, email } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({
      error: 'Dados incompletos',
      detail: 'Os campos name e email são obrigatórios'
    });
  }

  const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    external_id: externalId,
    payment_method: 'pix',
    amount: 3000,
    buyer: {
      name: String(name).trim(),
      email: String(email).trim(),
      document: gerarCPFValido(),
      phone: '5511999999999'
    }
  };

  const body = JSON.stringify(payload);

  const options = {
    hostname: 'realtechdev.com.br',
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
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          const d = parsed.data || parsed;

          const pixCode = d.pix?.code || d.emv || d.pix_code || d.pix?.emv;
          const qrcodeBase64 = d.pix?.qrcode_base64 || d.qrcode_base64;

          res.status(200).json({
            id: d.id,
            external_id: d.external_id,
            status: d.status,
            payment_method: d.payment_method,
            pix: {
              code: pixCode,
              qrcode_base64: qrcodeBase64
            },
            total_amount: d.total_amount || d.amount,
            created_at: d.created_at
          });
        } else {
          console.error('BuckPay error:', response.statusCode, parsed);
          res.status(response.statusCode).json({
            error: 'Falha ao criar transação',
            detail: parsed?.error?.detail || parsed?.error?.message
          });
        }
      } catch (err) {
        console.error('Parse error:', err, data);
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
