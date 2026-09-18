/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL: string;
  readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  readonly EXPO_PUBLIC_WEBHOOK_SENHA?: string;
  readonly EXPO_PUBLIC_WEBHOOK_PESQUISA?: string;
  readonly EXPO_PUBLIC_WEBHOOK_HARIBO?: string;
  readonly EXPO_PUBLIC_WEBHOOK_VALIDADE?: string;
  readonly EXPO_PUBLIC_WEBHOOK_VENDAS?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_WEBHOOK_URL?: string;
  /** Base ou URL completa do serviço OCR de pesquisa (preferido). */
  readonly VITE_PESQUISA_OCR_URL?: string;
  /** Secret enviado no header X-OCR-Secret. */
  readonly VITE_PESQUISA_OCR_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
