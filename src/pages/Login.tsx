import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { maskCpfInput } from '../lib/cpf';
import type { LoginTipo } from '../services/authService';
import { fetchRandomVerse, getFallbackVerse, type BibleVerse } from '../services/bibleService';
import { maskCnpjInput } from '../utils/externalAccess';
import './Login.css';

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M6.7 6.7C4.6 8.2 3.2 10 2 12c0 0 3.5 7 10 7 1.8 0 3.4-.5 4.8-1.3" />
      <path d="M14.1 9.9C14.6 10.4 15 11.2 15 12c0 1.7-1.3 3-3 3-.8 0-1.6-.4-2.1-.9" />
      <path d="M9.9 4.2C10.9 4.1 11.9 4 13 4c6.5 0 10 8 10 8a18.7 18.7 0 0 1-2.2 3.6" />
    </svg>
  );
}

const LOGIN_TABS: { id: LoginTipo; label: string }[] = [
  { id: 'interno', label: 'Equipe' },
  { id: 'industria', label: 'Indústria' },
  { id: 'cliente', label: 'Cliente' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loginTipo, setLoginTipo] = useState<LoginTipo>('interno');
  const [identifier, setIdentifier] = useState('');
  const [senha, setSenha] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setVerseLoading(true);
    fetchRandomVerse()
      .then((randomVerse) => {
        if (!cancelled) setVerse(randomVerse);
      })
      .catch(() => {
        if (!cancelled) setVerse(getFallbackVerse());
      })
      .finally(() => {
        if (!cancelled) setVerseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTipoChange = (tipo: LoginTipo) => {
    setLoginTipo(tipo);
    setIdentifier('');
    setError(null);
  };

  const handleIdentifierChange = (value: string) => {
    if (loginTipo === 'interno') setIdentifier(maskCpfInput(value));
    else if (loginTipo === 'cliente') setIdentifier(maskCnpjInput(value));
    else setIdentifier(value.toUpperCase());
  };

  const identifierLabel =
    loginTipo === 'interno' ? 'CPF' : loginTipo === 'industria' ? 'Indústria' : 'CNPJ';
  const identifierPlaceholder =
    loginTipo === 'interno'
      ? '000.000.000-00'
      : loginTipo === 'industria'
        ? 'PREDILECTA'
        : '00.000.000/0000-00';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, senha, remember, loginTipo);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <img src="/feisotipo.png" alt="Fé Merchandising" className="login-logo" />

      <div className="login-shell">
        <aside className="login-visual" aria-hidden>
          <div className="login-visual-art">
            <img src="/login-equipe.png" alt="" />
          </div>
          <div className="login-visual-brand">
            <img className="login-marca-f" src="/feisotipo.png" alt="Fé Merchandising" />
          </div>
        </aside>

        <section className="login-form-area">
          <h1 className="login-heading">Login</h1>
          <p className="login-subtitle">Insira suas informações para entrar na plataforma</p>

          <div className="login-tipo-tabs" role="tablist" aria-label="Tipo de acesso">
            {LOGIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={loginTipo === tab.id}
                className={`login-tipo-tab ${loginTipo === tab.id ? 'active' : ''}`}
                onClick={() => handleTipoChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-id">{identifierLabel}</label>
              <input
                id="login-id"
                type="text"
                inputMode={loginTipo === 'industria' ? 'text' : 'numeric'}
                autoComplete="username"
                placeholder={identifierPlaceholder}
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                required
              />
            </div>

            <div className="login-field password">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-eye"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((v) => !v)}
              >
                <IconEye open={showPassword} />
              </button>
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Lembrar
              </label>
              <button
                type="button"
                className="login-forgot"
                onClick={() =>
                  showToast('Contacte o administrador para redefinir sua senha.', 'info')
                }
              >
                Esqueci minha senha
              </button>
            </div>

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Login'}
            </button>

            <div className="login-verse" aria-live="polite">
              {verseLoading ? (
                <p className="login-verse-loading">Carregando versículo...</p>
              ) : verse ? (
                <>
                  <p className="login-verse-ref">{verse.reference}</p>
                  <p className="login-verse-text">“{verse.text}”</p>
                </>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
