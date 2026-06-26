import type { Metadata } from 'next';
import KanbanBoard from '@/components/KanbanBoard';

export const metadata: Metadata = {
  title: 'CRM · Kanban — Cranium Digital',
};

export default function CrmPage() {
  return <KanbanBoard />;
}
