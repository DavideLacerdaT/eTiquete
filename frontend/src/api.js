import { createMockNetwork } from '../../mocks/network.js';
import { ApiError, uuid } from '../../shared/contracts.js';

function preference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export const dataMode = preference('etiquete.dataMode', import.meta.env.VITE_DATA_MODE || 'mock');
export const scenario = preference('etiquete.scenario', 'happy-path');
export const mock = createMockNetwork({ scenario });
export let customer = preference('etiquete.customer', 'marina');
export function setCustomer(username) {
  customer = username;
  try {
    localStorage.setItem('etiquete.customer', username);
  } catch {
    /* A sessão atual continua utilizável sem armazenamento. */
  }
}
export const newContext = () => ({ correlationId: uuid(), idempotencyKey: uuid() });
export async function api(method, path, body, context = {}) {
  if (dataMode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 160));
    return (await mock.api(method, path, body, context)).body;
  }
  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': context.correlationId || uuid(),
        ...(context.idempotencyKey && { 'Idempotency-Key': context.idempotencyKey }),
        ...(context.admissionToken && { 'X-Admission-Token': context.admissionToken }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.error?.code,
        data.error?.message || 'Não foi possível concluir.',
        { ...data.error?.details, correlationId: data.error?.correlationId },
      );
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Não foi possível acessar o Gateway. Verifique o serviço e tente novamente.',
    );
  }
}
export function savePreferences(mode, selectedScenario) {
  localStorage.setItem('etiquete.dataMode', mode);
  localStorage.setItem('etiquete.scenario', selectedScenario);
  window.location.reload();
}
