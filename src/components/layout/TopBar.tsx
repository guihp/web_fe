import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import {
  getProfileAvatarUrl,
  removeProfilePhoto,
  uploadProfilePhoto,
} from '../../services/profileService';
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

export default function TopBar() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { isDark, toggleMode } = useTheme();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const firstName = user?.nome?.split(' ')[0] ?? 'Usuário';
  const avatarUrl = getProfileAvatarUrl(user);

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

  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src="/feisotipo.png" alt="Fé Merchandising" className="topbar-logo" />
      </div>

      <div className="topbar-search">
        <span className="search-icon" aria-hidden>
          🔍
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
        <button type="button" className="icon-btn" aria-label="Notificações">
          🔔
        </button>
        <div className="profile-menu-wrap">
          <button
            type="button"
            className="profile-btn"
            onClick={() => setMenuOpen((open) => !open)}
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
