# syntax=docker/dockerfile:1

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app

# Coolify/builders com pouca RAM matam o processo (exit 255) no vite/tsc.
ENV NODE_OPTIONS="--max-old-space-size=4096" \
    CI=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite embute essas vars no bundle em build time.
# No Coolify: configure como Build Arguments / Environment Variables.
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_WEBHOOK_SENHA=
ARG EXPO_PUBLIC_WEBHOOK_PESQUISA=
ARG EXPO_PUBLIC_WEBHOOK_HARIBO=
ARG EXPO_PUBLIC_WEBHOOK_VALIDADE=
ARG EXPO_PUBLIC_WEBHOOK_VENDAS=
ARG VITE_VAPID_PUBLIC_KEY=

ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_WEBHOOK_SENHA=$EXPO_PUBLIC_WEBHOOK_SENHA \
    EXPO_PUBLIC_WEBHOOK_PESQUISA=$EXPO_PUBLIC_WEBHOOK_PESQUISA \
    EXPO_PUBLIC_WEBHOOK_HARIBO=$EXPO_PUBLIC_WEBHOOK_HARIBO \
    EXPO_PUBLIC_WEBHOOK_VALIDADE=$EXPO_PUBLIC_WEBHOOK_VALIDADE \
    EXPO_PUBLIC_WEBHOOK_VENDAS=$EXPO_PUBLIC_WEBHOOK_VENDAS \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

RUN echo "Building with NODE_OPTIONS=$NODE_OPTIONS" \
 && npm run build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]