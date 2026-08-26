// API Endpoint: Create Payment (PIX)
// Serverless function for Vercel
// Full path: api/create-payment.js
// 
// Variáveis de ambiente necessárias (configure na Vercel):
// - BUCKPAY_SECRET_TOKEN: token de 40 caracteres da BuckPay
// - BUCKPAY_USER_AGENT: user-agent fornecido pelo gerente
// - PRODUCT_PRICE_CENTS: preço em centavos (padrão: 3000 = R$ 30,00)
// - BUCKPAY_OFFER_SLUG: slug da oferta (opcional)

module.exports = async (req, res) => {
  // CORS headers
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
  const BUCKPAY_USER_AGENT = process.env.BUCKPAY_USER_AGENT;
  const PRODUCT_PRICE_CENTS = parseInt(process.env.PRODUCT_PRICE_CENTS) || 3000;
  const BUCKPAY_OFFER_SLUG = process.env.BUCKPAY_OFFER_SLUG;

  if (!BUCKPAY_TOKEN) {
    console.error('BUCKPAY_SECRET_TOKEN não configurado');
    return res.status(500).json({ error: 'Configuração de servidor inválida' });
  }

  const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    external_id: externalId,
    payment_method: 'pix',
    amount: PRODUCT_PRICE_CENTS, // R$ 30,00 em centavos
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

  if (BUCKPAY_OFFER_SLUG) {
    payload.offer = { slug: BUCKPAY_OFFER_SLUG };
  }

  try {
    const buckpayResponse = await fetch('https://buckpay.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUCKPAY_TOKEN}`,
        'User-Agent': BUCKPAY_USER_AGENT || 'Mozilla/5.0 (compatible; Checkout/1.0)',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const buckpayData = await buckpayResponse.json();

    if (!buckpayResponse.ok) {
      console.error('BuckPay error:', buckpayResponse.status, buckpayData);
      return res.status(buckpayResponse.status).json({
        error: 'Falha ao criar transação',
        detail: buckpayData?.error?.detail || buckpayData?.error?.message
      });
    }

    const data = buckpayData.data;

    res.status(200).json({
      id: data.id,
      external_id: data.external_id,
      status: data.status,
      payment_method: data.payment_method,
      pix: {
        code: data.pix?.code,
        qrcode_base64: data.pix?.qrcode_base64
      },
      total_amount: data.total_amount,
      created_at: data.created_at
    });
  } catch (err) {
    console.error('Error creating payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};