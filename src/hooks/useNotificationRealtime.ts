import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEBOUNCE_MS = 2000;

export function useNotificationRealtime(onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    let debounceTimer: number | undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        onRefreshRef.current();
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel('app-notifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'baseVendas' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedido_kanban' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_faturamento' },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, []);
}
