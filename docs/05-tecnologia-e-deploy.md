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
7. Redeploy: push em `main` dispara o Coolify se o app estiver com webhook GitHub. Sem migration nova nesta entrega (usa a tabela `pesquisa` já existente).

## PWA

- Service worker customizado em `src/sw.ts` (precache + push).
- Atualização de versão: banner “Nova versão disponível” via `PwaUpdateProvider`.
- Notificações do sino: retenção de **2 dias civis BRT**; queries de `avisos` / `baseVendas` / `pedido_kanban` / `contrato_faturamento` com `.gte` na janela.
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
