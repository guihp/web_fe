# Tecnologia e deploy

## Stack

| Camada | Tecnologia |
|--------|------------|
| Front | React 18 + TypeScript + Vite |
| Rotas | React Router 6 |
| Backend de dados | Supabase (Postgres + Storage + RPC) |
| Exportação | xlsx, jsPDF, html2canvas |
| Deploy | Docker (Node build + Nginx) via Coolify |

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
- `EXPO_PUBLIC_WEBHOOK_VALIDADE`
- `EXPO_PUBLIC_WEBHOOK_VENDAS`

(Alternativa aceita no código de vendas: `VITE_WEBHOOK_URL`.)

## Deploy Coolify

1. App a partir do GitHub.
2. Build Pack: **Dockerfile**.
3. Porta **80**.
4. Healthcheck: `GET /health` → `ok`.
5. Definir as variáveis Supabase como build args / env de build.

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
