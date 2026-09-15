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

App local: `http://localhost:5173`.

## Variáveis de ambiente

Obrigatórias (também no **build** do Coolify):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Opcionais (webhooks n8n):

- `EXPO_PUBLIC_WEBHOOK_SENHA`
- `EXPO_PUBLIC_WEBHOOK_PESQUISA`
- `EXPO_PUBLIC_WEBHOOK_HARIBO`
- `EXPO_PUBLIC_WEBHOOK_VALIDADE` — Lançar vencimentos (fallback: webhook `comercial1` no n8n)
- `EXPO_PUBLIC_WEBHOOK_VENDAS`

Opcional (Web Push):

- `VITE_VAPID_PUBLIC_KEY` — chave pública VAPID para inscrição push no browser

(Alternativa aceita no código de vendas: `VITE_WEBHOOK_URL`.)

## Deploy Coolify

1. App a partir do GitHub.
2. Build Pack: **Dockerfile**.
3. Porta **80**.
4. Healthcheck: `GET /health` → `ok`.
5. Definir as variáveis Supabase como build args / env de build.
6. Para push notifications: incluir `VITE_VAPID_PUBLIC_KEY` no build.
7. Redeploy: push em `main` dispara o Coolify se o app estiver com webhook GitHub.

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

- Service worker customizado em `src/sw.ts` (precache + push).
- Atualização de versão: banner “Nova versão disponível” via `PwaUpdateProvider`.
- Notificações do sino: retenção rolante de **48h** desde o `at` do evento; badge só para itens com `at` posterior a `seen_at` (localStorage); queries de `avisos` / `baseVendas` / `pedido_kanban` / `contrato_faturamento` com `.gte` na janela de 48h; encartes recentes via `fetchEncartesRecentesParaUsuario`.
- Preferências: `notification_preferences` (`notify_venda`, `notify_kanban_*`, `notify_aviso`, `notify_aniversario`, `notify_meta`). Aniversário e meta batida são avisos no sino (não web-push em massa).
- Avisos: tabela `avisos`, RPC `enviar_aviso`, Edge Function `send-web-push` (`kind = aviso`, só internos), cron `aviso-folha-dia-25` (dia 25 ~12:00 UTC).
- Migration aniversário: `supabase/migrations/20260901100000_notify_aniversario.sql` (já aplicada no projeto remoto).
- Migration meta: `supabase/migrations/20260901110000_notify_meta.sql` (já aplicada no projeto remoto).
## Estrutura útil do código (para quem mantém)

| Pasta / arquivo | Papel |
|-----------------|-------|
| `src/pages/` | Telas |
| `src/services/` | Chamadas ao Supabase e regras de dados |
| `src/data/portalModules.ts` | Módulos, seções, permissões |
| `src/utils/externalAccess.ts` | Tipos e escopo de usuários externos |
| `src/utils/vendasDomain.ts` | Meses, regiões, padronização de indústria |
| `docs/` | Esta documentação |

## Scripts npm

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
