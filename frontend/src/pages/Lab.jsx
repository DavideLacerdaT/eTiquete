import React, { useState } from 'react';
import { Activity, Code2, FlaskConical } from 'lucide-react';
import { api, dataMode, mock, savePreferences, scenario } from '../api.js';
import { scenarios, services } from '../../../mocks/fixtures.js';
import { ErrorNotice } from '../ui.jsx';

const serviceNames = {
  catalog: 'Catálogo',
  admissions: 'Admissão',
  reservations: 'Reservas',
  orders: 'Pedidos / SAGA',
  payments: 'Pagamentos',
  notifications: 'Notificações',
};

function Lab() {
  const [mode, setMode] = useState(dataMode),
    [selectedScenario, setSelectedScenario] = useState(scenario),
    [config, setConfig] = useState(null),
    [error, setError] = useState(null),
    [tab, setTab] = useState('catalog'),
    [example, setExample] = useState(null),
    [busy, setBusy] = useState(false);
  async function inspect() {
    setBusy(true);
    setError(null);
    const paths = {
      catalog: '/events',
      admissions: '/admissions',
      reservations: '/reservations',
      orders: '/orders',
      payments: '/payments/00000007-0000-4000-8000-000000000001',
      notifications: '/notifications',
    };
    try {
      setExample(
        await api(
          tab === 'admissions' ? 'POST' : 'GET',
          paths[tab],
          tab === 'admissions'
            ? {
                eventId: '00000001-0000-4000-8000-000000000001',
                sessionId: '00000002-0000-4000-8000-000000000001',
              }
            : undefined,
        ),
      );
    } catch (e) {
      setError(e);
      setExample(null);
    } finally {
      setBusy(false);
    }
  }
  async function gateway() {
    try {
      const r = await fetch('/api/v1/_dev/services');
      if (!r.ok) throw new Error('Gateway indisponível. Inicie o serviço na porta 3001.');
      setConfig(await r.json());
      setError(null);
    } catch {
      setError(new Error('Gateway indisponível. Inicie o serviço na porta 3001.'));
    }
  }
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">ESPAÇO DE DESENVOLVIMENTO</span>
        <h1>Cada serviço, no seu ritmo.</h1>
        <p>Explore contratos e cenários sem depender de toda a infraestrutura.</p>
      </div>
      <ErrorNotice error={error} />
      <section className="lab-panel">
        <div className="section-heading">
          <h2>Fonte dos dados</h2>
          <span className="badge blue">
            {dataMode === 'mock' ? 'Mock no navegador' : 'Gateway HTTP'}
          </span>
        </div>
        <div className="mode-cards">
          <label className={mode === 'mock' ? 'chosen' : ''}>
            <input
              type="radio"
              name="mode"
              value="mock"
              checked={mode === 'mock'}
              onChange={() => setMode('mock')}
            />
            <FlaskConical />
            <strong>Mock no navegador</strong>
            <span>Frontend independente. Fixtures e fluxos em memória.</span>
          </label>
          <label className={mode === 'gateway' ? 'chosen' : ''}>
            <input
              type="radio"
              name="mode"
              value="gateway"
              checked={mode === 'gateway'}
              onChange={() => setMode('gateway')}
            />
            <Activity />
            <strong>Gateway HTTP</strong>
            <span>Chamadas em /api/v1. O servidor escolhe cada dependência.</span>
          </label>
        </div>
        <label>
          Cenário do mock no navegador
          <select
            disabled={mode !== 'mock'}
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">{scenarios.find((s) => s.id === selectedScenario)?.description}</p>
        <p className="small-text">
          Aplicar reinicia a demonstração local. No Gateway, use DATA_MODE, MOCK_SCENARIO e as
          variáveis de cada dependência no processo.
        </p>
        <button
          className="button primary"
          onClick={() => {
            try {
              savePreferences(mode, selectedScenario);
            } catch {
              setError(new Error('O navegador não permitiu salvar a preferência.'));
            }
          }}
        >
          Aplicar e reiniciar demonstração
        </button>
      </section>
      <section className="lab-panel">
        <div className="section-heading">
          <h2>Microsserviços</h2>
          <button className="text-button" onClick={gateway}>
            Consultar Gateway <Activity size={16} />
          </button>
        </div>
        <div className="service-grid">
          {services.map((s, i) => (
            <div className="service-card" key={s}>
              <span className={`round-icon ${['yellow', 'pink', 'green', 'blue'][i % 4]}`}>
                <Code2 size={20} />
              </span>
              <h3>{serviceNames[s]}</h3>
              <small>Porta {3011 + i}</small>
              <span className="badge neutral">
                {dataMode === 'mock'
                  ? 'Mock local'
                  : config?.dependencies[s]?.mode || 'Consultar configuração'}
              </span>
            </div>
          ))}
        </div>
        <p className="small-text muted">
          Os processos de desenvolvimento usam estado em memória. HTTP e Kafka reais podem conectar
          os serviços; persistência e recuperação de produção ainda precisam ser implementadas.
        </p>
      </section>
      <section className="lab-panel">
        <div className="section-heading">
          <h2>Explorar os contratos</h2>
          <span className="badge neutral">v1</span>
        </div>
        <div className="actions">
          <select
            aria-label="Serviço para inspecionar"
            value={tab}
            onChange={(e) => {
              setTab(e.target.value);
              setExample(null);
            }}
          >
            {services.map((s) => (
              <option value={s} key={s}>
                {serviceNames[s]}
              </option>
            ))}
          </select>
          <button className="button primary" disabled={busy} onClick={inspect}>
            {busy ? 'Consultando…' : 'Consultar exemplo'}
          </button>
        </div>
        {example && <pre className="json-view">{JSON.stringify(example, null, 2)}</pre>}
      </section>
      {dataMode === 'mock' && (
        <section className="lab-panel">
          <h2>Mensagens da sessão</h2>
          <p className="muted">Comandos e eventos produzidos pelas compras desta demonstração.</p>
          <pre className="json-view">{JSON.stringify(mock.messages, null, 2)}</pre>
        </section>
      )}
    </>
  );
}

export default Lab;
