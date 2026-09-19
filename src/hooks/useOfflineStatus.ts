import { useEffect, useState } from 'react';
import {
  flushOutbox,
  refreshOfflineSyncState,
  startOfflineSyncListeners,
  subscribeOfflineSync,
  type OfflineSyncState,
} from '../services/offlineSyncService';

const INITIAL: OfflineSyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pendingCount: 0,
  items: [],
  lastFlushError: null,
};

export function useOfflineStatus() {
  const [state, setState] = useState<OfflineSyncState>(INITIAL);

  useEffect(() => {
    startOfflineSyncListeners();
    const unsub = subscribeOfflineSync(setState);
    void refreshOfflineSyncState();
    return unsub;
  }, []);

  return {
    ...state,
    flush: flushOutbox,
  };
}
