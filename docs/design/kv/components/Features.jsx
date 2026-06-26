// 4 Features interativas: Chat IA, Modal Agendamento, Calc ROI, Slider Comparativo
// (Multi-step Form já existe em Forms.jsx — Form_MultiStep)

/* ============================================================
   CHAT IA — widget interativo com 4 turnos roteirizados
   ============================================================ */
function ChatIA() {
  const script = [
    { side: 'left', text: 'Oi! Sou a IA da Cranium. Que tipo de plano você procura — pessoa física, PME ou adesão por entidade?', delay: 600 },
    { user: ['Pessoa física', 'PME', 'Adesão'] },
    { side: 'left', text: (a) => `Beleza, ${a.toLowerCase()}. Quantas vidas precisa cotar?`, delay: 900 },
    { user: ['1-2', '3-10', '10+'] },
    { side: 'left', text: 'Perfeito. Última: alguma operadora preferida — Unimed, Amil, SulAm, Bradesco?', delay: 900 },
    { user: ['Unimed', 'Amil', 'SulAmérica', 'Sem preferência'] },
    { side: 'left', text: '✓ Lead qualificado. Vou encaminhar pro Bruno — ele te responde em até 15min com proposta. Qual seu WhatsApp?', delay: 1200, final: true },
  ];

  const [step, setStep] = React.useState(0);
  const [messages, setMessages] = React.useState([{ side: 'left', text: script[0].text }]);
  const [typing, setTyping] = React.useState(false);
  const [answers, setAnswers] = React.useState([]);
  const scrollRef = React.useRef();

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const pickAnswer = (a) => {
    const newMsgs = [...messages, { side: 'right', text: a }];
    const newAnswers = [...answers, a];
    setMessages(newMsgs);
    setAnswers(newAnswers);

    const nextIaStepIdx = step + 2;
    if (nextIaStepIdx >= script.length) return;

    const nextIa = script[nextIaStepIdx];
    if (!nextIa || nextIa.user) return;

    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const text = typeof nextIa.text === 'function' ? nextIa.text(a) : nextIa.text;
      setMessages(m => [...m, { side: 'left', text, final: nextIa.final }]);
      setStep(nextIaStepIdx);
    }, nextIa.delay || 900);
  };

  const currentChoices = (() => {
    const userStep = script[step + 1];
    return userStep?.user || null;
  })();

  const reset = () => {
    setStep(0); setMessages([{ side: 'left', text: script[0].text }]); setAnswers([]);
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.brandDark,
      border: `1px solid ${T.borderDark}`, borderRadius: 24,
      display: 'flex', flexDirection: 'column',
      fontFamily: T.fontBody, overflow: 'hidden',
      boxShadow: '0 32px 64px -16px rgba(124,58,237,0.5)',
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
        borderBottom: `1px solid ${T.borderDark}`,
        background: 'rgba(15,2,32,0.4)',
      }}>
        <div style={{ position: 'relative' }}>
          <Logo size={32} color={T.brandLight}/>
          <span className="cd-pulse" style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 10, height: 10, borderRadius: 999,
            background: T.success, boxShadow: `0 0 0 2px ${T.brandDark}`,
          }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.brandTint, fontSize: 14, fontWeight: 600 }}>Cranium IA</div>
          <div style={{ color: T.success, fontSize: 11, fontFamily: T.fontMono }}>online · 24h</div>
        </div>
        <button onClick={reset} title="Reiniciar" style={{
          background: 'transparent', border: `1px solid ${T.borderDark}`,
          color: T.brandLight, borderRadius: 999, padding: '6px 12px',
          fontSize: 11, cursor: 'pointer', fontFamily: T.fontMono, letterSpacing: '0.04em',
        }}>reiniciar</button>
      </div>

      {/* MESSAGES */}
      <div ref={scrollRef} className="cd-scroll" style={{
        flex: 1, overflowY: 'auto', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: m.side === 'left' ? 'flex-start' : 'flex-end',
            animation: 'cd-msg-in 220ms cubic-bezier(0.22,1,0.36,1)',
          }}>
            <div style={{ maxWidth: '85%' }}>
              <div style={{
                background: m.side === 'left' ? 'rgba(167,139,250,0.10)' : T.brandPurple,
                border: m.side === 'left' ? `1px solid ${T.borderDark}` : 'none',
                color: m.side === 'left' ? T.brandTint : '#fff',
                padding: '12px 16px',
                borderRadius: m.side === 'left' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                fontSize: 14, lineHeight: 1.55,
              }}>{m.text}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '12px 16px', borderRadius: '14px 14px 14px 4px',
              background: 'rgba(167,139,250,0.10)', border: `1px solid ${T.borderDark}`,
            }}>
              {[0,1,2].map(i => <span key={i} className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.brandLight, animationDelay: `${i*0.18}s` }}/>)}
            </div>
          </div>
        )}
      </div>

      {/* CHOICES / INPUT */}
      <div style={{ padding: 16, borderTop: `1px solid ${T.borderDark}`, background: 'rgba(15,2,32,0.4)' }}>
        {currentChoices ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {currentChoices.map(c => (
              <button key={c} onClick={() => pickAnswer(c)} style={{
                background: 'rgba(167,139,250,0.08)', border: `1px solid ${T.borderDark}`,
                color: T.brandTint, padding: '10px 16px', borderRadius: 999,
                fontFamily: T.fontBody, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all 180ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.brandPurple; e.currentTarget.style.borderColor = T.brandPurple; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; e.currentTarget.style.borderColor = T.borderDark; }}>
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="(11) 99999-9999" style={{
              flex: 1, padding: '12px 16px',
              background: 'rgba(167,139,250,0.06)', border: `1px solid ${T.borderDark}`,
              borderRadius: 999, fontFamily: T.fontBody, fontSize: 14,
              color: T.brandTint, outline: 'none',
            }}/>
            <button style={{
              background: T.brandPurple, color: '#fff', border: 'none',
              width: 44, height: 44, borderRadius: 999, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icons.Send size={16}/>
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes cd-msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

/* ============================================================
   MODAL AGENDAMENTO — 3 passos (Cal.com style)
   ============================================================ */
function AgendaModal() {
  const [step, setStep] = React.useState(0);
  const [date, setDate] = React.useState(null);
  const [time, setTime] = React.useState(null);
  const [form, setForm] = React.useState({ nome: '', email: '', telefone: '' });

  // Mock calendar — current month
  const today = new Date(2026, 2, 19);
  const month = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const availableDays = [20, 21, 24, 25, 26, 27, 28, 31];
  const times = ['09:00', '10:30', '11:00', '14:00', '15:30', '16:00', '17:30'];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fff', borderRadius: 24,
      border: `1px solid ${T.neutralMid}`,
      fontFamily: T.fontBody, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 32px 64px -16px rgba(124,58,237,0.25)',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px',
        borderBottom: `1px solid ${T.neutralMid}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: T.brandTint,
            color: T.brandPurple, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><Icons.Calendar size={20}/></div>
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 18, color: T.deepViolet, letterSpacing: '-0.01em' }}>Conversa de 15 minutos</div>
            <div style={{ fontSize: 12, color: T.fgMuted, fontFamily: T.fontMono }}>com Bruno de Castro · SUSEP ativa</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 24, height: 4, borderRadius: 2,
              background: i <= step ? T.brandPurple : T.neutralMid,
              transition: 'background 220ms',
            }}/>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }} className="cd-scroll">
        {step === 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 22, color: T.deepViolet, margin: 0, letterSpacing: '-0.015em', textTransform: 'capitalize' }}>{month}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={iconBtn}><Icons.ChevronRight size={16} style={{ transform: 'rotate(180deg)' }}/></button>
                <button style={iconBtn}><Icons.ChevronRight size={16}/></button>
              </div>
            </div>
            {/* days header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
              {['dom','seg','ter','qua','qui','sex','sáb'].map(d => (
                <div key={d} style={{ fontSize: 11, color: T.fgMuted, letterSpacing: '0.04em', textAlign: 'center', textTransform: 'uppercase', fontWeight: 500 }}>{d}</div>
              ))}
            </div>
            {/* days grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={`pad${i}`}/>)}
              {days.map(d => {
                const avail = availableDays.includes(d);
                const isToday = d === today.getDate();
                const selected = date === d;
                return (
                  <button key={d} disabled={!avail}
                    onClick={() => setDate(d)}
                    style={{
                      aspectRatio: '1', borderRadius: 12,
                      background: selected ? T.brandPurple : (avail ? '#fff' : 'transparent'),
                      color: selected ? '#fff' : (avail ? T.deepViolet : '#CBD5E1'),
                      border: `1px solid ${selected ? T.brandPurple : (avail ? T.neutralMid : 'transparent')}`,
                      fontFamily: T.fontBody, fontWeight: avail ? 500 : 400, fontSize: 14,
                      cursor: avail ? 'pointer' : 'default',
                      position: 'relative', transition: 'all 180ms',
                    }}>
                    {d}
                    {isToday && !selected && <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 999, background: T.brandPurple }}/>}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: T.fgMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: T.brandPurple }}/>
              Slots disponíveis · fuso BRT (GMT-3)
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 22, color: T.deepViolet, margin: '0 0 4px', letterSpacing: '-0.015em' }}>{date} de março, 2026</h3>
            <p style={{ fontSize: 13, color: T.fgMuted, margin: '0 0 20px' }}>Escolha um horário disponível.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {times.map(t => (
                <button key={t} onClick={() => setTime(t)} style={{
                  padding: '14px 12px', borderRadius: 12,
                  background: time === t ? T.brandPurple : '#fff',
                  border: `1px solid ${time === t ? T.brandPurple : T.neutralMid}`,
                  color: time === t ? '#fff' : T.deepViolet,
                  fontFamily: T.fontMono, fontWeight: 500, fontSize: 14,
                  cursor: 'pointer', transition: 'all 180ms',
                }}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 22, color: T.deepViolet, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Quase lá.</h3>
            <p style={{ fontSize: 13, color: T.fgMuted, margin: '0 0 20px' }}>Confirmação vai por e-mail + WhatsApp.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TextInput value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} icon={<Icons.User size={16}/>} placeholder="Seu nome"/>
              <TextInput type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} icon={<Icons.Mail size={16}/>} placeholder="seu@email.com.br"/>
              <TextInput value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} icon={<Icons.Phone size={16}/>} placeholder="(11) 99999-9999"/>
            </div>
            {/* Selected summary */}
            <div style={{
              marginTop: 20, padding: 16, borderRadius: 14,
              background: T.brandTint, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Icons.Calendar size={20} style={{ color: T.brandPurple }}/>
              <div style={{ flex: 1 }}>
                <div className="cd-tnum" style={{ fontWeight: 600, color: T.deepViolet, fontSize: 14 }}>
                  {date} mar · {time}
                </div>
                <div style={{ fontSize: 12, color: T.fgMuted }}>15min · Google Meet</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 28px', borderTop: `1px solid ${T.neutralMid}`,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <Btn variant="text" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))} icon={<Icons.ArrowLeft size={16}/>}>Voltar</Btn>
        {step < 2 ? (
          <Btn variant="primary" size="md" disabled={step === 0 ? !date : !time} onClick={() => setStep(step + 1)} iconRight={<Icons.ArrowRight size={16}/>}>
            Continuar
          </Btn>
        ) : (
          <Btn variant="primary" size="md" iconRight={<Icons.Check size={16}/>}>
            Confirmar agendamento
          </Btn>
        )}
      </div>
    </div>
  );
}
const iconBtn = {
  width: 32, height: 32, borderRadius: 8,
  background: T.surfaceLight, border: 'none',
  color: T.deepViolet, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

/* ============================================================
   CALCULADORA ROI
   ============================================================ */
function ROICalc() {
  const [leads, setLeads] = React.useState(120);
  const [ticket, setTicket] = React.useState(280);
  const [comissao, setComissao] = React.useState(15);

  // assumption: sem Cranium converte 8%, com Cranium 22% (= +175%)
  const conversaoSem = 0.08;
  const conversaoCom = 0.22;
  const vidasSem = Math.round(leads * conversaoSem);
  const vidasCom = Math.round(leads * conversaoCom);
  const receitaSem = vidasSem * ticket * (comissao / 100) * 12;
  const receitaCom = vidasCom * ticket * (comissao / 100) * 12;
  const delta = receitaCom - receitaSem;
  const fmt = (n) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fff', borderRadius: 24,
      border: `1px solid ${T.neutralMid}`,
      padding: 32, fontFamily: T.fontBody,
      display: 'flex', flexDirection: 'column', gap: 20,
      boxShadow: '0 32px 64px -16px rgba(124,58,237,0.25)',
      overflow: 'hidden',
    }}>
      <div>
        <Eyebrow>Calculadora · 60 segundos</Eyebrow>
        <h3 style={{ marginTop: 12, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, color: T.deepViolet, margin: '12px 0 8px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Quanto a Cranium devolveria pro seu bolso?</h3>
        <p style={{ fontSize: 13, color: T.fgMuted, margin: 0 }}>Estimativa baseada na média dos +180 corretores que já rodam.</p>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SliderField label="Leads recebidos por mês" value={leads} setValue={setLeads} min={20} max={500} step={10} suffix="leads"/>
        <SliderField label="Ticket médio do plano (mensal)" value={ticket} setValue={setTicket} min={120} max={1200} step={20} prefix="R$ "/>
        <SliderField label="Sua comissão" value={comissao} setValue={setComissao} min={5} max={30} step={1} suffix="%"/>
      </div>

      {/* Result */}
      <div style={{
        background: T.deepViolet, color: T.brandTint,
        borderRadius: 16, padding: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <NeuralBG opacity={0.12} lines={false}/>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: T.brandLight, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>Comissão adicional · 12 meses</div>
          <div className="cd-tnum" style={{
            fontFamily: T.fontDisplay, fontWeight: 600,
            fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1,
            color: T.brandLight, letterSpacing: '-0.03em',
          }}>+ {fmt(delta)}</div>
          <div style={{
            marginTop: 14, padding: '12px 0 0',
            borderTop: `1px solid ${T.borderDark}`,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            fontSize: 13,
          }}>
            <div>
              <div style={{ color: T.neutralSoft, marginBottom: 2 }}>Sem Cranium</div>
              <div className="cd-tnum" style={{ color: T.brandTint, fontWeight: 600, fontFamily: T.fontMono }}>{fmt(receitaSem)}/ano</div>
              <div style={{ color: T.fgMuted, fontSize: 11 }} className="cd-tnum">{vidasSem} vidas fechadas</div>
            </div>
            <div>
              <div style={{ color: T.brandLight, marginBottom: 2 }}>Com Cranium</div>
              <div className="cd-tnum" style={{ color: T.brandTint, fontWeight: 600, fontFamily: T.fontMono }}>{fmt(receitaCom)}/ano</div>
              <div style={{ color: T.fgMuted, fontSize: 11 }} className="cd-tnum">{vidasCom} vidas fechadas</div>
            </div>
          </div>
        </div>
      </div>

      <Btn variant="primary" size="md" fullWidth iconRight={<Icons.ArrowRight size={16}/>}>
        Conversar com Bruno · 15min
      </Btn>
    </div>
  );
}

function SliderField({ label, value, setValue, min, max, step, prefix = '', suffix = '' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: T.fgMuted, fontWeight: 500 }}>{label}</span>
        <span className="cd-tnum" style={{ fontFamily: T.fontMono, fontSize: 15, fontWeight: 600, color: T.brandPurple }}>
          {prefix}{value}{suffix}
        </span>
      </div>
      <div style={{ position: 'relative', height: 8 }}>
        <div style={{ position: 'absolute', inset: '50% 0 auto 0', height: 4, background: T.neutralMid, borderRadius: 999, transform: 'translateY(-50%)' }}/>
        <div style={{ position: 'absolute', inset: '50% auto auto 0', height: 4, width: `${pct}%`, background: T.brandPurple, borderRadius: 999, transform: 'translateY(-50%)' }}/>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', appearance: 'none',
            background: 'transparent', cursor: 'pointer', margin: 0,
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 22px; height: 22px; border-radius: 999px; background: #fff;
            border: 2px solid ${T.brandPurple}; cursor: pointer;
            box-shadow: 0 4px 12px rgba(124,58,237,0.30);
          }
          input[type="range"]::-moz-range-thumb {
            width: 22px; height: 22px; border-radius: 999px; background: #fff;
            border: 2px solid ${T.brandPurple}; cursor: pointer;
            box-shadow: 0 4px 12px rgba(124,58,237,0.30);
          }
        `}</style>
      </div>
    </div>
  );
}

/* ============================================================
   SLIDER COMPARATIVO — drag horizontal "com vs sem"
   ============================================================ */
function ComparativeSlider() {
  const [pos, setPos] = React.useState(50);
  const containerRef = React.useRef();
  const dragging = React.useRef(false);

  const onMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(p);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: T.fontBody, padding: 24, background: T.surfaceLight, borderRadius: 24, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <Eyebrow>Comparativo lado a lado · arraste</Eyebrow>
          <h3 style={{ marginTop: 8, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 24, color: T.deepViolet, margin: '8px 0 0', letterSpacing: '-0.015em' }}>O dia do corretor muda.</h3>
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600, letterSpacing: '0.04em' }} className="cd-tnum">
          ← {Math.round(pos)}% / {Math.round(100-pos)}% →
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={(e) => dragging.current && onMove(e.clientX)}
        onMouseUp={() => dragging.current = false}
        onMouseLeave={() => dragging.current = false}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        style={{
          position: 'relative', flex: 1, minHeight: 420,
          borderRadius: 20, overflow: 'hidden',
          cursor: 'col-resize', userSelect: 'none',
          border: `1px solid ${T.neutralMid}`,
        }}
      >
        {/* SEM (baseline) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, #1E293B 0%, #475569 100%)`,
          color: '#fff', padding: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 12 }}>Sem Cranium · 23h47</div>
            <h4 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 16px', textWrap: 'balance' }}>
              Lead chegou. Você dorme. Lead esfria.
            </h4>
            <p style={{ fontSize: 15, color: '#CBD5E1', maxWidth: 380, lineHeight: 1.5 }}>
              Resposta amanhã 9h. Cliente já buscou em outros 3 lugares. Você perdeu antes de saber.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <Bd value="4h" label="resposta"/>
            <Bd value="8%" label="conversão"/>
            <Bd value="—" label="dashboard"/>
          </div>
        </div>

        {/* COM (overlay, clipped) */}
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`,
          background: `linear-gradient(135deg, ${T.deepViolet} 0%, ${T.brandPurple} 100%)`,
          color: T.brandTint, padding: 36,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <NeuralBG opacity={0.18} lines={false}/>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.brandLight, marginBottom: 12 }}>
              <span className="cd-pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: T.success, marginRight: 6 }}/>
              Com Cranium · 23h47
            </div>
            <h4 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 16px', color: T.brandTint, textWrap: 'balance' }}>
              IA atende. Qualifica. Te entrega quente.
            </h4>
            <p style={{ fontSize: 15, color: T.neutralSoft, maxWidth: 380, lineHeight: 1.5 }}>
              Em 4 minutos: nome, intent, faixa, melhor horário. Você acorda com lead pronto.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
            <Bd value="4min" label="resposta" light/>
            <Bd value="22%" label="conversão" light/>
            <Bd value="✓" label="dashboard" light/>
          </div>
        </div>

        {/* Handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: `${pos}%`,
            transform: 'translateX(-50%)', width: 4,
            background: T.brandLight, cursor: 'col-resize',
            boxShadow: '0 0 24px rgba(167,139,250,0.6)',
          }}
        >
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 48, height: 48, borderRadius: 999,
            background: '#fff', border: `2px solid ${T.brandPurple}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'col-resize',
            boxShadow: '0 12px 32px -8px rgba(124,58,237,0.45)',
            color: T.brandPurple,
          }}>
            <span style={{ display: 'flex' }}>
              <Icons.ChevronRight size={14} style={{ transform: 'rotate(180deg)' }}/>
              <Icons.ChevronRight size={14}/>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
function Bd({ value, label, light }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12,
      background: light ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.10)',
      border: `1px solid ${light ? 'rgba(167,139,250,0.40)' : 'rgba(255,255,255,0.18)'}`,
      backdropFilter: 'blur(10px)',
    }}>
      <div className="cd-tnum" style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: light ? T.brandTint : '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: light ? T.brandLight : '#94A3B8', marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

Object.assign(window, { ChatIA, AgendaModal, ROICalc, ComparativeSlider });
