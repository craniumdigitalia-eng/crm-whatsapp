'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================
   Materiais / provas do agente — imagens que a IA envia ao lead
   (prints de campanha, resultados, "como o lead chega"). Upload
   para o bucket público 'agent-assets'. Só admin edita.
   ============================================================ */

interface Category { value: string; label: string; hint: string }
interface Asset {
  id: string;
  category: string;
  label: string;
  caption: string | null;
  url: string;
  active: boolean;
}

export default function AgentAssets({ isAdmin }: { isAdmin: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState('campanha');
  const [label, setLabel] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agente/assets', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error('falha ao carregar');
      const data = await res.json() as { assets: Asset[]; categories: Category[] };
      setAssets(data.assets ?? []);
      setCategories(data.categories ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upload = async () => {
    if (!file || !label.trim() || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      fd.append('label', label.trim());
      fd.append('caption', caption.trim());
      const res = await fetch('/api/agente/assets', { method: 'POST', body: fd });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'falha no upload');
      setLabel(''); setCaption(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      alert('Erro ao subir: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const toggle = async (a: Asset) => {
    try {
      await fetch(`/api/agente/assets/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !a.active }),
      });
      setAssets((p) => p.map((x) => x.id === a.id ? { ...x, active: !x.active } : x));
    } catch { void load(); }
  };
  const remove = async (a: Asset) => {
    if (!confirm(`Remover o material "${a.label}"?`)) return;
    setAssets((p) => p.filter((x) => x.id !== a.id));
    try { await fetch(`/api/agente/assets/${a.id}`, { method: 'DELETE' }); } catch { void load(); }
  };

  const catLabel = (v: string) => categories.find((c) => c.value === v)?.label ?? v;

  return (
    <div className="agent-card agent-assets" style={{ marginTop: 18 }}>
      <h3 className="agent-card-title">Materiais / provas que a IA envia</h3>
      <p className="agent-card-hint">
        Suba prints de campanha, resultados de clientes e exemplos de como o lead chega. A IA envia a
        imagem certa no momento certo (quando o lead pede prova, está em dúvida, ou pra mostrar valor).
      </p>

      {isAdmin && (
        <div className="asset-upload">
          <select className="asset-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input className="asset-input asset-grow" placeholder="Nome (ex.: Campanha plano PME)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="asset-input asset-grow" placeholder="Legenda que vai junto (opcional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <input ref={fileRef} className="asset-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn btn-primary btn-sm" type="button" onClick={upload} disabled={uploading || !file || !label.trim()}>
            {uploading ? 'Subindo…' : 'Adicionar'}
          </button>
        </div>
      )}

      {loading && <p className="agent-card-hint">Carregando materiais…</p>}
      {error && <p className="agent-card-hint">Erro: {error}</p>}
      {!loading && assets.length === 0 && <p className="agent-card-hint">Nenhum material ainda. Suba o primeiro acima.</p>}

      {assets.length > 0 && (
        <div className="asset-grid">
          {assets.map((a) => (
            <div className={`asset-item${a.active ? '' : ' is-off'}`} key={a.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="asset-thumb" src={a.url} alt={a.label} />
              <div className="asset-meta">
                <span className="asset-cat">{catLabel(a.category)}</span>
                <span className="asset-label">{a.label}</span>
                {a.caption && <span className="asset-caption">{a.caption}</span>}
              </div>
              {isAdmin && (
                <div className="asset-actions">
                  <button type="button" className="asset-btn" onClick={() => toggle(a)} title={a.active ? 'Desativar' : 'Ativar'}>
                    {a.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button type="button" className="asset-del" onClick={() => remove(a)} aria-label="Remover">×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
