// 4 Forms — contato, cadastro, lead capture, multi-step

/* ============================================================
   1. FORM CONTATO (page Contato)
   ============================================================ */
function Form_Contact() {
  const [v, setV] = React.useState({ nome: '', email: '', telefone: '', susep: '', operadora: '', mensagem: '' });
  const [state, setState] = React.useState('idle'); // idle | loading | success | error
  const upd = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    setState('loading');
    setTimeout(() => setState(Math.random() > 0.15 ? 'success' : 'error'), 1400);
  };
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 24, padding: 40, fontFamily: T.fontBody, maxWidth: 640 }}>
      <Eyebrow>Fale com a gente</Eyebrow>
      <h3 style={{ marginTop: 12, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '12px 0 8px' }}>Conta o que tá rolando.</h3>
      <p style={{ fontSize: 14, color: T.fgMuted, margin: '0 0 28px', lineHeight: 1.55 }}>O Bruno responde em até 4h em dia útil. Em prazo curto, melhor falar no WhatsApp.</p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel required>Nome</FieldLabel>
            <TextInput value={v.nome} onChange={upd('nome')} placeholder="Como prefere ser chamado(a)"/>
          </div>
          <div>
            <FieldLabel required>E-mail</FieldLabel>
            <TextInput type="email" value={v.email} onChange={upd('email')} icon={<Icons.Mail size={16}/>} placeholder="seu@email.com.br"/>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel required hint="com DDD">WhatsApp</FieldLabel>
            <TextInput value={v.telefone} onChange={upd('telefone')} icon={<Icons.Phone size={16}/>} placeholder="(11) 99999-9999"/>
          </div>
          <div>
            <FieldLabel hint="opcional">SUSEP</FieldLabel>
            <TextInput value={v.susep} onChange={upd('susep')} icon={<Icons.ShieldCheck size={16}/>} placeholder="10.2024.000000"/>
          </div>
        </div>
        <div>
          <FieldLabel>Operadora principal que você vende</FieldLabel>
          <SelectInput value={v.operadora} onChange={upd('operadora')}>
            <option value="">Selecione…</option>
            <option>Unimed</option><option>Amil</option><option>SulAmérica</option>
            <option>Bradesco Saúde</option><option>Hapvida</option><option>Várias</option><option>Outras</option>
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Sobre o que quer falar?</FieldLabel>
          <TextArea value={v.mensagem} onChange={upd('mensagem')} rows={4} placeholder="Conta um pouco do contexto: tamanho da operação, principal dor com leads hoje…"/>
        </div>

        <Checkbox checked onChange={()=>{}}>
          Concordo em receber resposta no e-mail e WhatsApp. Sem spam, sair quando quiser.
        </Checkbox>

        {state === 'error' && (
          <div style={{ padding: '10px 14px', background: 'rgba(124,58,237,0.08)', border: `1px solid rgba(124,58,237,0.3)`, borderRadius: 10, fontSize: 13, color: T.brandPurple, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.AlertTriangle size={16}/>Algo travou no envio. Tenta de novo ou chama no WhatsApp.
          </div>
        )}
        {state === 'success' && (
          <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.10)', border: `1px solid rgba(16,185,129,0.30)`, borderRadius: 10, fontSize: 13, color: T.success, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.CheckCircle size={16}/>Enviado. Bruno responde em até 4h em dia útil.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          <a href="#wa" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.success, textDecoration: 'none', fontWeight: 500 }}>
            <Icons.WhatsApp size={16}/>ou direto no WhatsApp →
          </a>
          <Btn variant="primary" size="md" disabled={state === 'loading'} iconRight={state === 'loading' ? <Icons.Loader size={16} style={{ animation: 'cd-spin 1s linear infinite' }}/> : <Icons.Send size={16}/>}>
            {state === 'loading' ? 'Enviando…' : 'Enviar mensagem'}
          </Btn>
        </div>
      </form>
      <style>{`@keyframes cd-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ============================================================
   2. FORM CADASTRO (criar conta)
   ============================================================ */
function Form_Signup() {
  const [v, setV] = React.useState({ nome: '', email: '', senha: '', susep: '' });
  const upd = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 24, padding: 40, fontFamily: T.fontBody, maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Brand size={32} dark/>
      </div>
      <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 6px' }}>Criar sua conta.</h3>
      <p style={{ fontSize: 14, color: T.fgMuted, margin: '0 0 28px', lineHeight: 1.55 }}>Pra acessar o painel da Cranium. 30 segundos, sem cartão.</p>

      <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel required>Nome completo</FieldLabel>
          <TextInput value={v.nome} onChange={upd('nome')} icon={<Icons.User size={16}/>} placeholder="Bruno de Castro"/>
        </div>
        <div>
          <FieldLabel required>E-mail profissional</FieldLabel>
          <TextInput type="email" value={v.email} onChange={upd('email')} icon={<Icons.Mail size={16}/>} placeholder="seu@corretora.com.br"/>
        </div>
        <div>
          <FieldLabel required hint="mínimo 8 caracteres">Senha</FieldLabel>
          <TextInput type="password" value={v.senha} onChange={upd('senha')} placeholder="••••••••"/>
        </div>
        <div>
          <FieldLabel hint="opcional pra começar">SUSEP</FieldLabel>
          <TextInput value={v.susep} onChange={upd('susep')} icon={<Icons.ShieldCheck size={16}/>} placeholder="10.2024.000000"/>
        </div>
        <Checkbox checked onChange={()=>{}}>
          Concordo com os <a href="#" style={{ color: T.brandPurple }}>Termos</a> e <a href="#" style={{ color: T.brandPurple }}>Política de Privacidade</a>.
        </Checkbox>
        <Btn variant="primary" size="md" fullWidth iconRight={<Icons.ArrowRight size={16}/>} style={{ marginTop: 8 }}>
          Criar conta
        </Btn>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, color: T.fgMuted, fontSize: 12, margin: '8px 0',
        }}>
          <span style={{ flex: 1, height: 1, background: T.neutralMid }}/>
          ou
          <span style={{ flex: 1, height: 1, background: T.neutralMid }}/>
        </div>
        <Btn variant="secondary" size="md" fullWidth icon={<Icons.WhatsApp size={16} style={{ color: T.success }}/>}>
          Continuar com WhatsApp
        </Btn>
        <p style={{ fontSize: 13, color: T.fgMuted, textAlign: 'center', marginTop: 12 }}>
          Já tem conta? <a href="#" style={{ color: T.brandPurple, fontWeight: 500, textDecoration: 'none' }}>Entrar</a>
        </p>
      </form>
    </div>
  );
}

/* ============================================================
   3. LEAD CAPTURE (compacto)
   ============================================================ */
function Form_LeadCapture() {
  const [v, setV] = React.useState({ nome: '', email: '', telefone: '' });
  const [submitted, setSubmitted] = React.useState(false);
  const upd = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <div style={{
      background: T.deepViolet, color: T.brandTint,
      border: `1px solid ${T.borderDark}`,
      borderRadius: 24, padding: 36,
      fontFamily: T.fontBody, maxWidth: 480,
      position: 'relative', overflow: 'hidden',
    }}>
      <NeuralBG opacity={0.15} lines={false}/>
      <div style={{ position: 'relative' }}>
        <Eyebrow dark>Material gratuito</Eyebrow>
        <h3 style={{ marginTop: 12, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', color: T.brandTint, lineHeight: 1.15, margin: '12px 0 8px' }}>
          Receba o case<br/>completo em PDF.
        </h3>
        <p style={{ fontSize: 14, color: T.neutralSoft, margin: '0 0 24px', lineHeight: 1.55 }}>
          Como a Corretora X dobrou conversão em 90 dias rodando IA da Cranium. 14 páginas, números reais.
        </p>

        {submitted ? (
          <div style={{ padding: 24, background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', borderRadius: 14, textAlign: 'center' }}>
            <Icons.CheckCircle size={32} style={{ color: T.success, marginBottom: 12 }}/>
            <div style={{ fontWeight: 600, color: T.brandTint, fontSize: 16, marginBottom: 4 }}>Pronto!</div>
            <div style={{ fontSize: 13, color: T.neutralSoft }}>Olha sua caixa de entrada — chegou em segundos.</div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TextInput value={v.nome} onChange={upd('nome')} icon={<Icons.User size={16}/>} placeholder="Seu nome" dark/>
            <TextInput type="email" value={v.email} onChange={upd('email')} icon={<Icons.Mail size={16}/>} placeholder="seu@email.com.br" dark/>
            <TextInput value={v.telefone} onChange={upd('telefone')} icon={<Icons.Phone size={16}/>} placeholder="(11) 99999-9999" dark/>
            <Btn variant="primary" size="md" fullWidth iconRight={<Icons.Download size={16}/>}>
              Receber o PDF
            </Btn>
            <div style={{ fontSize: 11, color: T.neutralSoft, lineHeight: 1.5, marginTop: 4 }}>
              Vai pro seu e-mail em segundos. Sem cadastro chato, sem spam.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   4. MULTI-STEP FORM
   ============================================================ */
function Form_MultiStep() {
  const [step, setStep] = React.useState(0);
  const [v, setV] = React.useState({ tipo: '', volume: '', operadora: '', nome: '', email: '', telefone: '' });
  const upd = (k, val) => setV({ ...v, [k]: val });
  const total = 3;

  const next = () => setStep(Math.min(step + 1, total));
  const back = () => setStep(Math.max(step - 1, 0));

  const canNext = (() => {
    if (step === 0) return v.tipo && v.volume;
    if (step === 1) return v.operadora;
    return v.nome && v.email && v.telefone;
  })();

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 24, padding: 40, fontFamily: T.fontBody, maxWidth: 580 }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600, letterSpacing: '0.04em' }}>
          {String(step + 1).padStart(2, '0')} <span style={{ color: T.fgMuted }}>/ {String(total + 1).padStart(2, '0')}</span>
        </div>
        <div style={{ flex: 1, height: 4, background: T.neutralMid, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            width: `${((step + 1) / (total + 1)) * 100}%`,
            height: '100%', background: T.brandPurple,
            transition: 'width 320ms cubic-bezier(0.22,1,0.36,1)',
          }}/>
        </div>
        <div style={{ fontSize: 11, color: T.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>~2 min</div>
      </div>

      {step === 0 && (
        <div>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 6px', lineHeight: 1.15 }}>
            Conta da sua operação.
          </h3>
          <p style={{ fontSize: 14, color: T.fgMuted, margin: '0 0 24px' }}>Pra Bruno montar a proposta certa pra você.</p>
          <div style={{ marginBottom: 24 }}>
            <FieldLabel required>Você é</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { v: 'autonomo', l: 'Corretor autônomo' },
                { v: 'pme',      l: 'Sócio corretora PME' },
                { v: 'grande',   l: 'Corretora grande' },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => upd('tipo', opt.v)} style={{
                  padding: '14px 12px', borderRadius: 14,
                  background: v.tipo === opt.v ? T.brandPurple : '#fff',
                  border: `1px solid ${v.tipo === opt.v ? T.brandPurple : T.neutralMid}`,
                  color: v.tipo === opt.v ? '#fff' : T.deepViolet,
                  fontFamily: T.fontBody, fontWeight: 500, fontSize: 13,
                  cursor: 'pointer', transition: 'all 180ms',
                  textAlign: 'left', lineHeight: 1.3,
                }}>{opt.l}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel required>Volume de leads/mês hoje</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['<50', '50-200', '200-500', '500+'].map(opt => (
                <button key={opt} type="button" onClick={() => upd('volume', opt)} style={{
                  padding: '14px 8px', borderRadius: 14,
                  background: v.volume === opt ? T.brandPurple : '#fff',
                  border: `1px solid ${v.volume === opt ? T.brandPurple : T.neutralMid}`,
                  color: v.volume === opt ? '#fff' : T.deepViolet,
                  fontFamily: T.fontMono, fontWeight: 500, fontSize: 14,
                  cursor: 'pointer', transition: 'all 180ms',
                }}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 6px', lineHeight: 1.15 }}>
            Operadora principal?
          </h3>
          <p style={{ fontSize: 14, color: T.fgMuted, margin: '0 0 24px' }}>Pra IA já chegar treinada no seu produto.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {['Unimed', 'Amil', 'SulAmérica', 'Bradesco Saúde', 'Hapvida', 'Várias / Multi-operadora'].map(op => (
              <button key={op} type="button" onClick={() => upd('operadora', op)} style={{
                padding: '14px 16px', borderRadius: 14,
                background: v.operadora === op ? T.brandPurple : '#fff',
                border: `1px solid ${v.operadora === op ? T.brandPurple : T.neutralMid}`,
                color: v.operadora === op ? '#fff' : T.deepViolet,
                fontFamily: T.fontBody, fontWeight: 500, fontSize: 14,
                cursor: 'pointer', transition: 'all 180ms', textAlign: 'left',
              }}>{op}</button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 6px', lineHeight: 1.15 }}>
            Como o Bruno te procura?
          </h3>
          <p style={{ fontSize: 14, color: T.fgMuted, margin: '0 0 24px' }}>Resposta em até 4h em dia útil. Sem SDR genérico.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><FieldLabel required>Nome</FieldLabel><TextInput value={v.nome} onChange={e => upd('nome', e.target.value)} icon={<Icons.User size={16}/>} placeholder="Seu nome"/></div>
            <div><FieldLabel required>E-mail</FieldLabel><TextInput type="email" value={v.email} onChange={e => upd('email', e.target.value)} icon={<Icons.Mail size={16}/>} placeholder="seu@email.com.br"/></div>
            <div><FieldLabel required>WhatsApp</FieldLabel><TextInput value={v.telefone} onChange={e => upd('telefone', e.target.value)} icon={<Icons.Phone size={16}/>} placeholder="(11) 99999-9999"/></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ width: 80, height: 80, borderRadius: 999, background: 'rgba(16,185,129,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.success, marginBottom: 20 }}>
            <Icons.CheckCircle size={40}/>
          </div>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 12px' }}>Recebido.</h3>
          <p style={{ fontSize: 16, color: T.fgMuted, margin: '0 0 24px', lineHeight: 1.55, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Bruno responde no seu WhatsApp em até 4h. Em paralelo, salvamos seu contexto pra IA já chegar treinada.
          </p>
          <Btn variant="secondary" size="md" iconRight={<Icons.ArrowRight size={16}/>}>Voltar pro site</Btn>
        </div>
      )}

      {step < 3 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          <Btn variant="text" disabled={step === 0} onClick={back} icon={<Icons.ArrowLeft size={16}/>}>Voltar</Btn>
          <Btn variant="primary" size="md" disabled={!canNext} onClick={next} iconRight={<Icons.ArrowRight size={16}/>}>
            {step === 2 ? 'Enviar' : 'Continuar'}
          </Btn>
        </div>
      )}
    </div>
  );
}

/* wrapper */
function Forms() {
  const list = [
    { n: 1, name: 'Contato (page Contato)', comp: Form_Contact },
    { n: 2, name: 'Cadastro / Signup',       comp: Form_Signup },
    { n: 3, name: 'Lead Capture (compacto, dark)', comp: Form_LeadCapture },
    { n: 4, name: 'Multi-step (3 passos)',   comp: Form_MultiStep },
  ];
  return (
    <div style={{ background: '#f0eee9', padding: '32px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
        {list.map(f => (
          <div key={f.n}>
            <div style={{
              padding: '12px 0', fontFamily: T.fontBody,
              display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16,
              borderBottom: '1px dashed rgba(124,58,237,0.2)',
            }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600 }}>FORM {String(f.n).padStart(2, '0')}</span>
              <span style={{ fontWeight: 600, color: T.deepViolet, fontSize: 15 }}>{f.name}</span>
            </div>
            <f.comp/>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Form_Contact, Form_Signup, Form_LeadCapture, Form_MultiStep, Forms });
