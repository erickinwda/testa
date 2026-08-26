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
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const BUCKPAY_TOKEN = process.env.BUCKPAY_SECRET_TOKEN;
  const BUCKPAY_USER_AGENT = process.env.BUCKPAY_USER_AGENT || 'vsllorde';

  if (!BUCKPAY_TOKEN) {
    console.error('BUCKPAY_SECRET_TOKEN não configurado na Vercel');
    return res.status(500).json({ error: 'Configuração secreta do servidor ausente.' });
  }

  const externalId = `id_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Payload oficial em centavos conforme a imagem oficial do sistema
  const payload = JSON.stringify({
    external_id: externalId,
    payment_method: 'pix',
    amount: 3000, // Ajustado para 'amount' como pede o cURL da documentação deles
    buyer: {
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      document: '00000000000',
      phone: '11999999999'
    }
  });

  // DOMÍNIO ATUALIZADO BASEADO NO SEU PRINT DA BUCKPAY
  const options = {
    hostname: '://realtechdev.com.br',
    port: 443,
    path: '/v1/transactions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BUCKPAY_TOKEN}`,
      'User-Agent': BUCKPAY_USER_AGENT,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const request = https.request(options, (response) => {
    let responseText = '';

    response.on('data', (chunk) => {
      responseText += chunk;
    });

    response.on('end', () => {
      let buckpayData;
      try {
        buckpayData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Resposta da API não é JSON válido:', responseText);
        return res.status(502).json({
          error: 'Resposta inválida do servidor de pagamentos',
          detail: responseText.substring(0, 150)
        });
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        console.error('A API recusou com status:', response.statusCode, buckpayData);
        return res.status(response.statusCode).json({
          error: 'Falha ao criar transação',
          detail: buckpayData?.error?.message || buckpayData?.error?.detail || responseText
        });
      }

      const dataResponse = buckpayData.data || buckpayData;

      res.status(200).json({
        id: dataResponse.id,
        status: dataResponse.status,
        pix: {
          code: dataResponse.pix?.code || dataResponse.emv || dataResponse.pix_code || '',
          qrcode_base64: dataResponse.pix?.qrcode_base64 || dataResponse.qrcode_base64 || ''
        },
        total_amount: dataResponse.total_amount || 3000
      });
    });
  });

  request.on('error', (err) => {
    console.error('Erro de conexão HTTPS:', err);
    res.status(500).json({ error: 'Erro de comunicação com o gateway', message: err.message });
  });

  request.write(payload);
  request.end();
};
