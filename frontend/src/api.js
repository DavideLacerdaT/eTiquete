import { createMockNetwork } from '../../mocks/network.js';
import {
  createApiClient,
  createHttpTransport,
  createMockTransport,
} from './services/http-client.js';
import { createCatalogService } from './services/catalog.js';
import { createAdmissionsService } from './services/admissions.js';
import { createReservationsService } from './services/reservations.js';
import { createOrdersService } from './services/orders.js';
import { createPaymentsService } from './services/payments.js';
import { createNotificationsService } from './services/notifications.js';

export { newContext } from './services/http-client.js';

function preference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

const defaultMode = import.meta.env.VITE_DATA_MODE || (import.meta.env.PROD ? 'gateway' : 'mock');
const preferredMode = preference('etiquete.dataMode', defaultMode);

export const dataMode = preferredMode === 'mock' ? 'mock' : 'gateway';
export const scenario = preference('etiquete.scenario', 'happy-path');
export const mock = createMockNetwork({ scenario });

const httpRequest = createApiClient(createHttpTransport());
const request = dataMode === 'mock' ? createApiClient(createMockTransport(mock)) : httpRequest;

export const catalog = createCatalogService(request);
export const admissions = createAdmissionsService(request);
export const reservations = createReservationsService(request);
export const orders = createOrdersService(request);
export const payments = createPaymentsService(request);
export const notifications = createNotificationsService(request);

// Diagnóstico explicitamente HTTP, mesmo quando o catálogo usa o mock do navegador.
export const gateway = {
  services: (options = {}) => httpRequest('getGatewayServices', options),
};

export let customer = preference('etiquete.customer', 'marina');

export function setCustomer(username) {
  customer = username;

  try {
    localStorage.setItem('etiquete.customer', username);
  } catch {
    /* A sessão atual continua utilizável sem armazenamento. */
  }
}

export function savePreferences(mode, selectedScenario) {
  localStorage.setItem('etiquete.dataMode', mode);
  localStorage.setItem('etiquete.scenario', selectedScenario);

  window.location.reload();
}
