import type { Metadata } from 'next';
import MoreMenu from '@/components/MoreMenu';

export const metadata: Metadata = {
  title: 'Menu — Cranium Digital',
};

// Aba "Mais" (mobile): menu com todos os módulos, já que a sidebar some no celular.
export default function MaisPage() {
  return <MoreMenu />;
}
