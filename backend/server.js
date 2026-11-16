const http = require("node:http");
const crypto = require("node:crypto");

const port = Number.parseInt(process.env.PORT || "3000", 10);

const state = {
  config: { ttl_reserva_segundos: 20, atraso_pagamento_ms: 3000 },
  usuarios: [],
  assentos: {},
  precos: {},
  setorDe: {},
  reservas: {},
  idemReserva: {},
  idemPag: {},
  pagamentos: [],
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function send(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(payload);
}

function carregar(dados) {
  state.config = dados.config || { ttl_reserva_segundos: 20, atraso_pagamento_ms: 3000 };
  state.usuarios = dados.usuarios || [];
  state.assentos = {};
  state.precos = {};
  state.setorDe = {};
  state.reservas = {};
  state.idemReserva = {};
  state.idemPag = {};
  state.pagamentos = [];

  const locais = {};
  for (const local of dados.locais || []) locais[local.local_id] = local;

  for (const evento of dados.eventos || []) {
    const local = locais[evento.local_id];
    const disponibilidade = {};
    for (const setor of local.setores) {
      for (const assentoId of setor.assentos) {
        disponibilidade[assentoId] = "disponivel";
        state.precos[assentoId] = setor.preco;
        state.setorDe[assentoId] = setor.setor;
      }
    }
    state.assentos[evento.evento_id] = disponibilidade;
  }
}

function resetar() {
  state.reservas = {};
  state.idemReserva = {};
  state.idemPag = {};
  state.pagamentos = [];
  for (const disponibilidade of Object.values(state.assentos)) {
    for (const assentoId of Object.keys(disponibilidade)) {
      disponibilidade[assentoId] = "disponivel";
    }
  }
}

function expirar() {
  const agora = Date.now();
  for (const reserva of Object.values(state.reservas)) {
    if (reserva.status !== "reservada" || reserva.expira > agora) continue;
    reserva.status = "expirada";
    const disponibilidade = state.assentos[reserva.evento_id];
    if (!disponibilidade) continue;
    for (const assentoId of reserva.assento_ids) {
      if (disponibilidade[assentoId] === "reservado") disponibilidade[assentoId] = "disponivel";
    }
  }
}

function publica(reserva) {
  return {
    reserva_id: reserva.id,
    status: reserva.status,
    valor_total: reserva.valor,
    expira_em: new Date(reserva.expira).toISOString(),
  };
}

function reservar(corpo, chave) {
  expirar();
  if (chave && state.idemReserva[chave]) {
    return { status: 200, body: publica(state.reservas[state.idemReserva[chave]]) };
  }

  const eventoId = corpo.evento_id;
  const assentoIds = Array.isArray(corpo.assento_ids) ? corpo.assento_ids : [];
  const disponibilidade = state.assentos[eventoId];
  if (!disponibilidade) return { status: 404, body: { erro: "evento inexistente" } };
  if (assentoIds.length === 0 || assentoIds.some((id) => disponibilidade[id] !== "disponivel")) {
    return { status: 409, body: { erro: "assento indisponivel" } };
  }

  for (const assentoId of assentoIds) disponibilidade[assentoId] = "reservado";
  const reserva = {
    id: crypto.randomUUID(),
    evento_id: eventoId,
    usuario_id: corpo.usuario_id,
    assento_ids: assentoIds,
    status: "reservada",
    valor: assentoIds.reduce((soma, id) => soma + state.precos[id], 0),
    chave,
    expira: Date.now() + state.config.ttl_reserva_segundos * 1000,
  };
  state.reservas[reserva.id] = reserva;
  if (chave) state.idemReserva[chave] = reserva.id;
  return { status: 201, body: publica(reserva) };
}

function listarAssentos(eventoId, setor) {
  expirar();
  const disponibilidade = state.assentos[eventoId];
  if (!disponibilidade) return null;
  const assentos = [];
  for (const [assentoId, status] of Object.entries(disponibilidade)) {
    if (!setor || state.setorDe[assentoId] === setor) {
      assentos.push({ assento_id: assentoId, status });
    }
  }
  return { evento_id: eventoId, setor: setor ?? null, assentos };
}

function vendasDoEvento(eventoId) {
  expirar();
  const reservasDoEvento = Object.values(state.reservas).filter((reserva) => reserva.evento_id === eventoId);
  const vendas = [];
  for (const reserva of reservasDoEvento) {
    if (reserva.status !== "confirmada") continue;
    for (const assentoId of reserva.assento_ids) {
      vendas.push({
        reserva_id: reserva.id,
        assento_id: assentoId,
        usuario_id: reserva.usuario_id,
        idempotency_key: reserva.chave,
      });
    }
  }
  const pagamentos = state.pagamentos.filter((pagamento) => {
    const reserva = state.reservas[pagamento.reserva_id];
    return reserva && reserva.evento_id === eventoId;
  });
  const reservas = reservasDoEvento.map((reserva) => ({
    reserva_id: reserva.id,
    status: reserva.status,
    assento_ids: reserva.assento_ids,
    idempotency_key: reserva.chave,
  }));
  return { evento_id: eventoId, vendas, pagamentos_aprovados: pagamentos, reservas };
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function respostaConfirmada(reserva) {
  return {
    status: 200,
    body: { reserva_id: reserva.id, status: "confirmada", valor_cobrado: reserva.valor },
  };
}

function confirmar(reserva, chave) {
  reserva.status = "confirmada";
  const disponibilidade = state.assentos[reserva.evento_id];
  if (disponibilidade) {
    for (const assentoId of reserva.assento_ids) disponibilidade[assentoId] = "vendido";
  }
  state.pagamentos.push({
    reserva_id: reserva.id,
    valor: reserva.valor,
    idempotency_key: chave,
  });
  return respostaConfirmada(reserva);
}

function recusar(reserva) {
  reserva.status = "recusada";
  const disponibilidade = state.assentos[reserva.evento_id];
  if (disponibilidade) {
    for (const assentoId of reserva.assento_ids) {
      if (disponibilidade[assentoId] === "reservado") disponibilidade[assentoId] = "disponivel";
    }
  }
  return { status: 402, body: { reserva_id: reserva.id, status: "recusada" } };
}

function decidirPagamento(reservaId, simulacao, chave) {
  expirar();
  const reserva = state.reservas[reservaId];
  if (!reserva) return { status: 409, body: { reserva_id: reservaId, status: null } };
  if (reserva.status === "confirmada") return respostaConfirmada(reserva);
  if (reserva.status !== "reservada") {
    return { status: 409, body: { reserva_id: reservaId, status: reserva.status } };
  }
  if (simulacao === "recusar") return recusar(reserva);
  return confirmar(reserva, chave);
}

async function executarPagamento(reservaId, simulacao, chave) {
  if (simulacao === "atrasar") {
    expirar();
    const reserva = state.reservas[reservaId];
    if (reserva?.status !== "reservada") return decidirPagamento(reservaId, "aprovar", chave);
    await esperar(state.config.atraso_pagamento_ms);
  }
  return decidirPagamento(reservaId, simulacao === "atrasar" ? "aprovar" : simulacao, chave);
}

function pagar(reservaId, corpo, chave) {
  const simulacao = corpo.simulacao || "aprovar";
  if (chave && state.idemPag[chave]) return state.idemPag[chave];
  const promessa = executarPagamento(reservaId, simulacao, chave);
  if (chave) state.idemPag[chave] = promessa;
  return promessa;
}

const metodosComCorpo = new Set(["POST", "PUT", "PATCH"]);

async function lerJson(request, response) {
  if (!metodosComCorpo.has(request.method)) return {};
  const raw = await readBody(request);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    send(response, 400, { erro: "json invalido" });
    return null;
  }
}

function responderAssentos(eventoId, setor) {
  const lista = listarAssentos(eventoId, setor);
  if (!lista) return { status: 404, body: { erro: "evento inexistente" } };
  return { status: 200, body: lista };
}

function responderReserva(reservaId) {
  expirar();
  const reserva = state.reservas[reservaId];
  if (!reserva) return { status: 404, body: { erro: "reserva inexistente" } };
  return { status: 200, body: publica(reserva) };
}

function tratarHealth() {
  return { status: 200, body: { status: "ok", service: "backend" } };
}

function tratarReset() {
  resetar();
  return { status: 200, body: { ok: true } };
}

function tratarCarga(ctx) {
  carregar(ctx.body);
  return { status: 201, body: { ok: true } };
}

function tratarReservas(ctx) {
  return reservar(ctx.body, ctx.chave);
}

function tratarVendas(ctx) {
  return { status: 200, body: vendasDoEvento(ctx.url.searchParams.get("evento_id")) };
}

const rotasFixas = {
  "GET /health": tratarHealth,
  "POST /_teste/reset": tratarReset,
  "POST /_teste/carga": tratarCarga,
  "POST /reservas": tratarReservas,
  "GET /_teste/vendas": tratarVendas,
};

function rotaParametrica(ctx) {
  const { method, parts } = ctx;
  if (method === "GET" && parts[0] === "eventos" && parts[2] === "assentos") {
    return responderAssentos(parts[1], ctx.url.searchParams.get("setor"));
  }
  if (method === "GET" && parts[0] === "reservas" && parts.length === 2) {
    return responderReserva(parts[1]);
  }
  if (method === "POST" && parts[0] === "reservas" && parts[2] === "pagamento") {
    return pagar(parts[1], ctx.body, ctx.chave);
  }
  return null;
}

function despachar(request, url, parts, body) {
  const ctx = {
    method: request.method,
    url,
    parts,
    body,
    chave: request.headers["idempotency-key"],
  };
  const fixa = rotasFixas[`${ctx.method} ${url.pathname}`];
  if (fixa) return fixa(ctx);
  return rotaParametrica(ctx);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const body = await lerJson(request, response);
  if (body === null) return;
  const resultado = await despachar(request, url, parts, body);
  if (!resultado) {
    send(response, 404, { erro: "rota inexistente" });
    return;
  }
  send(response, resultado.status, resultado.body);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});
