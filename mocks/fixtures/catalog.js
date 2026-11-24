import { id } from './identifiers.js';

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
