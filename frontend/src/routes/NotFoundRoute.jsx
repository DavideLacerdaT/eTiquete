import React from 'react';
import { Link } from 'react-router';
import { Empty } from '../ui.jsx';
import { paths } from './paths.js';

export default function NotFoundRoute() {
  return (
    <Empty title="Página não encontrada">
      O endereço pode ter mudado. Continue pelos eventos disponíveis.
      <br />
      <Link className="button primary" to={paths.events}>
        Explorar eventos
      </Link>
    </Empty>
  );
}
