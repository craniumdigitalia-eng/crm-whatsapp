import { Suspense } from 'react';
import type { Metadata } from 'next';
import KanbanBoard from '@/components/KanbanBoard';

export const metadata: Metadata = {
  title: 'CRM · Kanban — Cranium Digital',
};

// Suspense necessário pelo uso de useSearchParams() no KanbanBoard (Next.js 15).
export default function CrmPage() {
  return (
    <Suspense>
      <KanbanBoard />
    </Suspense>
  );
}
