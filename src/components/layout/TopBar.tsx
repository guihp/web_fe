import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../icons/AppIcon';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useNotificationRealtime } from '../../hooks/useNotificationRealtime';
import {
  countUnread,
  fetchAppNotifications,
  formatNotificationTime,
  getNotificationsSeenAt,
  markNotificationsSeen,
  type AppNotification,
  type NotificationKind,
} from '../../services/notificationsService';
import {
  getProfileAvatarUrl,
  removeProfilePhoto,
  uploadProfilePhoto,
} from '../../services/profileService';
import AppInstallModal from './AppInstallModal';
import './TopBar.css';

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
    </svg>
  );
}

function kindIcon(kind: NotificationKind): AppIconName {
  if (kind === 'venda') return 'money';
  if (kind === 'kanban_pedido') return 'cart';
  if (kind === 'aviso') return 'bell';
  return 'dollar';
}

export default function TopBar() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { isDark, toggleMode } = useTheme();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const installWrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const firstName = user?.nome?.split(' ')[0] ?? 'Usuário';
  const avatarUrl = getProfileAvatarUrl(user);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const items = await fetchAppNotifications(24, {
        tipo_usuario: user?.tipo_usuario,
        industria_nome: user?.industria_nome,
        cliente_grupo: user?.cliente_grupo,
        login_cnpj: user?.login_cnpj,
      });
      setNotifications(items);
      setUnread(countUnread(items, getNotificationsSeenAt()));
    } catch {
      setNotifications([]);
      setUnread(0);
    } finally {
      setNotifLoading(false);
    }
  }, [user?.tipo_usuario, user?.industria_nome, user?.cliente_grupo, user?.login_cnpj]);

  useNotificationRealtime(() => {
    void loadNotifications();
  });

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, user?.id]);

  useEffect(() => {
    if (!notifOpen && !menuOpen && !installModalOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifOpen && notifWrapRef.current && !notifWrapRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (
        installModalOpen &&
        installWrapRef.current &&
        !installWrapRef.current.contains(target)
      ) {
        setInstallModalOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notifOpen, menuOpen, installModalOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login', { replace: true });
  };

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.id, file);
      updateUser({ foto_perfil_url: url });
      showToast('Foto de perfil atualizada.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Não foi possível atualizar a foto.',
        'error',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.foto_perfil_url) return;

    setUploadingPhoto(true);
    try {
      await removeProfilePhoto(user.id);
      updateUser({ foto_perfil_url: null });
      showToast('Foto de perfil removida.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Não foi possível remover a foto.',
        'error',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setMenuOpen(false);
    setInstallModalOpen(false);
    if (next) {
      await loadNotifications();
      markNotificationsSeen();
      setUnread(0);
    }
  };

  const openNotification = (item: AppNotification) => {
    setNotifOpen(false);
    navigate(item.href);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src="/feisotipo.png" alt="Fé Merchandising" className="topbar-logo" />
      </div>

      <div className="topbar-search">
        <span className="search-icon" aria-hidden>
          <AppIcon name="search" size={16} />
        </span>
        <input type="search" placeholder="Está procurando algo?" />
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="icon-btn theme-toggle-btn"
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          onClick={toggleMode}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>

        <div className="notif-wrap" ref={notifWrapRef}>
          <button
            type="button"
            className={`icon-btn notif-btn ${notifOpen ? 'is-open' : ''}`}
            aria-label="Notificações"
            aria-expanded={notifOpen}
            title="Notificações"
            onClick={() => void toggleNotifications()}
          >
            <AppIcon name="bell" size={18} />
            {unread > 0 && (
              <span className="notif-badge" aria-label={`${unread} não lidas`}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown card" role="dialog" aria-label="Lista de notificações">
              <header className="notif-dropdown-header">
                <strong>Notificações</strong>
                <span>Vendas, kanbans e avisos</span>
              </header>

              <div className="notif-list">
                {notifLoading && <p className="notif-empty">Carregando...</p>}
                {!notifLoading && notifications.length === 0 && (
                  <p className="notif-empty">Nenhuma notificação recente.</p>
                )}
                {!notifLoading &&
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="notif-item"
                      onClick={() => openNotification(item)}
                    >
                      <span className="notif-item-icon" aria-hidden>
                        <AppIcon name={kindIcon(item.kind)} size={16} />
                      </span>
                      <span className="notif-item-body">
                        <span className="notif-item-title">{item.title}</span>
                        <span className="notif-item-detail">{item.detail}</span>
                      </span>
                      <span className="notif-item-time">{formatNotificationTime(item.at)}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="install-wrap" ref={installWrapRef}>
          <button
            type="button"
            className={`icon-btn install-btn ${installModalOpen ? 'is-open' : ''}`}
            aria-label="Instalar app e notificações"
            title="Instalar app e notificações"
            onClick={() => {
              setInstallModalOpen(true);
              setNotifOpen(false);
              setMenuOpen(false);
            }}
          >
            <AppIcon name="download" size={18} />
          </button>

          <AppInstallModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
        </div>

        <div className="profile-menu-wrap">
          <button
            type="button"
            className="profile-btn"
            onClick={() => {
              setMenuOpen((open) => !open);
              setNotifOpen(false);
              setInstallModalOpen(false);
            }}
            aria-expanded={menuOpen}
          >
            <img src={avatarUrl} alt={user?.nome ?? 'Usuário'} className="profile-avatar" />
            <span className="profile-name">{firstName}</span>
            <span className="profile-chevron">▾</span>
          </button>

          {menuOpen && (
            <div className="profile-dropdown card">
              <div className="profile-dropdown-photo">
                <img src={avatarUrl} alt={user?.nome ?? 'Usuário'} className="profile-dropdown-avatar" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="profile-photo-input"
                  onChange={handlePhotoSelect}
                  disabled={uploadingPhoto}
                />
                <button
                  type="button"
                  className="profile-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? 'Salvando...' : 'Alterar foto'}
                </button>
                {user?.foto_perfil_url && (
                  <button
                    type="button"
                    className="profile-photo-remove"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                  >
                    Remover foto
                  </button>
                )}
              </div>

              <p className="profile-dropdown-name">{user?.nome}</p>
              <p className="profile-dropdown-role">{user?.cargo}</p>
              <button type="button" className="profile-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
