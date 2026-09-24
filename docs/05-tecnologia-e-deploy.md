# Tecnologia e deploy

## Stack

| Camada | Tecnologia |
|--------|------------|
| Front | React 18 + TypeScript + Vite |
| Rotas | React Router 6 |
| Backend de dados | Supabase (Postgres + Storage + RPC) |
| Exportação | xlsx, jsPDF, html2canvas |
| Deploy | Docker (Node build + Nginx) via Coolify |
| PWA | vite-plugin-pwa (injectManifest) + Web Push |

Pacote npm: `app-fe-web-gerente`.

## Ambientes locais

```bash
cp .env.example .env
npm install
npm run dev
```

App local: `http://localhost:5174` (HTTP por padrão). Para HTTPS local: `VITE_DEV_HTTPS=1 npm run dev`.

### Auth — reset de senha (Supabase)

Painel: **Authentication → URL Configuration**

| Ambiente | Site URL | Redirect URLs |
|----------|----------|---------------|
| Local (recomendado) | `http://localhost:5174/redefinir-senha` | `http://localhost:5174/redefinir-senha` |
| Produção (após Coolify) | `https://SEU-DOMINIO` | `https://SEU-DOMINIO/redefinir-senha` e `https://SEU-DOMINIO/**` |

Edge Functions no projeto App Fé (`sjapbromslgohlxcndrj`):

- `request-password-reset` (`verify_jwt: false`) — pedido a partir do Login
- `sync-password-after-reset` (`verify_jwt: true`) — grava hash em `usuarios.senha` após `updateUser`

Rota pública do front: `/redefinir-senha`.

## Variáveis de ambiente

Obrigatórias (também no **build** do Coolify):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Opcionais (webhooks n8n):

- `EXPO_PUBLIC_WEBHOOK_SENHA`
- `EXPO_PUBLIC_WEBHOOK_PESQUISA` — fallback de URL do OCR se `VITE_PESQUISA_OCR_URL` estiver vazio
- `EXPO_PUBLIC_WEBHOOK_HARIBO`
- `EXPO_PUBLIC_WEBHOOK_VALIDADE` — Lançar vencimentos (fallback: webhook `comercial1` no n8n)
- `EXPO_PUBLIC_WEBHOOK_VENDAS`

Opcionais (Fazer Pesquisa / OCR):

- `VITE_PESQUISA_OCR_URL` — base ou URL completa do serviço Python (`…/ocr/pesquisa`)
- `VITE_PESQUISA_OCR_SECRET` — valor do header `X-OCR-Secret` (mesmo `OCR_SHARED_SECRET` do app OCR). **Sempre entre aspas** se contiver `#`; reinicie o Vite após alterar. Deve ser byte-a-byte idêntico ao Coolify.

Opcional (Web Push):

- `VITE_VAPID_PUBLIC_KEY` — chave pública VAPID para inscrição push no browser

(Alternativa aceita no código de vendas: `VITE_WEBHOOK_URL`.)

## Deploy Coolify

São **dois apps** no mesmo VPS (sem migration nova — usa a tabela `pesquisa` já existente).

### App 1 — web_fe (PWA)

1. App a partir do GitHub; Build Pack: **Dockerfile**; porta **80**.
2. Healthcheck: `GET /health` → `ok`.
3. Build args / env de build: Supabase (`EXPO_PUBLIC_SUPABASE_*`), webhooks n8n se usados, e para OCR:
   - `VITE_PESQUISA_OCR_URL` (ex.: `https://ocr-pesquisa.seudominio.com`)
   - `VITE_PESQUISA_OCR_SECRET` (mesmo segredo do app OCR)
4. Opcional: `VITE_VAPID_PUBLIC_KEY` para push.
5. Redeploy: push em `main` dispara o Coolify se o app estiver com webhook GitHub.

### App 2 — pesquisa-ocr (Python)

Repo de deploy: [iafeoficial/ocr-fe-representacao](https://github.com/iafeoficial/ocr-fe-representacao) (Dockerfile na raiz). Cópia local de desenvolvimento: [`services/pesquisa-ocr/`](../services/pesquisa-ocr/).

1. Novo app no Coolify a partir desse repo; **Base Directory** vazio; porta **8000**; healthcheck `GET /health`.
2. Env no Coolify (runtime):

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OCR_SHARED_SECRET` | sim | Idêntico a `VITE_PESQUISA_OCR_SECRET` do web_fe. Se tiver `#`, não truncar; no Coolify cole o valor sem aspas extras (ou aspas só se a UI não as incluir no valor). |
| `SUPABASE_URL` | sim* | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim* | Service role — **somente leitura** de `public.codigos` |

\*Necessárias para pesquisa **interna** (match fuzzy). Externa devolve só OCR + preço.

3. Domínio público (ex.: `https://ocr-pesquisa.seudominio.com`) — é o valor de `VITE_PESQUISA_OCR_URL` no build do front.

### Catálogo das indústrias (interno ao App)

**Produto / crédito:** desenhado por **Matheus Lucas** (Analista de Marketing); 1ª versão com apoio de **Helry Araujo Rodrigues**. Produção atual: **dentro do painel** (Coolify), sem runtime Vercel.

- Front estático: `public/catalogo/` → servido em `/catalogo/`.
- Hub: `/merchandising/catalogo` (iframe same-origin).
- API same-origin: nginx faz proxy de `/api/catalog` e `/api/product-image` para as Edge Functions `catalogo-catalog` e `catalogo-product-image`.
- Dados: tabela `catalogo_fe_kv` (Postgres). Migration: `supabase/migrations/20260914180000_catalogo_fe_kv.sql`.
- Local (`npm run dev`): Vite proxy em `vite.config.ts` aponta as mesmas rotas `/api/*` para o Supabase.
- Escopo de UI: query `?gestao=1` / `?industry=slug` conforme cargo e tipo de usuário (portal).

#### Google OAuth (obrigatório para Drive / gestão)

No [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Client ID do catálogo (`1084907924579-93i3dfhtnvckmhrh4mc7n2rtl4rmet5s...`):

**Origens JavaScript autorizadas** (sem path, sem barra no final):

- `http://localhost:5173` (dev Vite)
- `https://SEU-DOMINIO-COOLIFY` (produção; use exatamente a URL pública do app)

**URI de redirecionamento autorizados** (se o Console pedir):

- `http://localhost:5173`
- `https://SEU-DOMINIO-COOLIFY`

Sem a origem de produção o login Google falha com `origin_mismatch` após o deploy.

Visualizar imagens já gravadas no Drive (Ruppers / Tourinho / Precioso) **não** exige OAuth. OAuth é só para gestão/upload.

Não há runtime Vercel no fluxo de produção do catálogo.

## PWA

- Service worker customizado em `src/sw.ts` (precache + push + **navegação offline** SPA + cache do catálogo + Background Sync `fe-outbox-sync`).
- **Offline de campo (Merchandising):** fila IndexedDB (`fe-offline-sync`) para **Meu roteiro** (fotos) e **Lançar vencimentos** (webhook). Sync híbrido: envia ao reconectar; se falhar, banner **Enviar pendentes**.
- Cache de leitura: lojas/indústrias/senha do dia; snapshot de **Validades** (só consulta); catálogo via assets + IDB `fe-catalogo-produtos` (sem upload offline).
- **Fora desta fase:** Fazer pesquisa / OCR (exige rede).
- Atualização de versão: banner “Nova versão disponível” via `PwaUpdateProvider`.
- Banner de status offline: `OfflineBanner` em `main.tsx`.
- Notificações do sino: retenção rolante de **48h** desde o `at` do evento; badge só para itens com `at` posterior a `seen_at` (localStorage); queries de `avisos` / `baseVendas` / `pedido_kanban` / `contrato_faturamento` com `.gte` na janela de 48h; encartes recentes via `fetchEncartesRecentesParaUsuario`; **veículos** via `fetchVeiculoNotificationsForUser` (inclui lembrete 7 dias após retirada enquanto `em_uso`).
- Preferências: `notification_preferences` (`notify_venda`, `notify_kanban_*`, `notify_aviso`, `notify_aniversario`, `notify_meta`). Aniversário e meta batida são avisos no sino (não web-push em massa).
- Avisos: tabela `avisos`, RPC `enviar_aviso`, Edge Function `send-web-push` (`kind = aviso`, só internos), cron `aviso-folha-dia-25` (dia 25 ~12:00 UTC).
- Realtime do sino também em `veiculo_retiradas`, `veiculo_entregas` e `veiculo_responsabilidades`.
- Migration aniversário: `supabase/migrations/20260901100000_notify_aniversario.sql` (já aplicada no projeto remoto).
- Migration meta: `supabase/migrations/20260901110000_notify_meta.sql` (já aplicada no projeto remoto).
- Gestão de Veículos: bucket Storage `veiculo-anexos`; service `src/services/veiculosService.ts`; página `src/pages/GestaoVeiculos.tsx`.
- Notificações push: tabela Supabase `push_subscriptions`; Realtime em `baseVendas`, `pedido_kanban` e `contrato_faturamento` para badge do sino.

## Hub Grupo Fé (multi-sistema)

O balão **Grupo Fé** (`/grupo-fe`) agrega KPIs de Fé Merchandising, IAFÉ Finance, IAFÉ Imobi e Daily via Edge Function `hub-metrics` no projeto App Fé (`sjapbromslgohlxcndrj`).

### Secrets no Supabase App Fé

Em **Project Settings → Edge Functions → Secrets** (ou CLI `supabase secrets set`), configurar:

| Secret | Valor esperado |
|--------|----------------|
| `FINANCE_SUPABASE_URL` | `https://dlbiwguzbiosaoyrcvay.supabase.co` |
| `FINANCE_SERVICE_ROLE_KEY` | **service_role** (secret) do projeto Finance — **não** use anon |
| `IMOBI_SUPABASE_URL` | `https://bfcssdogttmqeujgmxdf.supabase.co` |
| `IMOBI_SERVICE_ROLE_KEY` | **service_role** (secret) do projeto Imobi — **não** use anon |
| `DAILY_SUPABASE_URL` | `https://gyadlrxdwxwzaerpjudu.supabase.co` |
| `DAILY_SERVICE_ROLE_KEY` | **service_role** (secret) do projeto Daily — **não** use anon |

Onde pegar: em cada projeto remoto → **Project Settings → API → `service_role` `secret`** (legado: JWT com `"role":"service_role"`; novo formato: chave `sb_secret_…`). **Não** use `anon` / `publishable` / `sb_publishable_…`.

Se configurar só `*_ANON_KEY` ou colar a chave anon em `*_SERVICE_ROLE_KEY`, a function falha de propósito com mensagem clara. Anon + RLS devolve vazio sem erro de API → o Hub mostrava zeros com status "Atualizado".

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do App Fé já existem automaticamente no runtime das functions.

A function usa `verify_jwt: false` e autentica pelo `usuario_id` (body / header `x-usuario-id`), validando `usuarios` + `is_super_admin` / `hub_usuario_sistemas`.

### Primeiro admin supremo

Nenhum usuário nasce como super admin. Marque o primeiro via SQL no App Fé:

```sql
UPDATE usuarios
SET is_super_admin = true
WHERE cpf = 'SEU_CPF_SOMENTE_DIGITOS';
-- ou: WHERE id = 123;
```

Depois, faça logout/login. Esse usuário verá o balão Grupo Fé e poderá liberar sistemas/seções (e marcar outros super admins) em **Administrador → Usuários**.

### Deploy da function

Código em `supabase/functions/hub-metrics/index.ts`. Redeploy via MCP/`supabase functions deploy hub-metrics --no-verify-jwt` após alterações.

## Estrutura útil do código (para quem mantém)

| Pasta / arquivo | Papel |
|-----------------|-------|
| `src/pages/` | Telas |
| `src/services/` | Chamadas ao Supabase e regras de dados |
| `src/services/pesquisaOcrService.ts` | Cliente HTTP do OCR (Fazer Pesquisa) |
| `services/pesquisa-ocr/` | App FastAPI + Tesseract (fonte local; deploy em [ocr-fe-representacao](https://github.com/iafeoficial/ocr-fe-representacao)) |
| `src/data/portalModules.ts` | Módulos, seções, permissões |
| `src/utils/externalAccess.ts` | Tipos e escopo de usuários externos |
| `src/utils/vendasDomain.ts` | Meses, regiões, padronização de indústria |
| `docs/` | Esta documentação (handbook para IA; sem efeito na UI) |

## Edge Functions (inventário)

Projeto App Fé (`sjapbromslgohlxcndrj`), pasta `supabase/functions/`:

| Function | Papel |
|----------|--------|
| `hub-metrics` | KPIs do hub Grupo Fé (Fé + Finance + Imobi + Daily); auth por `usuario_id` |
| `catalogo-catalog` | API do Catálogo (KV / indústrias) |
| `catalogo-product-image` | Imagens de produto do catálogo |
| `send-web-push` | Push web (avisos e outros `kind`) |
| `request-password-reset` | Pedido público de recovery (Login) |
| `sync-password-after-reset` | Após recovery, sincroniza senha em `usuarios.senha` |

Flags JWT exatas dependem do deploy; ver seções de reset e hub acima.

## RLS e segurança (estado atual)

- Login do painel **não** amarra o PostgREST a um JWT de usuário do Auth: a sessão é custom; o client usa a **anon key**.
- Em migrations recentes, várias tabelas (avisos, push, veículos, `catalogo_fe_kv`, etc.) têm RLS **ligado**, porém com políticas amplas do tipo teste (`temp_anon_all_*` / `using (true)` em alguns casos).
- **Não** afirmar que o banco está “production-hardened” por usuário. Endurecimento de RLS está adiado (também em [04-regras-de-negocio.md](./04-regras-de-negocio.md)).
- `hub-metrics` exige **service role** nos secrets dos projetos remotos; anon + RLS devolve métricas vazias sem erro óbvio de API.

## Scripts npm

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
