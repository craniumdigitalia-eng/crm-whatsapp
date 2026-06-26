'use client';

import { usePathname } from 'next/navigation';

interface Breadcrumb {
  page: string;
  sub?: string;
}

function getBreadcrumb(pathname: string): Breadcrumb {
  if (pathname.startsWith('/crm'))       return { page: 'CRM',          sub: 'Kanban' };
  if (pathname.startsWith('/leads'))     return { page: 'Leads' };
  if (pathname.startsWith('/bi'))        return { page: 'Métricas & BI' };
  if (pathname.startsWith('/agenda'))    return { page: 'Agenda' };
  if (pathname.startsWith('/whatsapp')) return { page: 'WhatsApp' };
  if (pathname.startsWith('/config'))   return { page: 'Config' };
  return { page: 'Dashboard' };
}

export default function Topbar() {
  const pathname = usePathname();
  const { page, sub } = getBreadcrumb(pathname);

  return (
    <header className="topbar">
      {/* Breadcrumb */}
      <div className="topbar-breadcrumb">
        <span className="topbar-page">{page}</span>
        {sub && (
          <>
            <span className="topbar-sep" aria-hidden="true">/</span>
            <span className="topbar-sub">{sub}</span>
          </>
        )}
      </div>

      {/* Search */}
      <div className="topbar-search" role="search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="#94A3B8" strokeWidth={2} aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          placeholder="Buscar lead, telefone, serviço…"
          aria-label="Buscar leads"
        />
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        <button className="icon-btn" aria-label="Notificações (1 nova)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="notif-dot" aria-hidden="true" />
        </button>

        <button className="icon-btn" aria-label="Filtrar leads">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
        </button>

        <div
          className="topbar-avatar"
          tabIndex={0}
          role="button"
          aria-label="Perfil: Bruno de Castro"
          aria-haspopup="true"
        >B</div>
      </div>
    </header>
  );
}
