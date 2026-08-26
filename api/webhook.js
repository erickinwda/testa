// Backend API - Webhook Handler
// Recebe eventos da BuckPay (transaction.created, transaction.processed)

const BUCKPAY_TOKEN = process.env.BUCKPAY_SECRET_TOKEN;

/**
 * Processa webhook da BuckPay
 * @param {Object} payload - Corpo da requisição (evento + dados da transação)
 * @param {string} eventType - Tipo do evento (transaction.created, transaction.processed)
 */
async function processWebhook(payload, eventType) {
  console.log('=== BUCKPAY WEBHOOK ===');
  console.log('Evento recebido:', eventType);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('========================');

  switch (eventType) {
    case 'transaction.created':
      console.log('PIX gerado - aguardando pagamento...');
      // TODO: Lógica para PIX gerado (ex: notificar usuário)
      break;

    case 'transaction.processed':
      console.log('Processando confirmação de pagamento...');
      const status = payload?.data?.status || payload?.status;
      const externalId = payload?.data?.external_id || payload?.external_id;
      
      if (status === 'paid') {
        console.log(`✅ PAGAMENTO CONFIRMADO! Pedido: ${externalId}`);
        // TODO: Validar assinatura de segurança
        // TODO: Liberar acesso ao produto
      } else if (status === 'pending') {
        console.log(`⏳ Pagamento pendente - Pedido: ${externalId}`);
      } else if (status === 'expired') {
        console.log(`❌ Pagamento expirado - Pedido: ${externalId}`);
        // TODO: Notificar usuário sobre expiração
      } else {
        console.log(`Status desconhecido: ${status} - Pedido: ${externalId}`);
      }
      break;

    default:
      console.log(`Evento não tratado: ${eventType}`);
  }

  return true;
}

module.exports = { processWebhook };
