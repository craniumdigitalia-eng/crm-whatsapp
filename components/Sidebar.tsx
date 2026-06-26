'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';

// Usuario logado, vindo do layout server (app/(portal)/layout.tsx). Story 5.2.
export interface SidebarUser {
  nome: string;
  email: string;
  role: 'admin' | 'atendente';
}

const ROLE_LABELS: Record<SidebarUser['role'], string> = {
  admin: 'Admin',
  atendente: 'Atendente',
};

interface NavItemDef {
  href: string;
  module: string;
  label: string;
  ariaLabel?: string;
  badge?: string;
  icon: React.ReactNode;
}

const NAV_SECTIONS: Array<{ title: string; items: NavItemDef[] }> = [
  {
    title: 'Principal',
    items: [
      {
        href: '/',
        module: 'dashboard',
        label: 'Dashboard',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
        ),
      },
      {
        href: '/crm',
        module: 'crm',
        label: 'CRM',
        ariaLabel: 'CRM Kanban',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="8"  y1="5" x2="8"  y2="19"/>
            <line x1="16" y1="5" x2="16" y2="19"/>
          </svg>
        ),
      },
      {
        href: '/leads',
        module: 'leads',
        label: 'Leads',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      {
        href: '/bi',
        module: 'bi',
        label: 'Métricas & BI',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Operações',
    items: [
      {
        href: '/agenda',
        module: 'agenda',
        label: 'Agenda',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        ),
      },
      {
        href: '/whatsapp',
        module: 'whatsapp',
        label: 'WhatsApp',
        ariaLabel: 'WhatsApp (2 novas mensagens)',
        badge: '2',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
      },
      {
        href: '/integracoes',
        module: 'integracoes',
        label: 'Integrações',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <path d="M9 2v6"/>
            <path d="M15 2v6"/>
            <path d="M7 8h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"/>
            <path d="M12 16v6"/>
          </svg>
        ),
      },
      {
        href: '/config',
        module: 'config',
        label: 'Config',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0
                     0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65
                     1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65
                     1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0
                     0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0
                     0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06
                     -.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2
                     2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const initial = (user.nome.trim()[0] ?? 'U').toUpperCase();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="sidebar" aria-label="Menu do CRM">

      {/* Brand lockup */}
      <Link href="/crm" className="sidebar-brand" aria-label="Cranium Digital — início">
        <div
          className="brand-logo"
          role="img"
          aria-label="Logo Cranium Digital"
        />
        <div className="brand-wordmark" aria-hidden="true">
          <span className="brand-wordmark__name">Cranium</span>
          <span className="brand-wordmark__suffix">digital</span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Módulos">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <span className="nav-section" aria-hidden="true">{section.title}</span>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${active ? ' active' : ''}`}
                  data-module={item.module}
                  aria-label={item.ariaLabel ?? item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="nav-badge" aria-label={`${item.badge} novas mensagens`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: IA status + user */}
      <div className="sidebar-bottom">
        <div className="ai-status-bar" role="status" aria-live="polite">
          <span className="ai-status-dot" aria-hidden="true" />
          <span className="ai-status-text">IA ativa · respondendo</span>
        </div>
        <div className="sidebar-user" aria-label={`Usuário ${user.nome}`}>
          <div className="user-avatar" aria-hidden="true">{initial}</div>
          <div className="user-info">
            <div className="user-name" title={user.email}>{user.nome}</div>
            <div className="user-role">{ROLE_LABELS[user.role]}</div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
