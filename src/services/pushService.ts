import { supabase } from '../lib/supabase';

const DISMISS_KEY = 'fe_web_push_banner_dismissed';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isPushBannerDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPushBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export async function hasPushSubscription(userId: number): Promise<boolean> {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', userId);

  if (error) {
    console.warn('[push] Falha ao verificar inscrição:', error.message);
    return false;
  }

  return (count ?? 0) > 0;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isStandalonePwa(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export async function subscribePush(userId: number): Promise<boolean> {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  // #region agent log
  fetch('http://127.0.0.1:7632/ingest/c0e9f1ed-8998-49cd-81bc-7cbc34147572',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bdee85'},body:JSON.stringify({sessionId:'bdee85',location:'pushService.ts:subscribePush:entry',message:'subscribePush called',data:{userId,hasVapid:!!vapidPublicKey,supported:isPushSupported(),permission:typeof Notification!=='undefined'?Notification.permission:'n/a',isIos:isIosDevice(),isStandalone:isStandalonePwa()},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!vapidPublicKey) {
    // #region agent log
    fetch('http://127.0.0.1:7632/ingest/c0e9f1ed-8998-49cd-81bc-7cbc34147572',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bdee85'},body:JSON.stringify({sessionId:'bdee85',location:'pushService.ts:subscribePush:no-vapid',message:'VITE_VAPID_PUBLIC_KEY missing',data:{userId},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw new Error('Chave VAPID não configurada no build (VITE_VAPID_PUBLIC_KEY). Faça redeploy no Coolify.');
  }
  if (!isPushSupported()) {
    return false;
  }
  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error(
      'No iPhone, abra o App Fé instalado na Tela de Início (não no Safari) para ativar push.',
    );
  }
  if (Notification.permission !== 'granted') {
    // #region agent log
    fetch('http://127.0.0.1:7632/ingest/c0e9f1ed-8998-49cd-81bc-7cbc34147572',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bdee85'},body:JSON.stringify({sessionId:'bdee85',location:'pushService.ts:subscribePush:no-permission',message:'permission not granted',data:{permission:Notification.permission},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    // #region agent log
    fetch('http://127.0.0.1:7632/ingest/c0e9f1ed-8998-49cd-81bc-7cbc34147572',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bdee85'},body:JSON.stringify({sessionId:'bdee85',location:'pushService.ts:subscribePush:invalid-json',message:'subscription json incomplete',data:{hasEndpoint:!!json.endpoint,hasP256dh:!!json.keys?.p256dh,hasAuth:!!json.keys?.auth},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return false;
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      usuario_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'usuario_id,endpoint' },
  );

  // #region agent log
  fetch('http://127.0.0.1:7632/ingest/c0e9f1ed-8998-49cd-81bc-7cbc34147572',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bdee85'},body:JSON.stringify({sessionId:'bdee85',location:'pushService.ts:subscribePush:upsert',message:'upsert result',data:{userId,error:error?.message??null,endpointPrefix:json.endpoint.slice(0,40)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (error) {
    console.warn('[push] Falha ao salvar inscrição:', error.message);
    throw new Error(error.message);
  }

  return true;
}

export async function unsubscribePush(userId: number): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    } else {
      await supabase.from('push_subscriptions').delete().eq('usuario_id', userId);
    }
  } catch (error) {
    console.warn('[push] Falha ao cancelar inscrição:', error);
  }
}
