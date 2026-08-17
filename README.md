# Web FE — Painel do Gerente

Painel web (React + Vite) da Fé Merchandising.

## Documentação do produto

Tudo que o app faz hoje (módulos, usuários, regras, deploy) está em **[`docs/`](./docs/README.md)**.  
Atualizações futuras devem ser registradas em [`docs/CHANGELOG.md`](./docs/CHANGELOG.md).

## Setup

```bash
cp .env.example .env
# edite .env com as chaves do Supabase
npm install
npm run dev
```

App em `http://localhost:5173`.

## Deploy (Coolify)

1. Nova aplicação a partir do repositório GitHub.
2. Build Pack: **Dockerfile** (porta **80**).
3. Em Environment Variables / Build Arguments, definir pelo menos:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Healthcheck: `GET /health`.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
