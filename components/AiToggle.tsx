'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Interruptor liga/desliga do agente de IA.
 *
 * Ao montar faz GET /api/agente/status para ler o estado atual.
 * O clique (ou Enter/Espaço) faz POST /api/agente/status com atualização
 * otimista: se a API falhar o estado é revertido e um aviso curto é exibido.
 */
export default function AiToggle() {
  // null = estado ainda não carregado da API
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca o estado inicial ao montar o componente
  useEffect(() => {
    fetch('/api/agente/status')
      .then(r => r.json())
      .then(data => setEnabled(Boolean(data.enabled)))
      .catch(() => setEnabled(true)); // fallback: assume ativo
  }, []);

  const alternar = useCallback(async () => {
    if (enabled === null || pendente) return;

    const estadoAnterior = enabled;
    const novoEstado = !enabled;

    // Atualização otimista — reflete na UI antes da resposta da API
    setEnabled(novoEstado);
    setErro(null);
    setPendente(true);

    try {
      const res = await fetch('/api/agente/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: novoEstado }),
      });
      if (!res.ok) throw new Error('resposta não-ok');
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
    } catch {
      setEnabled(estadoAnterior); // reverte para o estado anterior
      setErro('Não foi possível alterar. Tente novamente.');
    } finally {
      setPendente(false);
    }
  }, [enabled, pendente]);

  // Garante que Enter e Espaço acionam o toggle (comportamento padrão de <button>,
  // mas explicitado aqui para deixar a intenção clara para role="switch")
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        alternar();
      }
    },
    [alternar],
  );

  const carregando = enabled === null;
  const ativo = enabled === true;

  return (
    <div className="ai-status-bar-wrap">
      <button
        className={`ai-status-bar${!ativo && !carregando ? ' ai-status-bar--off' : ''}`}
        role="switch"
        aria-checked={ativo}
        aria-label="Ligar/desligar atendimento automático da IA"
        title={
          ativo
            ? 'IA respondendo leads automaticamente. Clique para pausar.'
            : 'IA pausada — humano assume o atendimento. Clique para reativar.'
        }
        onClick={alternar}
        onKeyDown={handleKeyDown}
        disabled={carregando}
        aria-busy={pendente}
      >
        <span
          className={`ai-status-dot${!ativo && !carregando ? ' ai-status-dot--off' : ''}`}
          aria-hidden="true"
        />
        <span
          className={`ai-status-text${!ativo && !carregando ? ' ai-status-text--off' : ''}`}
        >
          {carregando ? 'IA…' : ativo ? 'IA ativa · respondendo' : 'IA pausada'}
        </span>
        {/* Pílula estilo iOS — indica visualmente ligado/desligado */}
        <span
          className={`ai-toggle-pill${!ativo && !carregando ? ' ai-toggle-pill--off' : ''}`}
          aria-hidden="true"
        >
          <span className="ai-toggle-thumb" />
        </span>
      </button>
      {erro && (
        <p className="ai-toggle-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
