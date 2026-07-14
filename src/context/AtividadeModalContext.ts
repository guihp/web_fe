import { createContext, useContext } from 'react';

export type AtividadeModalContextValue = {
  openAddAtividade: () => void;
  registerOnCreated: (callback: () => void) => () => void;
};

export const AtividadeModalContext = createContext<AtividadeModalContextValue | null>(null);

export function useAtividadeModal() {
  const ctx = useContext(AtividadeModalContext);
  if (!ctx) {
    throw new Error('useAtividadeModal must be used within AtividadeModalProvider');
  }
  return ctx;
}
