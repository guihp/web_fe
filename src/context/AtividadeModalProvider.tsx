import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import AddAtividadeModal from '../components/atividades/AddAtividadeModal';
import ConfirmAtividadeModal from '../components/atividades/ConfirmAtividadeModal';
import { AtividadeModalContext } from './AtividadeModalContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type { AtividadeFormData } from '../services/atividadesService';
import { addAtividade } from '../services/atividadesService';

export function AtividadeModalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const onCreatedRef = useRef<Set<() => void>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<AtividadeFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAddAtividade = useCallback(() => {
    setError(null);
    setFormOpen(true);
  }, []);

  const registerOnCreated = useCallback((callback: () => void) => {
    onCreatedRef.current.add(callback);
    return () => {
      onCreatedRef.current.delete(callback);
    };
  }, []);

  const closeAll = useCallback(() => {
    setFormOpen(false);
    setConfirmOpen(false);
    setPending(null);
    setError(null);
  }, []);

  const handleFormSubmit = (data: AtividadeFormData) => {
    setPending(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pending) return;

    if (!user?.id) {
      setError('Usuário não autenticado.');
      setConfirmOpen(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await addAtividade(pending, user.id);
      closeAll();
      showToast(
        created > 1 ? `${created} atividades criadas com sucesso!` : 'Atividade criada com sucesso!',
        'success'
      );
      onCreatedRef.current.forEach((cb) => cb());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar atividade.';
      setError(message);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const value = useMemo(
    () => ({ openAddAtividade, registerOnCreated }),
    [openAddAtividade, registerOnCreated]
  );

  return (
    <AtividadeModalContext.Provider value={value}>
      {children}

      {formOpen && (
        <AddAtividadeModal onClose={closeAll} onSubmit={handleFormSubmit} error={error} />
      )}

      {confirmOpen && pending && (
        <ConfirmAtividadeModal
          pending={pending}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          saving={saving}
        />
      )}
    </AtividadeModalContext.Provider>
  );
}
