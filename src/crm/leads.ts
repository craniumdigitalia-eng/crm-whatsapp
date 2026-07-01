import { supabase } from "../db";
import { Lead, Message, LeadStatus, LeadAttribution } from "../types";

// Colunas explicitas — evita SELECT * e garante paridade com a interface Lead.
// photo_url adicionado na migration 010.
const LEAD_COLS =
  "id,phone,name,email,status,service_interest,budget,notes,photo_url,follow_up_count,last_direction,last_message_at,created_at,updated_at";
const MSG_COLS = "id,lead_id,direction,body,external_id,created_at";
// Colunas da migration 003 — selecionadas a parte (podem nao existir antes da migration).
const ATTRIBUTION_COLS = "source,form_id,leadgen_id,ad_id,campaign_id,form_data";

export async function findLeadByPhone(phone: string): Promise<Lead | undefined> {
  const { data } = await supabase.from("leads").select(LEAD_COLS).eq("phone", phone).maybeSingle();
  return (data as Lead) ?? undefined;
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const { data } = await supabase.from("leads").select(LEAD_COLS).eq("id", id).maybeSingle();
  return (data as Lead) ?? undefined;
}

export async function getOrCreateLead(phone: string, name?: string): Promise<Lead> {
  // 1) tenta achar pelo telefone
  const { data: existing } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) {
    if (name && !existing.name) {
      const { error: nameErr } = await supabase.from("leads").update({ name }).eq("id", existing.id);
      if (nameErr) {
        // Nao-critico: lead retornado mesmo sem o update; loga para visibilidade.
        console.error(`[leads] getOrCreateLead: falha ao atualizar name do lead ${existing.id}:`, nameErr.message);
      } else {
        existing.name = name;
      }
    }
    return existing as Lead;
  }

  // 2) cria (id via gen_random_uuid() default — nao passe id)
  const { data: created, error } = await supabase
    .from("leads")
    .insert({ phone, name: name ?? null, status: "novo" })
    .select(LEAD_COLS)
    .single();

  // 3) race: outro processo criou o mesmo telefone entre o select e o insert (23505 = unique violation)
  if (error?.code === "23505") {
    const { data } = await supabase.from("leads").select(LEAD_COLS).eq("phone", phone).single();
    return data as Lead;
  }
  if (error) throw error;

  // Lead realmente inserido — notifica o operador. Best-effort (import dinâmico
  // evita circular; nunca bloqueia nem lança).
  void (async () => {
    try {
      const { notificarLeadNovo } = await import("./notify");
      await notificarLeadNovo(created as Lead);
    } catch (e) {
      console.warn("[leads] getOrCreateLead: notificarLeadNovo falhou:", e instanceof Error ? e.message : e);
    }
  })();

  return created as Lead;
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function getMessages(leadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

// Insere uma mensagem e atualiza o lead. Retorna true se inserida, false se duplicata (external_id ja existe).
// Mensagens sem externalId (respostas 'out' do agente) inserem normalmente — o indice e parcial (WHERE external_id IS NOT NULL).
export async function addMessage(
  leadId: string,
  direction: "in" | "out",
  body: string,
  externalId?: string
): Promise<boolean> {
  const { error } = await supabase.from("messages").insert({
    lead_id: leadId,
    direction,
    body,
    external_id: externalId ?? null,
  });

  // 23505 = duplicate key — external_id ja existe (idempotencia de mensagens recebidas)
  if (error?.code === "23505") return false;
  if (error) throw error;

  const { error: updErr } = await supabase
    .from("leads")
    .update({ last_direction: direction, last_message_at: new Date().toISOString() })
    .eq("id", leadId);
  if (updErr) {
    // Insert confirmado; UPDATE secundario falhou (erro raro). Loga para visibilidade sem reverter.
    console.error(`[leads] addMessage: falha ao atualizar lead ${leadId} apos insert:`, updErr.message);
  }

  return true;
}

// Quando o lead responde, zera o contador de follow-up.
export async function resetFollowUp(leadId: string): Promise<void> {
  const { error } = await supabase.from("leads").update({ follow_up_count: 0 }).eq("id", leadId);
  if (error) throw error;
}

// Candidatos ao proximo ciclo de follow-up:
// status em statuses, ultimo envio foi 'out', last_message_at existente e abaixo do limite.
// limit: maximo de linhas retornadas por ciclo — evita lotes grandes em funcoes serverless.
export async function listFollowUpCandidates(
  statuses: string[],
  maxCount: number,
  limit = 50
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .in("status", statuses)
    .eq("last_direction", "out")
    .not("last_message_at", "is", null)
    .lt("follow_up_count", maxCount)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

// Claim atomico que SETA follow_up_count para um valor arbitrario `newCount`
// (>= expectedCount + 1). Generaliza o "claim-then-send" para permitir o
// fast-forward do indice da cadencia (pular toques atrasados ao retomar um lead
// que ficou conversando — fix [K1]), sem abrir janela de duplo-envio.
// So vence se o lead ainda esta elegivel no momento do claim:
//   - last_direction = 'out'          (lead nao respondeu desde o ultimo envio)
//   - last_message_at expirou         (intervalo ja passou)
//   - follow_up_count == expectedCount (optimistic lock — evita duplo-claim em corrida de cron)
//   - follow_up_count < maxCount      (limite ainda nao atingido)
// Ao vencer, reescreve last_message_at para agora — reinicia o relogio do intervalo
// (fecha a janela de claims sequenciais rapidos, fix #12).
export async function claimFollowUpTo(
  leadId: string,
  expectedCount: number,
  newCount: number,
  maxCount: number,
  intervalMs: number
): Promise<boolean> {
  const intervalAgo = new Date(Date.now() - intervalMs).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("leads")
    .update({ follow_up_count: newCount, last_message_at: now })
    .eq("id", leadId)
    .eq("last_direction", "out")
    .not("last_message_at", "is", null)
    .lt("last_message_at", intervalAgo)
    .eq("follow_up_count", expectedCount)
    .lt("follow_up_count", maxCount)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Claim atomico de um slot de follow-up (padrao "claim-then-send"): incrementa
// follow_up_count em 1. Caso especial de claimFollowUpTo usado pelo motor
// ROTATION/fallback. Mantido para nao alterar os chamadores existentes.
export async function claimFollowUp(
  leadId: string,
  expectedCount: number,
  maxCount: number,
  intervalMs: number
): Promise<boolean> {
  return claimFollowUpTo(leadId, expectedCount, expectedCount + 1, maxCount, intervalMs);
}

export async function updateLeadFields(
  leadId: string,
  fields: Partial<Pick<Lead, "name" | "email" | "status" | "service_interest" | "budget" | "notes">>
): Promise<void> {
  const allowed = ["name", "email", "status", "service_interest", "budget", "notes"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw error;
}

export async function setStatus(leadId: string, status: LeadStatus): Promise<void> {
  // Import dinâmico evita import circular (email-automation → email → leads seria circular
  // se leads importasse email-automation no topo do arquivo junto com updateLeadFields).
  const { getEmailAutomation, enviarEmailDeEtapa } = await import("./email-automation");

  const auto = await getEmailAutomation();

  // Caminho rápido: automação desligada ou nenhum template mapeado para este estágio.
  // Se o destino for 'humano', ainda precisamos ler o estado anterior para a notificação.
  if (!auto.enabled || !auto.map[status]) {
    if (status === "humano") {
      // Lê antes para detectar transição real (notificar só na primeira vez).
      const antesRapido = await getLead(leadId);
      await updateLeadFields(leadId, { status });
      if (antesRapido && antesRapido.status !== "humano") {
        void (async () => {
          try {
            const { notificarHumano } = await import("./notify");
            await notificarHumano({ ...(antesRapido as Lead), status });
          } catch (e) {
            console.warn("[leads] setStatus(rápido): notificarHumano falhou:", e instanceof Error ? e.message : e);
          }
        })();
      }
      return;
    }
    await updateLeadFields(leadId, { status });
    return;
  }

  // Automação aplicável: lê o estado atual para detectar transição real e ter o e-mail.
  const antes = await getLead(leadId);
  await updateLeadFields(leadId, { status });

  // Só dispara se houve mudança de estágio real e o lead tem e-mail.
  if (antes && antes.status !== status && antes.email) {
    // Best-effort: não bloqueia o fluxo principal se falhar/demorar.
    await enviarEmailDeEtapa(antes, status, auto.map[status]);
  }

  // Notifica o operador quando o lead precisa de atendimento humano.
  // Best-effort — import dinâmico evita circular; nunca bloqueia.
  if (antes && antes.status !== "humano" && status === "humano") {
    void (async () => {
      try {
        const { notificarHumano } = await import("./notify");
        // Monta um lead com o status novo para a notificação ter o contexto correto.
        await notificarHumano({ ...(antes as Lead), status });
      } catch (e) {
        console.warn("[leads] setStatus: notificarHumano falhou:", e instanceof Error ? e.message : e);
      }
    })();
  }
}

// Salva a URL da foto de perfil do WhatsApp no lead.
// Tolerante: se a coluna photo_url ainda nao existir (migration 010 pendente),
// captura o erro 42703 e loga sem propagar — nao quebra o atendimento.
export async function setLeadPhoto(id: string, url: string): Promise<void> {
  const { error } = await supabase.from("leads").update({ photo_url: url }).eq("id", id);
  if (error) {
    console.warn(`[leads] setLeadPhoto(${id}): ${error.message}`);
  }
}

// =====================================================================
// Atribuicao / origem (Story 5.14 — Meta Lead Ads).
// As colunas vivem na migration 003; estas funcoes sao tolerantes a
// migration ausente (retornam null / nao-op) para nao quebrar o CRM.
// =====================================================================

// Le os campos de atribuicao do lead. Se a migration 003 nao foi aplicada
// (coluna inexistente -> erro 42703), retorna null silenciosamente.
export async function getLeadAttribution(id: string): Promise<LeadAttribution | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(ATTRIBUTION_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn(`[leads] getLeadAttribution(${id}): ${error.message}`);
    return null;
  }
  return (data as LeadAttribution) ?? null;
}

// Acha um lead pelo leadgen_id do Meta (dedupe idempotente da importacao).
export async function findLeadByLeadgenId(leadgenId: string): Promise<Lead | undefined> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .eq("leadgen_id", leadgenId)
    .maybeSingle();
  if (error) {
    console.warn(`[leads] findLeadByLeadgenId(${leadgenId}): ${error.message}`);
    return undefined;
  }
  return (data as Lead) ?? undefined;
}

// Grava os campos de atribuicao em um lead existente.
export async function setLeadAttribution(
  leadId: string,
  attr: Partial<LeadAttribution>
): Promise<void> {
  const allowed = ["source", "form_id", "leadgen_id", "ad_id", "campaign_id", "form_data"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (attr[key] !== undefined) patch[key] = attr[key];
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw error;
}
