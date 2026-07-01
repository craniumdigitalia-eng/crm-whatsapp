'use client';

import { useCallback, useEffect, useState } from 'react';
import { STATUS_LABELS, type LeadStatus } from '@/src/types';

/* ============================================================
   Email Marketing (migration 007)
   Abas: Campanhas · Listas · Templates · Provedor
   Identidade Cranium (roxo/violeta, pill, cards).
   ============================================================ */

// ---------- tipos do client (espelham src/crm/email.ts) ----------
type CampaignStatus = 'rascunho' | 'enviando' | 'enviada' | 'erro';

interface Audience {
  type: 'leads' | 'list';
  list_id?: string;
  filters?: { status?: string[]; tags?: string[] };
}

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  template_id: string | null;
  html: string | null;
  audience: Audience | null;
  status: CampaignStatus;
  sent_count: number;
  created_at: string;
  sent_at: string | null;
}

interface EmailList {
  id: string;
  name: string;
  created_at: string;
  count: number;
}

interface Contact {
  id: string;
  email: string;
  name: string | null;
  unsubscribed: boolean;
}

interface Template {
  id: string;
  name: string;
  subject: string | null;
  html: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Stats {
  sent: number;
  open: number;
  click: number;
  bounce: number;
  unsubscribe: number;
}

interface ConfigStatus {
  provider: string;
  from: string;
  user: string;
  hasApiKey: boolean;
  hasAppPassword: boolean;
  configured: boolean;
}

const STATUS_PILL: Record<CampaignStatus, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'em-pill--draft' },
  enviando: { label: 'Enviando', cls: 'em-pill--sending' },
  enviada: { label: 'Enviada', cls: 'em-pill--sent' },
  erro: { label: 'Erro', cls: 'em-pill--err' },
};

const LEAD_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

// Temas para geração de pílula semanal com IA
const TEMAS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Surpreenda-me' },
  { value: 'Tráfego pago para corretor de plano de saúde', label: 'Tráfego pago para corretor de plano de saúde' },
  { value: 'Atendimento com IA no WhatsApp', label: 'Atendimento com IA no WhatsApp' },
  { value: 'Como escalar vendendo plano de saúde', label: 'Como escalar vendendo plano de saúde' },
  { value: 'Follow-up: por que o lead some', label: 'Follow-up: por que o lead some' },
  { value: 'Montar um funil previsível', label: 'Montar um funil previsível' },
  { value: 'Parar de depender de indicação', label: 'Parar de depender de indicação' },
  { value: 'Lista fria x lead que levanta a mão', label: 'Lista fria x lead que levanta a mão' },
];

async function apiCall<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: opts?.body ? { 'Content-Type': 'application/json', ...opts?.headers } : opts?.headers,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('nao autenticado');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Tab = 'campanhas' | 'listas' | 'templates' | 'provedor';

export default function EmailModule({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>('campanhas');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function flash(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 4000);
  }

  return (
    <section className="integ-page em-page">
      <header className="integ-head">
        <h1 className="integ-title">Email Marketing</h1>
        <p className="integ-subtitle">
          Crie campanhas, escolha o público (leads do CRM ou uma lista), envie e acompanhe
          aberturas e cliques.
        </p>
      </header>

      {msg && (
        <div className={`integ-banner ${msg.kind === 'ok' ? 'integ-banner--ok' : 'integ-banner--err'}`}>
          {msg.text}
        </div>
      )}

      <nav className="em-tabs" aria-label="Seções de Email Marketing">
        {(
          [
            ['campanhas', 'Campanhas'],
            ['listas', 'Listas'],
            ['templates', 'Templates'],
            ['provedor', 'Provedor'],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            className={`em-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'campanhas' && <CampaignsTab isAdmin={isAdmin} flash={flash} />}
      {tab === 'listas' && <ListsTab flash={flash} />}
      {tab === 'templates' && <TemplatesTab flash={flash} />}
      {tab === 'provedor' && <ProviderTab isAdmin={isAdmin} flash={flash} />}
    </section>
  );
}

type Flash = (kind: 'ok' | 'err', text: string) => void;

/* ============================================================
   Campanhas
   ============================================================ */
function CampaignsTab({ isAdmin, flash }: { isAdmin: boolean; flash: Flash }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { campaigns } = await apiCall<{ campaigns: Campaign[] }>('/api/email/campaigns');
      setCampaigns(campaigns);
    } catch (e) {
      flash('err', `Falha ao carregar campanhas: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    void load();
  }, [load]);

  if (selected) {
    return (
      <CampaignDetail
        id={selected}
        isAdmin={isAdmin}
        flash={flash}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="em-section">
      <div className="em-section-head">
        <h2 className="em-section-title">Campanhas</h2>
        <div className="em-section-actions">
          <button className="btn btn-ghost" type="button" onClick={() => setGenerating(true)}>
            Gerar pílula da semana (IA)
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>
            + Nova campanha
          </button>
        </div>
      </div>

      {loading ? (
        <p className="em-empty">Carregando…</p>
      ) : campaigns.length === 0 ? (
        <p className="em-empty">Nenhuma campanha ainda. Crie a primeira.</p>
      ) : (
        <div className="em-list">
          {campaigns.map((c) => (
            <button key={c.id} className="em-row" type="button" onClick={() => setSelected(c.id)}>
              <div className="em-row-main">
                <span className="em-row-name">{c.name}</span>
                <span className="em-row-sub">{c.subject || 'sem assunto'}</span>
              </div>
              <div className="em-row-meta">
                <span className={`em-pill ${STATUS_PILL[c.status].cls}`}>
                  {STATUS_PILL[c.status].label}
                </span>
                {c.status === 'enviada' && (
                  <span className="em-row-sent">{c.sent_count} enviados</span>
                )}
                <span className="em-row-date">{fmtDate(c.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <CampaignForm
          isAdmin={isAdmin}
          flash={flash}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {generating && (
        <GeneratePillModal
          flash={flash}
          onClose={() => setGenerating(false)}
          onGenerated={(campaign) => {
            setGenerating(false);
            void load();
            setSelected(campaign.id);
          }}
        />
      )}
    </div>
  );
}

function CampaignForm({
  isAdmin,
  flash,
  onClose,
  onSaved,
}: {
  isAdmin: boolean;
  flash: Flash;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [html, setHtml] = useState('');
  const [audType, setAudType] = useState<'leads' | 'list'>('leads');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [listId, setListId] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [t, l, tg] = await Promise.all([
          apiCall<{ templates: Template[] }>('/api/email/templates'),
          apiCall<{ lists: EmailList[] }>('/api/email/lists'),
          apiCall<{ tags: Tag[] }>('/api/tags'),
        ]);
        setTemplates(t.templates);
        setLists(l.lists);
        setTags(tg.tags);
      } catch {
        // silencioso — os selects ficam vazios
      }
    })();
  }, []);

  function buildAudience(): Audience {
    if (audType === 'list') return { type: 'list', list_id: listId };
    return { type: 'leads', filters: { status: statuses, tags: tagIds } };
  }

  async function doPreview() {
    try {
      const { count } = await apiCall<{ count: number }>('/api/email/preview', {
        method: 'POST',
        body: JSON.stringify({ audience: buildAudience() }),
      });
      setPreview(count);
    } catch (e) {
      flash('err', `Falha no preview: ${(e as Error).message}`);
    }
  }

  function toggle(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function create(): Promise<Campaign | null> {
    const { campaign } = await apiCall<{ campaign: Campaign }>('/api/email/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        subject: subject.trim() || undefined,
        template_id: templateId || undefined,
        html: html.trim() || undefined,
        audience: buildAudience(),
      }),
    });
    return campaign;
  }

  async function onSaveDraft() {
    if (!name.trim()) return flash('err', 'Dê um nome à campanha.');
    setBusy(true);
    try {
      await create();
      flash('ok', 'Rascunho salvo.');
      onSaved();
    } catch (e) {
      flash('err', `Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!name.trim()) return flash('err', 'Dê um nome à campanha.');
    if (audType === 'list' && !listId) return flash('err', 'Escolha uma lista.');
    setBusy(true);
    try {
      const campaign = await create();
      if (!campaign) throw new Error('campanha não criada');
      const r = await apiCall<{ sent: number; recipients: number; status: string }>(
        `/api/email/campaigns/${campaign.id}/send`,
        { method: 'POST' }
      );
      flash('ok', `Campanha enviada: ${r.sent}/${r.recipients} destinatários.`);
      onSaved();
    } catch (e) {
      flash('err', `Falha ao enviar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="em-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="em-modal" onClick={(e) => e.stopPropagation()}>
        <div className="em-modal-head">
          <h3>Nova campanha</h3>
          <button className="em-modal-close" type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="em-modal-body">
          <label className="em-field">
            <span>Nome (interno)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promo Junho" />
          </label>

          <label className="em-field">
            <span>Assunto do email</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto que o destinatário vê" />
          </label>

          <label className="em-field">
            <span>Template (opcional)</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— escrever HTML abaixo —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {!templateId && (
            <label className="em-field">
              <span>HTML do email</span>
              <textarea
                rows={6}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="<h1>Olá!</h1><p>Conteúdo…</p>"
              />
            </label>
          )}

          <div className="em-field">
            <span>Destinatários</span>
            <div className="em-radio-row">
              <label>
                <input
                  type="radio"
                  checked={audType === 'leads'}
                  onChange={() => {
                    setAudType('leads');
                    setPreview(null);
                  }}
                />
                Leads do CRM
              </label>
              <label>
                <input
                  type="radio"
                  checked={audType === 'list'}
                  onChange={() => {
                    setAudType('list');
                    setPreview(null);
                  }}
                />
                Lista de contatos
              </label>
            </div>
          </div>

          {audType === 'leads' ? (
            <>
              <div className="em-field">
                <span>Estágios (vazio = todos)</span>
                <div className="em-chips">
                  {LEAD_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`em-chip${statuses.includes(s) ? ' active' : ''}`}
                      onClick={() => {
                        setStatuses(toggle(statuses, s));
                        setPreview(null);
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              {tags.length > 0 && (
                <div className="em-field">
                  <span>Etiquetas (vazio = qualquer)</span>
                  <div className="em-chips">
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`em-chip${tagIds.includes(t.id) ? ' active' : ''}`}
                        onClick={() => {
                          setTagIds(toggle(tagIds, t.id));
                          setPreview(null);
                        }}
                      >
                        <span className="em-chip-dot" style={{ background: t.color }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="em-hint">
                Apenas leads com e-mail cadastrado entram no envio.
              </p>
            </>
          ) : (
            <label className="em-field">
              <span>Lista</span>
              <select
                value={listId}
                onChange={(e) => {
                  setListId(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">— escolher lista —</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.count})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="em-preview-row">
            <button className="btn btn-ghost btn-sm" type="button" onClick={doPreview}>
              Prever destinatários
            </button>
            {preview !== null && (
              <span className="em-preview-count">{preview} destinatário(s)</span>
            )}
          </div>
        </div>

        <div className="em-modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onSaveDraft} disabled={busy}>
            Salvar rascunho
          </button>
          {isAdmin && (
            <button className="btn btn-primary" type="button" onClick={onSend} disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar agora'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({
  id,
  isAdmin,
  flash,
  onBack,
}: {
  id: string;
  isAdmin: boolean;
  flash: Flash;
  onBack: () => void;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recipients, setRecipients] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ campaign: Campaign; stats: Stats; recipients: number }>(
        `/api/email/campaigns/${id}`
      );
      setCampaign(data.campaign);
      setStats(data.stats);
      setRecipients(data.recipients);
    } catch (e) {
      flash('err', `Falha ao carregar campanha: ${(e as Error).message}`);
    }
  }, [id, flash]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSend() {
    setBusy(true);
    try {
      const r = await apiCall<{ sent: number; recipients: number }>(
        `/api/email/campaigns/${id}/send`,
        { method: 'POST' }
      );
      flash('ok', `Enviada: ${r.sent}/${r.recipients} destinatários.`);
      await load();
    } catch (e) {
      flash('err', `Falha ao enviar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm('Excluir esta campanha?')) return;
    try {
      await apiCall(`/api/email/campaigns/${id}`, { method: 'DELETE' });
      flash('ok', 'Campanha excluída.');
      onBack();
    } catch (e) {
      flash('err', `Falha ao excluir: ${(e as Error).message}`);
    }
  }

  if (!campaign) return <p className="em-empty">Carregando…</p>;

  const canSend = isAdmin && (campaign.status === 'rascunho' || campaign.status === 'erro');

  return (
    <div className="em-section">
      <div className="em-section-head">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          ← Voltar
        </button>
        <div className="em-detail-actions">
          {canSend && (
            <button className="btn btn-primary" type="button" onClick={onSend} disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar agora'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" type="button" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>

      <div className="em-detail-head">
        <h2 className="em-section-title">{campaign.name}</h2>
        <span className={`em-pill ${STATUS_PILL[campaign.status].cls}`}>
          {STATUS_PILL[campaign.status].label}
        </span>
      </div>
      <p className="em-detail-subject">{campaign.subject || 'sem assunto'}</p>

      <div className="em-stats">
        <StatCard label="Destinatários" value={recipients} />
        <StatCard label="Enviados" value={stats?.sent ?? 0} />
        <StatCard label="Aberturas" value={stats?.open ?? 0} />
        <StatCard label="Cliques" value={stats?.click ?? 0} />
        <StatCard label="Bounces" value={stats?.bounce ?? 0} />
        <StatCard label="Descadastros" value={stats?.unsubscribe ?? 0} />
      </div>

      <div className="em-detail-meta">
        <div>
          <span className="em-meta-k">Público</span>
          <span className="em-meta-v">
            {campaign.audience?.type === 'list' ? 'Lista de contatos' : 'Leads do CRM'}
          </span>
        </div>
        <div>
          <span className="em-meta-k">Criada</span>
          <span className="em-meta-v">{fmtDate(campaign.created_at)}</span>
        </div>
        {campaign.sent_at && (
          <div>
            <span className="em-meta-k">Enviada</span>
            <span className="em-meta-v">{fmtDate(campaign.sent_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="em-stat">
      <span className="em-stat-value">{value}</span>
      <span className="em-stat-label">{label}</span>
    </div>
  );
}

/* ============================================================
   Listas & contatos
   ============================================================ */
function ListsTab({ flash }: { flash: Flash }) {
  const [lists, setLists] = useState<EmailList[]>([]);
  const [newName, setNewName] = useState('');
  const [selected, setSelected] = useState<EmailList | null>(null);

  const load = useCallback(async () => {
    try {
      const { lists } = await apiCall<{ lists: EmailList[] }>('/api/email/lists');
      setLists(lists);
    } catch (e) {
      flash('err', `Falha ao carregar listas: ${(e as Error).message}`);
    }
  }, [flash]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!newName.trim()) return;
    try {
      await apiCall('/api/email/lists', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      flash('ok', 'Lista criada.');
      await load();
    } catch (e) {
      flash('err', `Falha ao criar lista: ${(e as Error).message}`);
    }
  }

  if (selected) {
    return (
      <ContactsPanel
        list={selected}
        flash={flash}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="em-section">
      <div className="em-section-head">
        <h2 className="em-section-title">Listas de contatos</h2>
        <div className="em-inline-form">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da lista"
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button className="btn btn-primary btn-sm" type="button" onClick={create}>
            Criar
          </button>
        </div>
      </div>

      {lists.length === 0 ? (
        <p className="em-empty">Nenhuma lista. Crie uma e importe contatos via CSV.</p>
      ) : (
        <div className="em-list">
          {lists.map((l) => (
            <button key={l.id} className="em-row" type="button" onClick={() => setSelected(l)}>
              <div className="em-row-main">
                <span className="em-row-name">{l.name}</span>
                <span className="em-row-sub">{l.count} contato(s)</span>
              </div>
              <span className="em-row-date">{fmtDate(l.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactsPanel({
  list,
  flash,
  onBack,
}: {
  list: EmailList;
  flash: Flash;
  onBack: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [csv, setCsv] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { contacts } = await apiCall<{ contacts: Contact[] }>(
        `/api/email/lists/${list.id}/contacts`
      );
      setContacts(contacts);
    } catch (e) {
      flash('err', `Falha ao carregar contatos: ${(e as Error).message}`);
    }
  }, [list.id, flash]);

  useEffect(() => {
    void load();
  }, [load]);

  async function importCsv() {
    if (!csv.trim()) return;
    try {
      const r = await apiCall<{ added: number; received: number }>(
        `/api/email/lists/${list.id}/contacts`,
        { method: 'POST', body: JSON.stringify({ csv }) }
      );
      setCsv('');
      flash('ok', `${r.added} contato(s) adicionado(s) (de ${r.received}).`);
      await load();
    } catch (e) {
      flash('err', `Falha ao importar: ${(e as Error).message}`);
    }
  }

  async function addOne() {
    if (!email.trim()) return;
    try {
      const r = await apiCall<{ added: number }>(`/api/email/lists/${list.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contacts: [{ email: email.trim(), name: name.trim() || undefined }] }),
      });
      setEmail('');
      setName('');
      if (r.added === 0) flash('err', 'E-mail inválido ou já existente.');
      else flash('ok', 'Contato adicionado.');
      await load();
    } catch (e) {
      flash('err', `Falha ao adicionar: ${(e as Error).message}`);
    }
  }

  async function removeContact(id: string) {
    try {
      await apiCall(`/api/email/contacts/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      flash('err', `Falha ao remover: ${(e as Error).message}`);
    }
  }

  async function deleteList() {
    if (!confirm(`Excluir a lista "${list.name}" e todos os contatos?`)) return;
    try {
      await apiCall(`/api/email/lists/${list.id}`, { method: 'DELETE' });
      flash('ok', 'Lista excluída.');
      onBack();
    } catch (e) {
      flash('err', `Falha ao excluir lista: ${(e as Error).message}`);
    }
  }

  return (
    <div className="em-section">
      <div className="em-section-head">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          ← Voltar
        </button>
        <div className="em-section-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setImporting(true)}>
            Importar contatos
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={deleteList}>
            Excluir lista
          </button>
        </div>
      </div>

      <h2 className="em-section-title">{list.name}</h2>

      <div className="em-card">
        <h3 className="em-card-title">Adicionar contato</h3>
        <div className="em-inline-form">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" />
          <button className="btn btn-primary btn-sm" type="button" onClick={addOne}>
            Adicionar
          </button>
        </div>
      </div>

      <div className="em-card">
        <h3 className="em-card-title">Importar CSV</h3>
        <p className="em-hint">
          Cole linhas. Com cabeçalho (email, name) em qualquer ordem, ou “email,nome” por linha.
        </p>
        <textarea
          rows={4}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'email,nome\nana@x.com,Ana\njoao@y.com,João'}
        />
        <button className="btn btn-primary btn-sm" type="button" onClick={importCsv}>
          Importar
        </button>
      </div>

      <h3 className="em-card-title">Contatos ({contacts.length})</h3>
      {contacts.length === 0 ? (
        <p className="em-empty">Sem contatos ainda.</p>
      ) : (
        <div className="em-contacts">
          {contacts.map((c) => (
            <div key={c.id} className="em-contact">
              <div>
                <span className="em-row-name">{c.email}</span>
                {c.name && <span className="em-row-sub"> · {c.name}</span>}
                {c.unsubscribed && <span className="em-unsub">descadastrado</span>}
              </div>
              <button
                className="em-contact-del"
                type="button"
                onClick={() => removeContact(c.id)}
                aria-label="Remover contato"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {importing && (
        <ImportContactsModal
          listId={list.id}
          flash={flash}
          onClose={() => setImporting(false)}
          onImported={() => void load()}
        />
      )}
    </div>
  );
}

/* ============================================================
   Modal — Importar contatos numa lista (Feature 1)
   POST /api/email/lists/{id}/import  { text } → { added, invalid, duplicates, total }
   ============================================================ */
function ImportContactsModal({
  listId,
  flash,
  onClose,
  onImported,
}: {
  listId: string;
  flash: Flash;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<{
    added: number;
    invalid: number;
    duplicates: number;
    total: number;
  } | null>(null);

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lê arquivo .csv via FileReader e popula o textarea
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) ?? '');
    reader.readAsText(file);
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
  }

  async function importar() {
    if (!text.trim()) return;
    setBusy(true);
    setResultado(null);
    try {
      const r = await apiCall<{ added: number; invalid: number; duplicates: number; total: number }>(
        `/api/email/lists/${listId}/import`,
        { method: 'POST', body: JSON.stringify({ text }) }
      );
      setResultado(r);
      onImported();
    } catch (e) {
      flash('err', `Falha ao importar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="em-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Importar contatos"
      onClick={onClose}
    >
      <div className="em-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="em-modal-head">
          <h3>Importar contatos</h3>
          <button className="em-modal-close" type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="em-modal-body">
          <p className="em-hint">
            Cole os e-mails, um por linha, ou CSV: <code>email,nome</code>. Também é possível abrir um arquivo .csv.
          </p>

          <label className="em-field">
            <span>Conteúdo</span>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'email,nome\nana@x.com,Ana\njoao@y.com,João\ncontato@empresa.com'}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </label>

          <label className="em-field">
            <span>Ou abrir arquivo .csv</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={onFile}
              className="em-import-file"
            />
          </label>

          {resultado && (
            <div className="em-import-result" role="status" aria-live="polite">
              <span className="em-import-result-added">{resultado.added} adicionado(s)</span>
              {resultado.invalid > 0 && (
                <span className="em-import-result-warn">{resultado.invalid} inválido(s)</span>
              )}
              {resultado.duplicates > 0 && (
                <span className="em-import-result-warn">{resultado.duplicates} duplicado(s)</span>
              )}
              <span className="em-import-result-total">de {resultado.total} linha(s)</span>
            </div>
          )}
        </div>

        <div className="em-modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={importar}
            disabled={busy || !text.trim()}
          >
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Modal — Gerar pílula semanal com IA (Feature 2)
   POST /api/email/generate  { theme?, audience? } → { campaign }
   ============================================================ */
function GeneratePillModal({
  flash,
  onClose,
  onGenerated,
}: {
  flash: Flash;
  onClose: () => void;
  onGenerated: (campaign: Campaign) => void;
}) {
  const [theme, setTheme] = useState('');
  const [listId, setListId] = useState('');
  const [lists, setLists] = useState<EmailList[]>([]);
  const [busy, setBusy] = useState(false);

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // Carrega listas para seleção opcional de público
  useEffect(() => {
    void (async () => {
      try {
        const { lists: l } = await apiCall<{ lists: EmailList[] }>('/api/email/lists');
        setLists(l);
      } catch {
        // silencioso — seletor de público fica vazio
      }
    })();
  }, []);

  async function gerar() {
    setBusy(true);
    try {
      const body: { theme?: string; audience?: Audience } = {};
      if (theme) body.theme = theme;
      if (listId) body.audience = { type: 'list', list_id: listId };

      const { campaign } = await apiCall<{ campaign: Campaign }>('/api/email/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      flash('ok', `Rascunho "${campaign.name}" gerado. Revise antes de enviar.`);
      onGenerated(campaign);
    } catch (e) {
      flash('err', `Falha ao gerar pílula: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div
      className="em-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Gerar pílula da semana com IA"
      onClick={() => !busy && onClose()}
    >
      <div className="em-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="em-modal-head">
          <h3>Gerar pílula da semana com IA</h3>
          <button
            className="em-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            disabled={busy}
          >
            ×
          </button>
        </div>

        <div className="em-modal-body">
          <p className="em-hint">
            A IA cria uma campanha completa com o tema escolhido e salva como{' '}
            <strong>rascunho</strong>. Nada é enviado automaticamente — você revisa antes.
          </p>

          <label className="em-field">
            <span>Tema</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {TEMAS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {lists.length > 0 && (
            <label className="em-field">
              <span>Público (opcional — pode definir depois)</span>
              <select value={listId} onChange={(e) => setListId(e.target.value)}>
                <option value="">— sem lista definida —</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.count})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="em-generate-draft-note">
            <span className={`em-pill ${STATUS_PILL.rascunho.cls}`}>Rascunho</span>
            <span>A campanha gerada ficará em rascunho para sua revisão.</span>
          </div>
        </div>

        <div className="em-modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="button" onClick={gerar} disabled={busy}>
            {busy ? 'Gerando com IA…' : 'Gerar pílula'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Templates
   ============================================================ */
function TemplatesTab({ flash }: { flash: Flash }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const { templates } = await apiCall<{ templates: Template[] }>('/api/email/templates');
      setTemplates(templates);
    } catch (e) {
      flash('err', `Falha ao carregar templates: ${(e as Error).message}`);
    }
  }, [flash]);

  useEffect(() => {
    void load();
  }, [load]);

  if (editing) {
    return (
      <TemplateEditor
        template={editing === 'new' ? null : editing}
        flash={flash}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="em-section">
      <div className="em-section-head">
        <h2 className="em-section-title">Templates</h2>
        <button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>
          + Novo template
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="em-empty">Nenhum template. Crie um HTML reutilizável.</p>
      ) : (
        <div className="em-list">
          {templates.map((t) => (
            <button key={t.id} className="em-row" type="button" onClick={() => setEditing(t)}>
              <div className="em-row-main">
                <span className="em-row-name">{t.name}</span>
                <span className="em-row-sub">{t.subject || 'sem assunto'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  flash,
  onClose,
  onSaved,
}: {
  template: Template | null;
  flash: Flash;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [html, setHtml] = useState(template?.html ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return flash('err', 'Dê um nome ao template.');
    setBusy(true);
    try {
      if (template) {
        await apiCall(`/api/email/templates/${template.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: name.trim(), subject, html }),
        });
      } else {
        await apiCall('/api/email/templates', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), subject, html }),
        });
      }
      flash('ok', 'Template salvo.');
      onSaved();
    } catch (e) {
      flash('err', `Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!template) return;
    if (!confirm('Excluir este template?')) return;
    try {
      await apiCall(`/api/email/templates/${template.id}`, { method: 'DELETE' });
      flash('ok', 'Template excluído.');
      onSaved();
    } catch (e) {
      flash('err', `Falha ao excluir: ${(e as Error).message}`);
    }
  }

  return (
    <div className="em-section">
      <div className="em-section-head">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
          ← Voltar
        </button>
        {template && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={remove}>
            Excluir
          </button>
        )}
      </div>

      <h2 className="em-section-title">{template ? 'Editar template' : 'Novo template'}</h2>

      <label className="em-field">
        <span>Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas" />
      </label>
      <label className="em-field">
        <span>Assunto</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="em-field">
        <span>HTML</span>
        <textarea rows={12} value={html} onChange={(e) => setHtml(e.target.value)} />
      </label>

      <div className="em-field">
        <span>Pré-visualização</span>
        <iframe className="em-preview-frame" srcDoc={html} title="Pré-visualização do template" />
      </div>

      <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar template'}
      </button>
    </div>
  );
}

/* ============================================================
   Provedor (ESP)
   ============================================================ */
function ProviderTab({ isAdmin, flash }: { isAdmin: boolean; flash: Flash }) {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [provider, setProvider] = useState('gmail');
  const [apiKey, setApiKey] = useState('');
  const [from, setFrom] = useState('');
  const [user, setUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiCall<ConfigStatus>('/api/email/config');
      setStatus(s);
      setProvider(s.provider || 'gmail');
      setFrom(s.from || '');
      setUser(s.user || '');
    } catch (e) {
      flash('err', `Falha ao carregar provedor: ${(e as Error).message}`);
    }
  }, [flash]);

  useEffect(() => {
    void load();
  }, [load]);

  // Gmail SMTP usa conta + senha de app; 'dev' só loga; os demais são ESP (API key).
  const isGmail = provider === 'gmail' || provider === 'smtp';
  const isDev = provider === 'dev';

  async function save() {
    setBusy(true);
    try {
      const s = await apiCall<ConfigStatus>('/api/email/config', {
        method: 'PUT',
        body: JSON.stringify({
          provider,
          from: from || undefined,
          // Campos vazios não sobrescrevem o que já está salvo (o backend filtra vazio).
          user: isGmail ? user || undefined : undefined,
          appPassword: isGmail ? appPassword || undefined : undefined,
          apiKey: !isGmail && !isDev ? apiKey || undefined : undefined,
        }),
      });
      setStatus(s);
      setApiKey('');
      setAppPassword('');
      flash('ok', 'Provedor salvo.');
    } catch (e) {
      flash('err', `Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const r = await apiCall<{ to: string; provider: string }>('/api/email/test', {
        method: 'POST',
      });
      flash('ok', `Email de teste enviado para ${r.to} (via ${r.provider}). Confira a caixa de entrada.`);
    } catch (e) {
      flash('err', `Falha ao enviar teste: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  // Status amigável: nome legível do provedor, sem jargão técnico na tela principal.
  const connected = Boolean(status?.configured);
  const friendlyName = isGmail ? 'Gmail' : isDev ? 'modo de teste' : status?.provider || '';

  return (
    <div className="em-section">
      <h2 className="em-section-title">Envio de email</h2>

      {status && (
        <div className="em-card em-prov-hero">
          <div className="em-prov-hero-icon" aria-hidden>
            📧
          </div>
          <div className="em-prov-hero-main">
            <span className="em-prov-hero-status">
              {connected ? `✅ Conectado (${friendlyName})` : '⚠️ Envio ainda não configurado'}
            </span>
            {connected && status.from && (
              <span className="em-prov-hero-from">Enviando de: {status.from}</span>
            )}
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={sendTest}
            disabled={testing || !connected}
            title={connected ? 'Envia um email de teste para você' : 'Configure o envio primeiro'}
          >
            {testing ? 'Enviando…' : 'Enviar email de teste'}
          </button>
        </div>
      )}

      {isAdmin && (
        <details className="em-advanced">
          <summary className="em-advanced-summary">⚙️ Configurações avançadas</summary>
          <div className="em-card">
            <label className="em-field">
              <span>Provedor</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="gmail">Gmail (SMTP) — recomendado</option>
                <option value="dev">dev (só loga)</option>
                <option value="resend">resend</option>
                <option value="sendgrid">sendgrid</option>
                <option value="brevo">brevo</option>
                <option value="ses">ses</option>
              </select>
            </label>

            {isGmail ? (
              <>
                <label className="em-field">
                  <span>E-mail da conta</span>
                  <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="voce@gmail.com"
                  />
                </label>
                <label className="em-field">
                  <span>
                    Senha de app (16 caracteres)
                    {status?.hasAppPassword ? ' — deixe vazio para manter' : ''}
                  </span>
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                  />
                </label>
                <p className="em-hint">
                  Gere em myaccount.google.com/apppasswords (não é a senha normal da conta).
                </p>
                <label className="em-field">
                  <span>Remetente (From)</span>
                  <input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="Cranium <voce@gmail.com>"
                  />
                </label>
              </>
            ) : isDev ? (
              <label className="em-field">
                <span>Remetente (From)</span>
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="Cranium <no-reply@dominio.com>"
                />
              </label>
            ) : (
              <>
                <label className="em-field">
                  <span>API key {status?.hasApiKey ? '(deixe vazio para manter)' : ''}</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="credencial do ESP"
                  />
                </label>
                <label className="em-field">
                  <span>Remetente (From)</span>
                  <input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="Cranium <no-reply@dominio.com>"
                  />
                </label>
              </>
            )}

            <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar configurações'}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
