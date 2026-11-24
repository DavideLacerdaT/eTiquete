export function createCatalogService(request) {
  return {
    list: (query = {}, options = {}) => request('listEvents', { ...options, query }),

    get: (eventId, options = {}) => request('getEvent', { ...options, params: { eventId } }),

    sessions: (eventId, options = {}) =>
      request('listEventSessions', { ...options, params: { eventId } }),

    session: (sessionId, options = {}) =>
      request('getSession', { ...options, params: { sessionId } }),

    seats: (sessionId, options = {}) =>
      request('getSessionSeats', { ...options, params: { sessionId } }),
  };
}
