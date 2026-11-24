export function createAdmissionsService(request) {
  return {
    create: (body, options = {}) => request('createAdmission', { ...options, body }),

    get: (admissionTokenId, options = {}) =>
      request('getAdmission', { ...options, params: { admissionTokenId } }),
  };
}
