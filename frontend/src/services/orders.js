export function createOrdersService(request) {
  return {
    list: (query = {}, options = {}) => request('listOrders', { ...options, query }),

    create: (body, options) => request('createOrder', { ...options, body }),

    get: (orderId, options = {}) => request('getOrder', { ...options, params: { orderId } }),

    timeline: (orderId, options = {}) =>
      request('getOrderTimeline', { ...options, params: { orderId } }),

    cancel: (orderId, options) =>
      request('cancelOrder', {
        ...options,
        params: { orderId },
        body: { reason: 'CUSTOMER_REQUEST' },
      }),
  };
}
