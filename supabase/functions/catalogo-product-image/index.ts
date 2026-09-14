import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const ALLOWED_HOSTS = new Set([
  'gerenciadorpd.com.br',
  'www.gerenciadorpd.com.br',
  'valefertil.com.br',
  'cdn.awsli.com.br',
]);

function corsHeaders(req: Request, contentType = 'application/json') {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    'Content-Type': contentType,
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(req, 'application/json'),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(req, 405, { error: 'Método não permitido.' });
  }

  try {
    const source = new URL(req.url).searchParams.get('url');
    const imageUrl = new URL(source || '');

    if (imageUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(imageUrl.hostname.toLowerCase())) {
      return json(req, 400, { error: 'Endereço de imagem inválido.' });
    }

    const upstream = await fetch(imageUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: `${imageUrl.protocol}//${imageUrl.hostname}/`,
        'User-Agent': 'Mozilla/5.0 (compatible; CatalogoFe/1.0)',
      },
    });

    if (!upstream.ok) {
      return json(req, upstream.status, { error: 'Imagem indisponível na origem.' });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return json(req, 502, { error: 'A origem não retornou uma imagem.' });
    }

    const body = await upstream.arrayBuffer();
    const headers = {
      ...corsHeaders(req, contentType),
      'Content-Length': String(body.byteLength),
    };

    if (req.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch {
    return json(req, 400, { error: 'Não foi possível carregar a imagem.' });
  }
});
