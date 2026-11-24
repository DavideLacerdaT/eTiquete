// Fixtures determinísticas, compartilhadas pelos simuladores, testes e documentação.
// IDs nunca dependem de títulos, posição na tela ou da hora de execução.
export const id = (domain, n) =>
  `${String(domain).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const services = [
  'catalog',
  'admissions',
  'reservations',
  'orders',
  'payments',
  'notifications',
];

export const demoDate = '2026-11-19T15:00:00.000Z';
