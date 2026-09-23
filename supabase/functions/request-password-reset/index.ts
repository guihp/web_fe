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

function isLocalRedirect(redirectTo: string) {
  try {
    const url = new URL(redirectTo);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isAllowedRedirect(redirectTo: string) {
  try {
    const url = new URL(redirectTo);
    if (!url.pathname.startsWith('/redefinir-senha')) return false;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.protocol === 'http:' || url.protocol === 'https:';
    }
    return url.protocol === 'https:';
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

    const genericMessage =
      'Se houver e-mail cadastrado para este acesso, enviamos um link para redefinir a senha.';

    const genericOk = (extra: Record<string, unknown> = {}) =>
      json({ ok: true, message: genericMessage, ...extra });

    if (!identifier) {
      return genericOk();
    }

    const safeRedirect =
      redirectTo && isAllowedRedirect(redirectTo)
        ? redirectTo
        : 'http://localhost:5174/redefinir-senha';

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

    // Garante auth.users + metadata apontando para o id correto de `usuarios`
    // (mesmo e-mail pode existir em várias linhas — o sync usa app_usuario_id).
    const { error: createError } = await admin.auth.admin.createUser({
      email: emailNorm,
      email_confirm: true,
      password: `${crypto.randomUUID()}Aa1!`,
      user_metadata: { app_usuario_id: usuarioId },
    });

    if (createError && /already|registered|exists/i.test(createError.message ?? '')) {
      let authUserId: string | null = null;
      for (let page = 1; page <= 5 && !authUserId; page++) {
        const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listErr) {
          console.error('listUsers', listErr.message);
          break;
        }
        const found = (listed?.users ?? []).find(
          (u) => (u.email ?? '').toLowerCase() === emailNorm,
        );
        if (found?.id) authUserId = found.id;
        if ((listed?.users?.length ?? 0) < 200) break;
      }
      if (authUserId) {
        const { error: metaErr } = await admin.auth.admin.updateUserById(authUserId, {
          user_metadata: { app_usuario_id: usuarioId },
        });
        if (metaErr) console.error('updateUserById metadata', metaErr.message);
      }
    } else if (createError) {
      console.error('createUser', createError.message);
      return genericOk();
    }

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

    if (recoverRes.ok) {
      return genericOk();
    }

    const text = await recoverRes.text().catch(() => '');
    console.error('recover failed', recoverRes.status, text.slice(0, 300));

    if (recoverRes.status === 429 && isLocalRedirect(safeRedirect)) {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: emailNorm,
        options: { redirectTo: safeRedirect },
      });
      if (linkError) {
        console.error('generateLink', linkError.message);
      }
      const actionLink = linkData?.properties?.action_link ?? null;
      if (actionLink) {
        return json({
          ok: true,
          message:
            'Limite de e-mails do Supabase atingido. Em localhost, abrimos o link gerado para você testar.',
          recoveryLink: actionLink,
          rateLimited: true,
        });
      }
    }

    if (recoverRes.status === 429) {
      return json({
        ok: true,
        message:
          'Muitas solicitações em pouco tempo. Aguarde alguns minutos e tente de novo (e confira o spam).',
        rateLimited: true,
      });
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
