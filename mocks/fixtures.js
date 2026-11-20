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
export const venues = [
  {
    venueId: id(3, 1),
    name: 'Concha Acústica',
    city: 'Salvador',
    address: 'Praça Dois de Julho, Campo Grande',
  },
  {
    venueId: id(3, 2),
    name: 'Teatro Castro Alves',
    city: 'Salvador',
    address: 'Praça Dois de Julho, s/n',
  },
  {
    venueId: id(3, 3),
    name: 'Casa do Comércio',
    city: 'Salvador',
    address: 'Av. Tancredo Neves, 1109',
  },
];
export const events = [
  {
    eventId: id(1, 1),
    title: 'Noites de Jazz',
    category: 'Música',
    subtitle: 'Uma noite para sentir cada nota.',
    description:
      'Um encontro entre o jazz e os ritmos da Bahia. Quarteto ao vivo, convidados especiais e uma noite sob as estrelas.',
    venueId: id(3, 1),
    priceFromCents: 12000,
    color: 'pink',
    artwork: 'jazz',
    durationMinutes: 120,
    ageRating: '12 anos',
  },
  {
    eventId: id(1, 2),
    title: 'Entre Atos',
    category: 'Teatro',
    subtitle: 'Toda história merece um palco.',
    description:
      'Três histórias se cruzam em uma montagem sobre encontros, recomeços e os pequenos acontecimentos da vida.',
    venueId: id(3, 2),
    priceFromCents: 8000,
    color: 'blue',
    artwork: 'theatre',
    durationMinutes: 90,
    ageRating: 'Livre',
  },
  {
    eventId: id(1, 3),
    title: 'Festival Solar',
    category: 'Festival',
    subtitle: 'Música boa. Energia lá em cima.',
    description:
      'Uma celebração da música brasileira com artistas independentes e novas vozes da cena baiana.',
    venueId: id(3, 1),
    priceFromCents: 16000,
    color: 'yellow',
    artwork: 'sun',
    durationMinutes: 240,
    ageRating: '16 anos',
  },
  {
    eventId: id(1, 4),
    title: 'Ideias em Movimento',
    category: 'Conferência',
    subtitle: 'O próximo encontro começa com uma ideia.',
    description:
      'Conversas e experiências sobre criatividade, tecnologia e futuros possíveis, com profissionais de diferentes áreas.',
    venueId: id(3, 3),
    priceFromCents: 6000,
    color: 'green',
    artwork: 'ideas',
    durationMinutes: 180,
    ageRating: 'Livre',
  },
];
export const sessions = [
  {
    sessionId: id(2, 1),
    eventId: id(1, 1),
    venueId: id(3, 1),
    startsAt: '2026-11-20T22:00:00Z',
    priceCents: 12000,
  },
  {
    sessionId: id(2, 2),
    eventId: id(1, 1),
    venueId: id(3, 1),
    startsAt: '2026-11-21T22:00:00Z',
    priceCents: 12000,
  },
  {
    sessionId: id(2, 3),
    eventId: id(1, 2),
    venueId: id(3, 2),
    startsAt: '2026-11-21T23:00:00Z',
    priceCents: 8000,
  },
  {
    sessionId: id(2, 4),
    eventId: id(1, 3),
    venueId: id(3, 1),
    startsAt: '2026-11-22T19:00:00Z',
    priceCents: 16000,
  },
  {
    sessionId: id(2, 5),
    eventId: id(1, 4),
    venueId: id(3, 3),
    startsAt: '2026-11-25T17:00:00Z',
    priceCents: 6000,
  },
];
export const seats = sessions.flatMap((session, sessionIndex) =>
  Array.from({ length: 48 }, (_, i) => ({
    sessionId: session.sessionId,
    seatId: id(4, sessionIndex * 100 + i + 1),
    section: 'Plateia',
    row: String.fromCharCode(65 + Math.floor(i / 8)),
    number: String((i % 8) + 1).padStart(2, '0'),
    status: [3, 8, 11, 19, 20, 29, 34, 35, 46].includes(i) ? 'SOLD' : 'AVAILABLE',
    priceCents: session.priceCents,
  })),
);
export const sampleItems = [{ sessionId: id(2, 3), seatIds: [id(4, 204)] }];
export const reservations = [
  {
    reservationId: id(5, 1),
    username: 'marina',
    items: sampleItems,
    status: 'CONFIRMED',
    expiresAt: '2026-11-18T18:10:00Z',
    confirmedAt: '2026-11-18T18:01:00Z',
    amountCents: 8000,
    orderId: id(6, 1),
  },
  {
    reservationId: id(5, 2),
    username: 'marina',
    items: [{ sessionId: id(2, 1), seatIds: [id(4, 2)] }],
    status: 'EXPIRED',
    expiresAt: '2026-11-18T17:10:00Z',
    amountCents: 12000,
  },
  {
    reservationId: id(5, 3),
    username: 'marina',
    items: [{ sessionId: id(2, 4), seatIds: [id(4, 302)] }],
    status: 'RELEASED',
    expiresAt: '2026-11-17T17:10:00Z',
    amountCents: 16000,
  },
];
export const orders = [
  {
    orderId: id(6, 1),
    sagaId: id(6, 1),
    reservationId: id(5, 1),
    paymentId: id(7, 1),
    username: 'marina',
    items: sampleItems,
    amountCents: 8000,
    status: 'CONFIRMED',
    sagaStatus: 'COMPLETED',
    createdAt: '2026-11-18T18:00:00Z',
    confirmedAt: '2026-11-18T18:01:00Z',
  },
  {
    orderId: id(6, 2),
    sagaId: id(6, 2),
    reservationId: id(5, 3),
    paymentId: id(7, 2),
    username: 'marina',
    items: reservations[2].items,
    amountCents: 16000,
    status: 'CANCELLED',
    sagaStatus: 'COMPENSATED',
    createdAt: '2026-11-17T17:00:00Z',
    failureCode: 'PAYMENT_DECLINED',
  },
];
export const payments = [
  {
    paymentId: id(7, 1),
    orderId: id(6, 1),
    reservationId: id(5, 1),
    amountCents: 8000,
    currency: 'BRL',
    method: 'SIMULATED',
    status: 'SUCCEEDED',
    paidAt: '2026-11-18T18:00:30Z',
  },
  {
    paymentId: id(7, 2),
    orderId: id(6, 2),
    reservationId: id(5, 3),
    amountCents: 16000,
    currency: 'BRL',
    method: 'SIMULATED',
    status: 'FAILED',
    failureCode: 'PAYMENT_DECLINED',
  },
];
export const notifications = [
  {
    notificationId: id(8, 1),
    orderId: id(6, 1),
    username: 'marina',
    template: 'ORDER_CONFIRMED',
    title: 'Seu lugar está garantido!',
    message: 'A compra de Entre Atos foi confirmada. Agora é só esperar o grande dia.',
    status: 'SENT',
    createdAt: '2026-11-18T18:01:00Z',
    sentAt: '2026-11-18T18:01:02Z',
  },
  {
    notificationId: id(8, 2),
    orderId: id(6, 2),
    username: 'marina',
    template: 'ORDER_CANCELLED',
    title: 'Compra cancelada',
    message:
      'O pagamento de Festival Solar foi recusado. Os assentos foram liberados para uma nova tentativa.',
    status: 'SENT',
    createdAt: '2026-11-17T17:01:00Z',
    sentAt: '2026-11-17T17:01:02Z',
  },
];
export const scenarios = [
  {
    id: 'happy-path',
    label: 'Compra aprovada',
    description: 'Admissão, reserva, pagamento, confirmação e notificação.',
  },
  {
    id: 'queue',
    label: 'Fila de espera',
    description: 'A admissão permanece em WAITING por 8 segundos.',
  },
  {
    id: 'seat-conflict',
    label: 'Assento disputado',
    description: 'A aquisição retorna 409 SEAT_UNAVAILABLE sem reserva parcial.',
  },
  {
    id: 'payment-declined',
    label: 'Pagamento recusado',
    description: 'O pedido é compensado e os assentos são liberados.',
  },
  {
    id: 'reservation-expired',
    label: 'Reserva expirada',
    description: 'TTL de 5 segundos para testar o contador e a expiração.',
  },
  {
    id: 'late-payment',
    label: 'Pagamento tardio',
    description: 'A reserva expira antes da aprovação; o pagamento é estornado.',
  },
  {
    id: 'refund-failed',
    label: 'Estorno com falha',
    description: 'O cancelamento permanece REFUND_PENDING, com intervenção necessária.',
  },
  {
    id: 'notification-failed',
    label: 'Notificação com falha',
    description: 'A compra é confirmada, mas a entrega da notificação falha.',
  },
  {
    id: 'unavailable',
    label: 'Dependência indisponível',
    description: 'Respostas 503 explícitas, sem fallback para sucesso simulado.',
  },
  {
    id: 'empty',
    label: 'Catálogo vazio',
    description: 'Lista vazia para validar o estado sem resultados.',
  },
];
