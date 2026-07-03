import type { Metadata } from 'next';
import GruposList from '@/components/GruposList';

export const metadata: Metadata = {
  title: 'Grupos — Cranium Digital',
};

// Aba Grupos: lista todos os grupos de WhatsApp da Cranium (via Evolution).
export default function GruposPage() {
  return <GruposList />;
}
