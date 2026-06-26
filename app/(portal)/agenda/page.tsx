import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agenda — Cranium Digital',
};

// Story 5.7 — módulo de agendamento
export default function AgendaPage() {
  return (
    <section className="placeholder-section">
      <div className="placeholder-content">
        <div className="placeholder-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h2>Agenda</h2>
        <p>Em desenvolvimento — Story 5.7</p>
      </div>
    </section>
  );
}
