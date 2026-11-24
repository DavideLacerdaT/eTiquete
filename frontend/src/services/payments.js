export function createPaymentsService(request) {
  // Criar cobrança e estornar são responsabilidades da SAGA, nunca da tela de compra.
  return {
    get: (paymentId, options = {}) => request('getPayment', { ...options, params: { paymentId } }),
  };
}
