export const ticketFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'processing', label: 'Em andamento' },
  { value: 'cancelled', label: 'Cancelados' },
];

export function ticketMatchesFilter(order, filter) {
  switch (filter) {
    case 'confirmed':
      return order.status === 'CONFIRMED';

    case 'processing':
      return !['CONFIRMED', 'CANCELLED', 'FAILED'].includes(order.status);

    case 'cancelled':
      return ['CANCELLED', 'FAILED'].includes(order.status);

    default:
      return true;
  }
}
