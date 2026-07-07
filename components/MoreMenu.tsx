'use client';

import Link from 'next/link';

/* ============================================================
   Menu "Mais" (mobile) — lista todos os módulos do portal, já que a
   sidebar some no celular. Agrupado como a sidebar. Identidade Cranium.
   ============================================================ */

const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: 'Atendimento',
    items: [
      { href: '/', label: 'Início' },
      { href: '/crm', label: 'CRM · Funil' },
      { href: '/conversas', label: 'Conversas' },
      { href: '/grupos', label: 'Grupos' },
      { href: '/demandas', label: 'Demandas' },
      { href: '/followups', label: 'Follow-up' },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { href: '/agente', label: 'Agente IA' },
      { href: '/bi', label: 'Métricas & BI' },
      { href: '/financeiro', label: 'Financeiro' },
      { href: '/metas', label: 'Metas' },
    ],
  },
  {
    title: 'Operações',
    items: [
      { href: '/agenda', label: 'Agenda' },
      { href: '/whatsapp', label: 'WhatsApp' },
      { href: '/email', label: 'Email Marketing' },
      { href: '/integracoes', label: 'Integrações' },
      { href: '/config', label: 'Configurações' },
    ],
  },
];

export default function MoreMenu() {
  return (
    <section className="more-menu">
      <header className="more-head">
        <h1 className="more-title">Menu</h1>
        <p className="more-sub">Todos os módulos do portal</p>
      </header>
      {GROUPS.map((g) => (
        <div className="more-group" key={g.title}>
          <span className="more-group-title">{g.title}</span>
          <div className="more-list">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className="more-item">
                <span>{it.label}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
