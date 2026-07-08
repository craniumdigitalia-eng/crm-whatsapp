# Templates de email (Auth) - Cranium

Templates HTML futuristas na identidade do CRM (roxo/violeta, cerebro, dark) para os
emails do Supabase Auth. Todos usam a variavel `{{ .ConfirmationURL }}` (o link de acao)
e o logo servido em `https://crm.craniumdigital.com.br/assets/cranium-brain.png`.

## Onde colar cada um

Painel do Supabase: **Authentication > Emails > Templates**. Para cada template abaixo,
cole o HTML no corpo e ajuste o **Subject** (assunto).

| Arquivo | Slot no Supabase | Assunto sugerido |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirme seu cadastro na Cranium |
| `reset-password.html` | Reset Password | Redefinir sua senha na Cranium |
| `magic-link.html` | Magic Link | Seu link de acesso a Cranium |
| `invite.html` | Invite user | Voce foi convidado para a Cranium |

> O template **Change Email Address** pode reusar o `confirm-signup.html` (troca o texto
> se quiser). O **Reauthentication** usa `{{ .Token }}` (um codigo, nao um link), entao tem
> um formato diferente e nao esta aqui.

## Observacoes

- **Compatibilidade:** layout em tabela + estilos inline (padrao seguro para email).
  Gradientes e cantos arredondados aparecem nos clientes modernos (Apple Mail, Gmail,
  celular); no Outlook antigo caem para cor solida, sem quebrar.
- **Imagens bloqueadas:** muitos clientes escondem imagens por padrao. Por isso o nome
  "CRANIUM digital" e texto, entao a marca aparece mesmo com o logo bloqueado.
- **Entrega confiavel:** o SMTP embutido do Supabase e limitado (poucos por hora) e cai
  em spam com facilidade. Para producao, configurar **SMTP proprio** em
  Authentication > Emails > SMTP Settings (da para usar o mesmo Gmail ja configurado para
  os emails de reuniao, ou um servico como Resend/Postmark).
- **Preview local:** `open supabase/email-templates/reset-password.html` abre no navegador.
