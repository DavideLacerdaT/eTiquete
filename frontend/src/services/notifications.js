export function createNotificationsService(request) {
  return {
    list: (query = {}, options = {}) => request('listNotifications', { ...options, query }),

    get: (notificationId, options = {}) =>
      request('getNotification', { ...options, params: { notificationId } }),
  };
}
