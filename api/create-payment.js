module.exports = async (req, res) => {
  // Configuração de cabeçalhos CORS para evitar bloqueios de segurança do navegador
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

  // Identificador único aleatório exigido para controle interno
  const externalId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Payload montado com os nomes exatos exigidos pela BuckPay (Opção 1 - Dados fixos)
  const payload = {
    amount_cents: 3000, // R$ 30,00 representados estritamente em centavos
    payment_method: 'pix',
    external_id: externalId,
    buyer: {
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      document: '00000000000', // CPF de teste fixado
      phone: '11999999999'
    }
  };

  try {
    // 1. CORREÇÃO DA URL COM "api." NO COMEÇO:
    const buckpayResponse = await fetch('https://api.buckpay.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUCKPAY_TOKEN}`,
        'User-Agent': BUCKPAY_USER_AGENT,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Lê como texto puro primeiro para capturar logs detalhados caso dê erro
    const responseText = await buckpayResponse.text();
    
    let buckpayData;
    try {
      buckpayData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Resposta da BuckPay não é um JSON válido. Texto recebido:', responseText);
      return res.status(502).json({
        error: 'Resposta inválida do servidor BuckPay',
        detail: responseText.substring(0, 150)
      });
    }

    if (!buckpayResponse.ok) {
      console.error('BuckPay recusou a requisição:', buckpayResponse.status, buckpayData);
      return res.status(buckpayResponse.status).json({
        error: 'Falha ao criar transação na BuckPay',
        detail: buckpayData?.error?.message || buckpayData?.error?.detail || responseText
      });
    }

    // Suporta o retorno vindo com ou sem a propriedade ".data" embrulhada
    const dataResponse = buckpayData.data || buckpayData;

    // Retorna os dados mapeados de forma limpa para o seu index.html ler
    res.status(200).json({
      id: dataResponse.id,
      status: dataResponse.status,
      pix: {
        code: dataResponse.pix?.code || dataResponse.emv || dataResponse.pix_code || '',
        qrcode_base64: dataResponse.pix?.qrcode_base64 || dataResponse.qrcode_base64 || ''
      },
      total_amount: dataResponse.total_amount || 3000
    });

  } catch (err) {
    console.error('Erro crítico na função serverless:', err);
    res.status(500).json({ error: 'Erro interno no processamento do servidor' });
  }
};
