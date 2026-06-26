import type { Metadata } from 'next';
import FollowupsModule from '@/components/FollowupsModule';

export const metadata: Metadata = {
  title: 'Follow-up — Cranium Digital',
};

// Aba "Follow-up" (migration 008) — programar follow-ups especificos por lead
// ("lembrar o lead X em 2 dias com esta mensagem"). Complementa o follow-up
// automatico (que roda sozinho via cron). Qualquer membro da equipe opera.
export default function FollowupsPage() {
  return <FollowupsModule />;
}
