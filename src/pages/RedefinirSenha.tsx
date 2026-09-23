import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { syncPasswordAfterReset } from '../services/passwordResetService';
import './RedefinirSenha.css';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) {
        setReady(true);
        setChecking(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        markReady();
      }
    });

    void (async () => {
      // PKCE: ?code=...  |  Implicit: #access_token=...&type=recovery
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error('exchangeCodeForSession', exchangeError.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setReady(true);
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updError } = await supabase.auth.updateUser({ password });
      if (updError) {
        throw new Error(updError.message);
      }

      await syncPasswordAfterReset(password);
      await supabase.auth.signOut();

      showToast('Senha atualizada. Entre com a nova senha.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a senha.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-card">
        <img src="/feisotipo.png" alt="Fé Merchandising" className="reset-logo" />
        <h1>Redefinir senha</h1>
        <p className="reset-subtitle">
          Defina uma nova senha para acessar o App Fé com seu CPF, indústria ou CNPJ.
        </p>

        {checking ? (
          <p className="reset-status">Validando link de recuperação…</p>
        ) : !ready ? (
          <div className="reset-status-block">
            <p className="reset-status reset-status--error">
              Link inválido ou expirado. Solicite um novo em “Esqueci minha senha” na tela de login.
            </p>
            <Link className="reset-link" to="/login">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form className="reset-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="reset-field">
              <span>Nova senha</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <label className="reset-field">
              <span>Confirmar senha</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <label className="reset-remember">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Mostrar senhas
            </label>

            {error && <p className="reset-error">{error}</p>}

            <button type="submit" className="reset-submit" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            <Link className="reset-link" to="/login">
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
