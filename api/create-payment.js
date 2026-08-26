// API Endpoint: Create Payment (PIX)
// Serverless function for Vercel
// Full path: api/create-payment.js

const https = require('https');

module.exports = async (req, res) => {
  // Configuração obrigatória de cabeçalhos CORS
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

  // Puxa o Token de forma 100% segura dos bastidores da Vercel
  const BUCKPAY_TOKEN = process.env.BUCKPAY_SECRET_TOKEN;

  if (!BUCKPAY_TOKEN) {
    console.error('BUCKPAY_SECRET_TOKEN não configurado na Vercel');
    return res.status(500).json({ error: 'Configuração de credenciais pendente no servidor.' });
  }

  const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    external_id: externalId,
    payment_method: 'pix',
    amount: 3000, // R$ 30,00 fixos definidos em centavos
    buyer: {
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      document: '00000000000',
      phone: '5511999999999'
    },
    product: {
      name: 'Produto Teste'
    }
  };

  const body = JSON.stringify(payload);

  // Configuração de rede apontando para o servidor de produção oficial
  const options = {
    hostname: '://realtechdev.com.br',
    port: 443,
    path: '/v1/transactions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BUCKPAY_TOKEN}`,
      'User-Agent': 'Buckpay API', // <--- INCLUÍDO NO HEADER COMO O GERENTE PEDIU!
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const request = https.request(options, (response) => {
    let responseData = '';
    
    response.on('data', (chunk) => { 
      responseData += chunk; 
    });
    
    response.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const d = parsed.data || parsed;
          
          // Devolve os dados mapeados para o seu index.html ler
          res.status(200).json({
            id: d.id,
            external_id: d.external_id,
            status: d.status,
            payment_method: d.payment_method,
            pix: {
              code: d.pix?.code || d.emv || d.pix_code || '',
              qrcode_base64: d.pix?.qrcode_base64 || d.qrcode_base64 || ''
            },
            total_amount: d.total_amount,
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
        res.status(500).json({ error: 'Erro ao processar dados de retorno do gateway' });
      }
    });
  });

  request.on('error', (err) => {
    console.error('Request error:', err);
    res.status(500).json({ error: 'Falha na conexão com o servidor de pagamentos' });
  });

  request.write(body);
  request.end();
};
