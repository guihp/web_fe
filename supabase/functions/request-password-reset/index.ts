import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type LoginTipo = 'interno' | 'industria' | 'cliente';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '');
}

function toIndustriaPadrao(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function isAllowedRedirect(redirectTo: string, siteOrigin: string) {
  try {
    const url = new URL(redirectTo);
    const allowed = new Set([
      siteOrigin,
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'https://localhost:5174',
    ]);
    if (allowed.has(url.origin)) {
      return url.pathname.startsWith('/redefinir-senha');
    }
    // Produção Coolify: qualquer https com path /redefinir-senha
    return url.protocol === 'https:' && url.pathname.startsWith('/redefinir-senha');
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: true, message: 'Método não permitido.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: true, message: 'Serviço indisponível.' }, 200);
    }

    const body = (await req.json().catch(() => ({}))) as {
      tipo?: LoginTipo;
      identifier?: string;
      redirectTo?: string;
    };

    const tipo = body.tipo ?? 'interno';
    const identifier = String(body.identifier ?? '').trim();
    const redirectTo = String(body.redirectTo ?? '').trim();
    const siteOrigin = new URL(supabaseUrl).origin.includes('supabase')
      ? new URL(redirectTo || 'http://localhost:5174').origin
      : 'http://localhost:5174';

    // Resposta sempre genérica (não vaza se o usuário existe).
    const genericOk = () =>
      json({
        ok: true,
        message:
          'Se houver e-mail cadastrado para este acesso, enviamos um link para redefinir a senha.',
      });

    if (!identifier) {
      return genericOk();
    }

    const safeRedirect =
      redirectTo && isAllowedRedirect(redirectTo, siteOrigin)
        ? redirectTo
        : `${new URL(redirectTo || 'http://localhost:5174/redefinir-senha').origin}/redefinir-senha`;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let email: string | null = null;
    let usuarioId: number | null = null;

    if (tipo === 'interno') {
      const cpf = normalizeCpf(identifier);
      if (cpf.length !== 11) return genericOk();
      const { data } = await admin
        .from('usuarios')
        .select('id, email, status, tipo_usuario')
        .eq('cpf', cpf)
        .maybeSingle();
      if (data && data.status !== false) {
        const t = String(data.tipo_usuario ?? 'interno');
        if (t === 'interno' || !data.tipo_usuario) {
          email = (data.email as string | null)?.trim() || null;
          usuarioId = Number(data.id);
        }
      }
    } else if (tipo === 'industria') {
      const nome = toIndustriaPadrao(identifier);
      if (!nome) return genericOk();
      const { data: industrias } = await admin.from('industrias').select('id, "Nome", status');
      const industria = (industrias ?? []).find(
        (row) => toIndustriaPadrao(String((row as { Nome?: string }).Nome ?? '')) === nome,
      ) as { id: number; status?: string | null } | undefined;
      if (industria) {
        const status = (industria.status ?? 'Ativo').trim().toLowerCase();
        if (!status || status === 'ativo') {
          const { data } = await admin
            .from('usuarios')
            .select('id, email, status')
            .eq('tipo_usuario', 'industria')
            .eq('industria_id', industria.id)
            .maybeSingle();
          if (data && data.status !== false) {
            email = (data.email as string | null)?.trim() || null;
            usuarioId = Number(data.id);
          }
        }
      }
    } else if (tipo === 'cliente') {
      const cnpj = normalizeCnpj(identifier);
      if (cnpj.length !== 14) return genericOk();
      const { data } = await admin
        .from('usuarios')
        .select('id, email, status')
        .eq('tipo_usuario', 'cliente')
        .eq('login_cnpj', cnpj)
        .maybeSingle();
      if (data && data.status !== false) {
        email = (data.email as string | null)?.trim() || null;
        usuarioId = Number(data.id);
      }
    }

    if (!email || !email.includes('@') || !usuarioId) {
      return genericOk();
    }

    const emailNorm = email.toLowerCase();

    // Garante usuário em auth.users para o recovery do Supabase Auth.
    const { error: createError } = await admin.auth.admin.createUser({
      email: emailNorm,
      email_confirm: true,
      password: `${crypto.randomUUID()}Aa1!`,
      user_metadata: { app_usuario_id: usuarioId },
    });
    if (
      createError &&
      !/already|registered|exists/i.test(createError.message ?? '')
    ) {
      console.error('createUser', createError.message);
      return genericOk();
    }

    // Dispara e-mail oficial de recovery (GoTrue /recover).
    const apikey = anonKey || serviceKey;
    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey,
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        email: emailNorm,
        redirect_to: safeRedirect,
      }),
    });

    if (!recoverRes.ok) {
      const text = await recoverRes.text().catch(() => '');
      console.error('recover failed', recoverRes.status, text.slice(0, 300));
    }

    return genericOk();
  } catch (err) {
    console.error(err);
    return json({
      ok: true,
      message:
        'Se houver e-mail cadastrado para este acesso, enviamos um link para redefinir a senha.',
    });
  }
});
