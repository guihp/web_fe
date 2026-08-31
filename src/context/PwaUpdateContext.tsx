import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { registerSW } from 'virtual:pwa-register';

type PwaUpdateContextValue = {
  needRefresh: boolean;
  updateApp: () => void;
  dismissUpdate: () => void;
};

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null);

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSWRef = useRef<(reloadPage?: boolean) => Promise<void>>();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });

    updateSWRef.current = updateSW;

    const checkForUpdate = () => {
      void updateSW();
    };

    const intervalId = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const updateApp = useCallback(() => {
    void updateSWRef.current?.(true);
  }, []);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  const value = useMemo(
    () => ({ needRefresh, updateApp, dismissUpdate }),
    [needRefresh, updateApp, dismissUpdate],
  );

  return <PwaUpdateContext.Provider value={value}>{children}</PwaUpdateContext.Provider>;
}

export function usePwaUpdate() {
  const ctx = useContext(PwaUpdateContext);
  if (!ctx) throw new Error('usePwaUpdate must be used within PwaUpdateProvider');
  return ctx;
}
