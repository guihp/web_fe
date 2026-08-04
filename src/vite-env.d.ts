/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL: string;
  readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  readonly EXPO_PUBLIC_WEBHOOK_SENHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
