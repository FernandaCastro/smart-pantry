import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

interface PantryItemInput {
  name: string;
  currentQuantity: number;
}

const DAILY_TOKEN_LIMIT = 12000;
const FEATURE = 'ai-suggestions';
const MODEL = 'gemini-2.5-flash';
const MAX_PANTRY_ITEMS = 150;
const MAX_ITEM_NAME_LENGTH = 120;
const MAX_REQUEST_CHARS = 12000;

const getResponseLanguageLabel = (lang: 'pt' | 'en') => (lang === 'pt' ? 'Portuguese (pt-BR)' : 'English (en-US)');

const ALLOWED_ORIGINS = new Set(
  String(Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

const buildCorsHeaders = (request: Request) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };

  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

const isOriginAllowed = (request: Request) => {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin);
};

const jsonResponse = (request: Request, body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(request),
    },
  });


const extractTokenUsage = (usageMetadata: Record<string, unknown> | null | undefined) => {
  const requestTokens = Number(
    usageMetadata?.promptTokenCount ??
    usageMetadata?.inputTokenCount ??
    0,
  );

  const responseTokens = Number(
    usageMetadata?.candidatesTokenCount ??
    usageMetadata?.outputTokenCount ??
    0,
  );

  const totalFromProvider = Number(usageMetadata?.totalTokenCount ?? 0);
  const totalTokens = totalFromProvider > 0
    ? totalFromProvider
    : requestTokens + responseTokens;

  return {
    requestTokens: Number.isFinite(requestTokens) ? requestTokens : 0,
    responseTokens: Number.isFinite(responseTokens) ? responseTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
};

const estimateTokensFromChars = (requestChars: number, responseChars = 0) => {
  const safeChars = Math.max(0, requestChars) + Math.max(0, responseChars);
  return Math.max(1, Math.ceil(safeChars / 4));
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    if (!isOriginAllowed(request)) {
      return jsonResponse(request, { error: 'Origin not allowed' }, 403);
    }
    return new Response('ok', { headers: buildCorsHeaders(request) });
  }

  if (!isOriginAllowed(request)) {
    return jsonResponse(request, { error: 'Origin not allowed' }, 403);
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  const authorization = request.headers.get('Authorization') || '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Supabase environment is not configured' }, 500);
  }

  if (!authorization) {
    return jsonResponse(request, { error: 'Unauthorized' }, 401);
  }

  if (!geminiApiKey) {
    return jsonResponse(request, { error: 'GEMINI_API_KEY is not configured' }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const usageClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(request, { error: 'Unauthorized' }, 401);
    }

    const userId = authData.user.id;
    const payload = await request.json() as { pantry?: PantryItemInput[]; lang?: 'pt' | 'en' };
    const pantry = Array.isArray(payload.pantry) ? payload.pantry : null;
    const lang = payload.lang === 'en' ? 'en' : 'pt';

    if (!pantry) {
      return jsonResponse(request, { error: 'Invalid payload: pantry must be an array' }, 400);
    }

    if (pantry.length === 0) {
      return jsonResponse(request, { error: 'Invalid payload: pantry is empty' }, 400);
    }

    if (pantry.length > MAX_PANTRY_ITEMS) {
      return jsonResponse(request, {
        error: 'Payload too large: too many pantry items',
        max_items: MAX_PANTRY_ITEMS,
      }, 413);
    }

    const hasInvalidItem = pantry.some((item) => {
      if (!item || typeof item !== 'object') return true;
      const name = String(item.name || '').trim();
      const quantity = Number(item.currentQuantity);
      return !name
        || name.length > MAX_ITEM_NAME_LENGTH
        || !Number.isFinite(quantity)
        || quantity < 0;
    });

    if (hasInvalidItem) {
      return jsonResponse(request, {
        error: 'Invalid payload: each item must have name and non-negative currentQuantity',
        max_item_name_length: MAX_ITEM_NAME_LENGTH,
      }, 400);
    }

    const productsList = pantry.map(p => `${String(p.name).trim()}:${Number(p.currentQuantity)}`).join(',');
    const requestChars = JSON.stringify({ p: productsList, l: lang }).length;

    if (requestChars > MAX_REQUEST_CHARS) {
      return jsonResponse(request, {
        error: 'Payload too large: request exceeds allowed size',
        max_request_chars: MAX_REQUEST_CHARS,
      }, 413);
    }

    const estimatedRequestTokens = estimateTokensFromChars(requestChars);
    const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();

    const { data: usageRows, error: usageReadError } = await usageClient
      .from('ai_usage')
      .select('total_tokens,request_chars,response_chars')
      .eq('user_id', userId)
      .eq('feature', FEATURE)
      .gte('created_at', last24Hours);

    if (usageReadError) {
      console.error('Failed to read usage:', usageReadError);
      return jsonResponse(request, { error: 'Failed to validate usage limits' }, 500);
    }

    const consumedTokens = (usageRows || []).reduce((sum, row) => {
      const persistedTotal = Number(row.total_tokens || 0);
      if (Number.isFinite(persistedTotal) && persistedTotal > 0) {
        return sum + persistedTotal;
      }

      return sum + estimateTokensFromChars(Number(row.request_chars || 0), Number(row.response_chars || 0));
    }, 0);

    const remainingBeforeCall = DAILY_TOKEN_LIMIT - consumedTokens;
    if (remainingBeforeCall <= 0 || remainingBeforeCall < estimatedRequestTokens) {
      return jsonResponse(request, {
        error: 'Daily AI token limit reached. Please try again in 24 hours.',
        limit: DAILY_TOKEN_LIMIT,
        remaining_tokens: Math.max(0, remainingBeforeCall),
      }, 429);
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const responseLanguage = getResponseLanguageLabel(lang);

    const aiResponse = await ai.models.generateContent({
      model: MODEL,
      contents: `Items: ${productsList}`,
      config: {
        systemInstruction: `Pantry assistant. Suggest 3 quick recipes/tips based on items. Concise, friendly, Markdown.
- Write the answer in ${responseLanguage}.
- Keep any item names exactly as provided by the user/input.`,
        temperature: 0.7,
      },
    });

    const text = aiResponse.text || '';
    const usageMetadata = aiResponse.usageMetadata as Record<string, unknown> | undefined;
    const tokenUsage = extractTokenUsage(usageMetadata);
    const fallbackTotalTokens = estimateTokensFromChars(requestChars, text.length);

    const { error: usageInsertError } = await usageClient.from('ai_usage').insert({
      user_id: userId,
      feature: FEATURE,
      request_chars: requestChars,
      response_chars: text.length,
      request_tokens: tokenUsage.requestTokens,
      response_tokens: tokenUsage.responseTokens,
      total_tokens: tokenUsage.totalTokens > 0 ? tokenUsage.totalTokens : fallbackTotalTokens,
      provider: 'gemini',
      model: MODEL,
    });

    if (usageInsertError) {
      console.error('Failed to log ai usage:', usageInsertError);
    }

    return jsonResponse(request, { text }, 200);
  } catch (error) {
    console.error('ai-suggestions error:', error);
    return jsonResponse(request, { error: 'Failed to generate suggestions' }, 500);
  }
});
