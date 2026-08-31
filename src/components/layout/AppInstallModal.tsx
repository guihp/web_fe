import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import {
  enableAllNotificationPreferences,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../../services/notificationPreferencesService';
import { isPushSupported, subscribePush, hasPushSubscription } from '../../services/pushService';
import { isExternalTipo } from '../../utils/externalAccess';
import { isCampoMerchNotifCargo } from '../../services/notificationsService';
import './AppInstallModal.css';

type InstallTab = 'android' | 'ios' | 'desktop';

type Props = {
  open: boolean;
  onClose: () => void;
};

function pushStatusLabel(): string {
  if (!isPushSupported()) return 'Não suportado neste navegador';
  if (Notification.permission === 'granted') return 'Ativadas';
  if (Notification.permission === 'denied') return 'Bloqueadas pelo browser';
  return 'Desativadas';
}

export default function AppInstallModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { canInstall, promptInstall, isStandalone, isIos } = usePwaInstall();
  const [tab, setTab] = useState<InstallTab>('android');
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  const external = isExternalTipo(user?.tipo_usuario);
  const campoMerch = isCampoMerchNotifCargo(user?.cargo);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const [data, registered] = await Promise.all([
      fetchNotificationPreferences(user.id),
      hasPushSubscription(user.id),
    ]);
    setPrefs(data);
    setDeviceRegistered(registered);
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    void loadPrefs();
    setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
    if (isIos) setTab('ios');
    else if (/Android/i.test(navigator.userAgent)) setTab('android');
    else setTab('desktop');
  }, [open, user, loadPrefs, isIos]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleInstallNow = async () => {
    setInstallLoading(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        showToast('App instalado com sucesso.', 'success');
      }
    } finally {
      setInstallLoading(false);
    }
  };

  const handleEnablePush = async () => {
    if (!user || !isPushSupported()) return;

    setPushLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        await syncDevicePush();
      } else if (result === 'denied') {
        showToast(
          'Permissão negada. Reative nas configurações do navegador.',
          'error',
        );
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Não foi possível ativar notificações.',
        'error',
      );
    } finally {
      setPushLoading(false);
    }
  };

  const syncDevicePush = async () => {
    if (!user) return;

    const subscribed = await subscribePush(user.id);
    if (!subscribed) {
      showToast('Push não suportado neste navegador.', 'error');
      return;
    }

    await enableAllNotificationPreferences(user.id, user.tipo_usuario, user.cargo);
    await loadPrefs();

    const registered = await hasPushSubscription(user.id);
    setDeviceRegistered(registered);

    if (registered) {
      showToast('Dispositivo registrado para notificações push.', 'success');
    } else {
      showToast(
        'Permissão ok, mas o dispositivo não foi salvo no servidor. Tente sincronizar de novo.',
        'error',
      );
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user || !prefs) return;

    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await saveNotificationPreferences(user.id, next);
    } catch (error) {
      setPrefs(prefs);
      showToast(
        error instanceof Error ? error.message : 'Não foi possível salvar preferências.',
        'error',
      );
    }
  };

  if (!open) return null;

  const showInstallButton = canInstall && (tab === 'android' || tab === 'desktop');

  return (
    <div
      className="app-install-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="app-install-modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-install-title"
      >
        <header className="app-install-header">
          <div>
            <h2 id="app-install-title">Instalar app e notificações</h2>
            <p>Instale o App Fé no dispositivo e configure alertas push.</p>
          </div>
          <button
            type="button"
            className="app-install-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="app-install-body">
          <section className="app-install-section">
            <h3>Instalar o app</h3>

            <div className="app-install-tabs" role="tablist">
              {(['android', 'ios', 'desktop'] as InstallTab[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`app-install-tab ${tab === id ? 'is-active' : ''}`}
                  onClick={() => setTab(id)}
                >
                  {id === 'android' ? 'Android' : id === 'ios' ? 'iOS' : 'Computador'}
                </button>
              ))}
            </div>

            {isStandalone && (
              <p className="app-install-installed">App já instalado neste dispositivo.</p>
            )}

            {tab === 'android' && (
              <ol className="app-install-steps">
                <li>Abra o menu ⋮ no canto superior direito</li>
                <li>
                  Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>
                </li>
                <li>Confirme em <strong>Instalar</strong></li>
              </ol>
            )}

            {tab === 'ios' && (
              <ol className="app-install-steps">
                <li>
                  Toque no ícone <strong>Compartilhar</strong> (quadrado com seta)
                </li>
                <li>
                  Role e toque em <strong>Adicionar à Tela de Início</strong>
                </li>
                <li>
                  Toque em <strong>Adicionar</strong>
                </li>
                <li>
                  Abra o <strong>App Fé</strong> pela tela inicial e ative as notificações aqui
                  (push no iPhone só funciona no app instalado, não no Safari).
                </li>
              </ol>
            )}

            {tab === 'desktop' && (
              <ol className="app-install-steps">
                <li>
                  Clique no ícone <strong>Instalar</strong> (⊕) na barra de endereço
                </li>
                <li>
                  Ou: menu do browser → <strong>Instalar App Fé...</strong>
                </li>
                <li>Confirme a instalação</li>
              </ol>
            )}

            {showInstallButton && (
              <button
                type="button"
                className="app-install-btn"
                onClick={() => void handleInstallNow()}
                disabled={installLoading}
              >
                {installLoading ? 'Instalando...' : 'Instalar agora'}
              </button>
            )}
          </section>

          <section className="app-install-section">
            <h3>Notificações push</h3>

            <p className="app-install-push-status">
              Status: <strong>{pushStatusLabel()}</strong>
            </p>

            {permission === 'granted' && deviceRegistered !== null && (
              <p className="app-install-push-status">
                Dispositivo no servidor:{' '}
                <strong>{deviceRegistered ? 'Registrado' : 'Não registrado'}</strong>
              </p>
            )}

            {isIos && !isStandalone && (
              <p className="app-install-push-hint">
                No iPhone, instale o app na Tela de Início e abra por lá para registrar push.
              </p>
            )}

            {permission !== 'granted' && isPushSupported() && (
              <>
                {permission === 'denied' ? (
                  <p className="app-install-push-hint">
                    As notificações foram bloqueadas. Abra as configurações do site no navegador
                    e permita notificações para reativar.
                  </p>
                ) : (
                  <button
                    type="button"
                    className="app-install-btn"
                    onClick={() => void handleEnablePush()}
                    disabled={pushLoading}
                  >
                    {pushLoading ? 'Ativando...' : 'Ativar notificações'}
                  </button>
                )}
              </>
            )}

            {permission === 'granted' && isPushSupported() && (
              <button
                type="button"
                className="app-install-btn"
                onClick={() => {
                  setPushLoading(true);
                  void syncDevicePush()
                    .catch((error) => {
                      showToast(
                        error instanceof Error
                          ? error.message
                          : 'Não foi possível sincronizar o dispositivo.',
                        'error',
                      );
                    })
                    .finally(() => setPushLoading(false));
                }}
                disabled={pushLoading}
              >
                {pushLoading
                  ? 'Sincronizando...'
                  : deviceRegistered
                    ? 'Sincronizar dispositivo'
                    : 'Registrar este dispositivo'}
              </button>
            )}

            {permission === 'granted' && prefs && (
              <div className="app-install-toggles">
                {!external && !campoMerch && (
                  <label className="app-install-toggle">
                    <span className="app-install-toggle-label">Lançamento de vendas</span>
                    <input
                      type="checkbox"
                      checked={prefs.notify_venda}
                      onChange={(event) =>
                        void handleToggle('notify_venda', event.target.checked)
                      }
                    />
                  </label>
                )}

                {!campoMerch && (
                  <label className="app-install-toggle">
                    <span className="app-install-toggle-label">Kanban Sucesso do Cliente</span>
                    <input
                      type="checkbox"
                      checked={prefs.notify_kanban_pedido}
                      onChange={(event) =>
                        void handleToggle('notify_kanban_pedido', event.target.checked)
                      }
                    />
                  </label>
                )}

                {!external && !campoMerch && (
                  <label className="app-install-toggle">
                    <span className="app-install-toggle-label">Kanban Financeiro</span>
                    <input
                      type="checkbox"
                      checked={prefs.notify_kanban_financeiro}
                      onChange={(event) =>
                        void handleToggle('notify_kanban_financeiro', event.target.checked)
                      }
                    />
                  </label>
                )}

                {!external && (
                  <label className="app-install-toggle">
                    <span className="app-install-toggle-label">
                      {campoMerch
                        ? 'Avisos (pagamento, feriado e folha)'
                        : 'Avisos da equipe'}
                    </span>
                    <input
                      type="checkbox"
                      checked={prefs.notify_aviso}
                      onChange={(event) =>
                        void handleToggle('notify_aviso', event.target.checked)
                      }
                    />
                  </label>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
