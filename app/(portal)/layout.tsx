import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { createClient } from '@/lib/supabase/server';

// Layout do portal autenticado: injeta Sidebar + Topbar e exige sessao.
// Route group "(portal)" — nao altera as URLs (/, /crm, /leads, ... continuam iguais).
// Story 5.2.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defesa em profundidade — o middleware ja redireciona, mas garantimos no server.
  if (!user) redirect('/login');

  // Perfil (nome + papel) da tabela profiles (migration 004). RLS deixa o usuario
  // ler o proprio registro. Se a tabela ainda nao existe, caimos no fallback do email.
  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email, role')
    .eq('id', user.id)
    .maybeSingle();

  const sidebarUser = {
    nome: profile?.nome ?? user.email ?? 'Usuário',
    email: profile?.email ?? user.email ?? '',
    role: (profile?.role as 'admin' | 'atendente' | undefined) ?? 'atendente',
  };

  return (
    <>
      <Sidebar user={sidebarUser} />
      <div className="main">
        <Topbar />
        {children}
      </div>
    </>
  );
}
