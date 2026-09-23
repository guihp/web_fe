/**
 * Links de recovery do Supabase Auth às vezes caem na Site URL (/)
 * em vez de /redefinir-senha. Sem sessão do app, o ProtectedRoute
 * manda para /login e o hash/code se perde.
 *
 * Importar como side-effect no topo de main.tsx (primeiro import).
 * Espelhado também em index.html para rodar antes do bundle.
 */
export function redirectAuthRecoveryIfNeeded() {
  if (typeof window === 'undefined') return;

  const { pathname, search, hash } = window.location;
  if (pathname.startsWith('/redefinir-senha')) return;

  const onAuthLanding = pathname === '/' || pathname === '/login' || pathname === '';
  if (!onAuthLanding) return;

  const query = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const type = query.get('type') ?? hashParams.get('type');
  const hasRecoveryType = type === 'recovery';
  const hasAuthPayload =
    hashParams.has('access_token') ||
    query.has('access_token') ||
    query.has('code') ||
    hashParams.has('refresh_token');

  // Este app só usa Auth para reset de senha — qualquer callback Auth na
  // landing deve ir para a página de redefinição.
  if (hasRecoveryType || hasAuthPayload) {
    window.location.replace(`/redefinir-senha${search}${hash}`);
  }
}

redirectAuthRecoveryIfNeeded();
