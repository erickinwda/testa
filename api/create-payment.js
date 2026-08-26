// API Endpoint: Create Payment (PIX)
// POST /api/create-payment
// Called from frontend when user clicks "Comprar Agora"

const { createPayment } = require('../create-payment');

module.exports = async (req, res) => {
  // Enable CORS
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

  try {
    // Generate unique external_id using timestamp + random
    const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const paymentData = await createPayment(externalId);

    // Extract only the data needed by frontend
    const responseData = {
      id: paymentData.data.id,
      status: paymentData.data.status,
      payment_method: paymentData.data.payment_method,
      pix: {
        code: paymentData.data.pix?.code,
        qrcode_base64: paymentData.data.pix?.qrcode_base64
      },
      total_amount: paymentData.data.total_amount,
      created_at: paymentData.data.created_at
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
};