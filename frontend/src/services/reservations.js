export function createReservationsService(request) {
  return {
    list: (query = {}, options = {}) => request('listReservations', { ...options, query }),

    create: (body, options) => request('createReservation', { ...options, body }),

    get: (reservationId, options = {}) =>
      request('getReservation', { ...options, params: { reservationId } }),
  };
}
