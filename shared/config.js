import { services, scenarios } from '../mocks/fixtures.js';

export function readConfig(env = {}) {
  const defaultMode = env.DATA_MODE || 'mock';

  if (!['mock', 'live'].includes(defaultMode)) {
    throw new Error('DATA_MODE deve ser mock ou live.');
  }

  if (env.MESSAGING_MODE && !['mock', 'kafka'].includes(env.MESSAGING_MODE)) {
    throw new Error('MESSAGING_MODE deve ser mock ou kafka.');
  }

  if (env.MOCK_SCENARIO && !scenarios.some((s) => s.id === env.MOCK_SCENARIO)) {
    throw new Error('MOCK_SCENARIO inválido.');
  }

  const dependencies = Object.fromEntries(
    services.map((name, index) => {
      const prefix = name.toUpperCase();

      const mode = env[`${prefix}_MODE`] || defaultMode;

      if (!['mock', 'live'].includes(mode)) {
        throw new Error(`${prefix}_MODE deve ser mock ou live.`);
      }

      const url = (env[`${prefix}_URL`] || `http://127.0.0.1:${3011 + index}`).replace(/\/+$/, '');

      if (!['http:', 'https:'].includes(new URL(url).protocol)) {
        throw new Error(`${prefix}_URL inválida.`);
      }

      return [name, { mode, url }];
    }),
  );

  const timeoutMs = Number(env.DEPENDENCY_TIMEOUT_MS || 5000);

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('DEPENDENCY_TIMEOUT_MS inválido.');
  }

  const mockBaseUrl = env.MOCK_BASE_URL?.replace(/\/+$/, '') || null;

  if (mockBaseUrl && !['http:', 'https:'].includes(new URL(mockBaseUrl).protocol)) {
    throw new Error('MOCK_BASE_URL inválida.');
  }

  return { dependencies, timeoutMs, scenario: env.MOCK_SCENARIO || 'happy-path', mockBaseUrl };
}
