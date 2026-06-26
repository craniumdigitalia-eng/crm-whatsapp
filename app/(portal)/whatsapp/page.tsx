import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WhatsApp — Cranium Digital',
};

// Story 5.9 — WhatsApp Connect QR
export default function WhatsappPage() {
  return (
    <section className="placeholder-section">
      <div className="placeholder-content">
        <div className="placeholder-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2>WhatsApp</h2>
        <p>Em desenvolvimento — Story 5.9</p>
      </div>
    </section>
  );
}
