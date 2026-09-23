import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashPassword(password: string): Promise<string> {
  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const data = new TextEncoder().encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${salt}$${hash}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Serviço indisponível.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Não autorizado.' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const password = String(body.password ?? '');
    if (password.length < 6) {
      return json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.email) {
      return json({ error: 'Sessão de recuperação inválida ou expirada.' }, 401);
    }

    const email = userData.user.email.toLowerCase();
    const metaId = Number(userData.user.user_metadata?.app_usuario_id ?? 0);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let query = admin.from('usuarios').select('id, email').ilike('email', email);
    const { data: byEmail, error: emailErr } = await query.maybeSingle();
    if (emailErr) {
      return json({ error: emailErr.message }, 500);
    }

    let usuarioId = byEmail?.id ? Number(byEmail.id) : null;
    if (!usuarioId && metaId > 0) {
      usuarioId = metaId;
    }
    if (!usuarioId) {
      return json({ error: 'Usuário do app não encontrado para este e-mail.' }, 404);
    }

    const hashed = await hashPassword(password);
    const { error: updErr } = await admin
      .from('usuarios')
      .update({ senha: hashed })
      .eq('id', usuarioId);

    if (updErr) {
      return json({ error: updErr.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Falha ao sincronizar senha.' }, 500);
  }
});
