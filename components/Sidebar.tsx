'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AiToggle from './AiToggle';
import LogoutButton from './LogoutButton';

// Usuario logado, vindo do layout server (app/(portal)/layout.tsx). Story 5.2.
export interface SidebarUser {
  nome: string;
  email: string;
  role: 'admin' | 'atendente';
  avatarUrl?: string | null;
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
        href: '/conversas',
        module: 'conversas',
        label: 'Conversas',
        ariaLabel: 'Conversas — inbox estilo WhatsApp',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>
          </svg>
        ),
      },
      {
        href: '/followups',
        module: 'followups',
        label: 'Follow-up',
        ariaLabel: 'Follow-up — programar lembretes por lead',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7v5l3 2"/>
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
        href: '/agente',
        module: 'agente',
        label: 'Agente IA',
        ariaLabel: 'Agente IA — personalizar o atendimento automático',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <rect x="5" y="8" width="14" height="11" rx="2.5"/>
            <path d="M12 8V4"/>
            <circle cx="12" cy="3" r="1.2"/>
            <line x1="2.5" y1="13" x2="5" y2="13"/>
            <line x1="19" y1="13" x2="21.5" y2="13"/>
            <circle cx="9.5" cy="13" r="1.1"/>
            <circle cx="14.5" cy="13" r="1.1"/>
            <line x1="9.5" y1="16" x2="14.5" y2="16"/>
          </svg>
        ),
      },
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
        href: '/email',
        module: 'email',
        label: 'Email Marketing',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="m3 7 9 6 9-6"/>
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

      {/* Bottom: IA toggle + user */}
      <div className="sidebar-bottom">
        <AiToggle />
        <div className="sidebar-user">
          <Link
            href="/config"
            className="sidebar-user-link"
            aria-label={`Configurações — ${user.nome}`}
          >
            <div className="user-avatar" aria-hidden="true">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="user-avatar-img" />
              ) : (
                initial
              )}
            </div>
            <div className="user-info">
              <div className="user-name" title={user.email}>{user.nome}</div>
              <div className="user-role">{ROLE_LABELS[user.role]}</div>
            </div>
          </Link>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
