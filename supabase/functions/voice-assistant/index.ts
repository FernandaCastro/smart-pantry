import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleGenAI, Type } from 'npm:@google/genai';

const DAILY_TOKEN_LIMIT = Number(Deno.env.get('AI_USER_DAILY_TOKEN_LIMIT_VOICE_ASSISTANT') || Deno.env.get('AI_USER_DAILY_TOKEN_LIMIT') || 12000);
const FEATURE = 'voice-assistant';
const MODEL = 'gemini-2.5-flash';
const MAX_TRANSCRIPT_CHARS = 1200;
const MAX_REQUEST_CHARS = 2000;
const PROJECT_KILL_SWITCH_ENABLED = String(Deno.env.get('AI_PROJECT_KILL_SWITCH') || 'false').toLowerCase() === 'true';
const PROJECT_DAILY_TOKEN_LIMIT = Number(Deno.env.get('AI_PROJECT_DAILY_TOKEN_LIMIT') || 0);
const IP_RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get('AI_IP_RATE_LIMIT_WINDOW_SECONDS') || 60);
const IP_RATE_LIMIT_MAX_REQUESTS = Number(Deno.env.get('AI_IP_RATE_LIMIT_MAX_REQUESTS') || 30);

const isValidPositiveLimit = (value: number) => Number.isFinite(value) && value > 0;

const getResponseLanguageLabel = (lang: 'pt' | 'en') => (lang === 'pt' ? 'Portuguese (pt-BR)' : 'English (en-US)');

const ALLOWED_UNITS = new Set(['un', 'kg', 'l', 'g', 'ml', 'package', 'box']);
const ALLOWED_CATEGORIES = new Set([
  'cereals_grains',
  'fruits_vegetables',
  'canned_goods',
  'meat_fish',
  'bakery',
  'cooking_baking',
  'sweets_savory_snacks',
  'dairy',
  'cleaning',
  'hygiene',
  'beverages',
  'frozen',
  'others',
]);

type VoiceIntent = 'add' | 'consume' | 'none';

interface VoiceAction {
  intent: VoiceIntent;
  product_name: string;
  quantity: number;
  unit?: string;
  category?: string;
  message?: string;
}

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

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('X-Forwarded-For') || '';
  const realIp = request.headers.get('x-real-ip') || request.headers.get('X-Real-IP') || '';
  return (forwardedFor.split(',')[0] || realIp || 'unknown').trim() || 'unknown';
};

const normalizeUnit = (unit: string | undefined) => {
  const normalized = String(unit || '').trim().toLowerCase();
  return ALLOWED_UNITS.has(normalized) ? normalized : 'un';
};

const normalizeCategory = (category: string | undefined) => {
  const normalized = String(category || '').trim().toLowerCase();
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : 'others';
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
    if (!isValidPositiveLimit(DAILY_TOKEN_LIMIT)) {
      console.error('Invalid DAILY_TOKEN_LIMIT configuration');
      return jsonResponse(request, { error: 'Invalid AI quota configuration' }, 500);
    }

    const clientIp = getClientIp(request);
    const ipRateLimitWindowStart = new Date(Date.now() - ((isValidPositiveLimit(IP_RATE_LIMIT_WINDOW_SECONDS) ? IP_RATE_LIMIT_WINDOW_SECONDS : 60) * 1000)).toISOString();

    const { count: ipRequestCount, error: ipRateLimitError } = await usageClient
      .from('ai_ip_rate_events')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .gte('created_at', ipRateLimitWindowStart);

    if (ipRateLimitError) {
      console.error('Failed to read IP rate limit usage:', ipRateLimitError);
      return jsonResponse(request, { error: 'Failed to validate rate limits' }, 500);
    }

    if ((ipRequestCount || 0) >= (isValidPositiveLimit(IP_RATE_LIMIT_MAX_REQUESTS) ? IP_RATE_LIMIT_MAX_REQUESTS : 30)) {
      return jsonResponse(request, {
        error: 'Too many requests. Please try again shortly.',
        rate_limit_window_seconds: isValidPositiveLimit(IP_RATE_LIMIT_WINDOW_SECONDS) ? IP_RATE_LIMIT_WINDOW_SECONDS : 60,
        rate_limit_max_requests: isValidPositiveLimit(IP_RATE_LIMIT_MAX_REQUESTS) ? IP_RATE_LIMIT_MAX_REQUESTS : 30,
      }, 429);
    }

    const { error: ipRateInsertError } = await usageClient
      .from('ai_ip_rate_events')
      .insert({ ip_address: clientIp, feature: FEATURE });

    if (ipRateInsertError) {
      console.error('Failed to write IP rate event:', ipRateInsertError);
      return jsonResponse(request, { error: 'Failed to validate rate limits' }, 500);
    }

    if (PROJECT_KILL_SWITCH_ENABLED) {
      return jsonResponse(request, {
        error: 'AI requests are temporarily disabled by project administrator.',
      }, 503);
    }

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(request, { error: 'Unauthorized' }, 401);
    }

    const userId = authData.user.id;
    const payload = await request.json() as {
      transcript?: string;
      lang?: 'en' | 'pt';
    };
    const transcript = String(payload.transcript || '').trim();
    const lang = payload.lang === 'en' ? 'en' : 'pt';

    if (!transcript) {
      return jsonResponse(request, {
        error: 'Voice transcript is empty',
      }, 400);
    }

    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return jsonResponse(request, {
        error: 'Payload too large: transcript exceeds allowed size',
        max_transcript_chars: MAX_TRANSCRIPT_CHARS,
      }, 413);
    }

    const requestChars = JSON.stringify({ transcript, lang }).length;
    if (requestChars > MAX_REQUEST_CHARS) {
      return jsonResponse(request, {
        error: 'Payload too large: request exceeds allowed size',
        max_request_chars: MAX_REQUEST_CHARS,
      }, 413);
    }

    const estimatedRequestTokens = estimateTokensFromChars(requestChars);
    const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();


    if (Number.isFinite(PROJECT_DAILY_TOKEN_LIMIT) && PROJECT_DAILY_TOKEN_LIMIT > 0) {
      const { data: projectUsageRows, error: projectUsageError } = await usageClient
        .from('ai_usage')
        .select('total_tokens,request_chars,response_chars')
        .gte('created_at', last24Hours);

      if (projectUsageError) {
        console.error('Failed to read project usage:', projectUsageError);
        return jsonResponse(request, { error: 'Failed to validate usage limits' }, 500);
      }

      const projectConsumedTokens = (projectUsageRows || []).reduce((sum, row) => {
        const persistedTotal = Number(row.total_tokens || 0);
        if (Number.isFinite(persistedTotal) && persistedTotal > 0) {
          return sum + persistedTotal;
        }

        return sum + estimateTokensFromChars(Number(row.request_chars || 0), Number(row.response_chars || 0));
      }, 0);

      const remainingProjectTokens = PROJECT_DAILY_TOKEN_LIMIT - projectConsumedTokens;
      if (remainingProjectTokens <= 0 || remainingProjectTokens < estimatedRequestTokens) {
        return jsonResponse(request, {
          error: 'Project AI daily budget reached. Please try again later.',
          project_daily_limit: PROJECT_DAILY_TOKEN_LIMIT,
          remaining_project_tokens: Math.max(0, remainingProjectTokens),
        }, 429);
      }
    }

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

    const responseLanguage = getResponseLanguageLabel(lang);

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const aiResponse = await ai.models.generateContent({
      model: MODEL,
      contents: `Transcript: ${transcript}`,
      config: {
        systemInstruction: `Extract inventory action. Infer category for new items. If unclear, intent=none, quantity=0, category=others.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, enum: ['add', 'consume', 'none'] },
            product_name: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING, enum: [...ALLOWED_UNITS] },
            category: { type: Type.STRING, enum: [...ALLOWED_CATEGORIES] },
            message: {
              type: Type.STRING,
              description: `Short message in ${responseLanguage}`,
            },
          },
          required: ['intent', 'product_name', 'quantity', 'unit', 'category', 'message'],
        },
        temperature: 0.1,
      },
    });

    const parsedAction = JSON.parse(aiResponse.text || '{}') as VoiceAction;

    const { data: profile, error: profileError } = await usageClient
      .from('profiles')
      .select('pantry_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile?.pantry_id) {
      return jsonResponse(request, { error: 'Failed to resolve user pantry' }, 500);
    }

    let responseText = parsedAction?.message || (lang === 'en' ? 'Voice command processed.' : 'Comando de voz processado.');
    let actionApplied = false;
    let inferredCategory = normalizeCategory(parsedAction?.category);
    let isNewProduct = false;

    if (parsedAction && parsedAction.intent !== 'none' && parsedAction.product_name) {
      const quantity = Math.max(0, Number(parsedAction.quantity || 0));
      const unit = normalizeUnit(parsedAction.unit);
      const category = normalizeCategory(parsedAction.category);

      if (quantity > 0) {
        const { data: existingItems, error: existingError } = await usageClient
          .from('pantry_items')
          .select('id,name,current_quantity,unit')
          .eq('pantry_id', profile.pantry_id)
          .ilike('name', parsedAction.product_name)
          .limit(1);

        if (!existingError) {
          const item = existingItems?.[0];

          if (parsedAction.intent === 'add') {
            if (item) {
              const newQuantity = Number(item.current_quantity || 0) + quantity;
              await usageClient
                .from('pantry_items')
                .update({ current_quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq('id', item.id);
              responseText = lang === 'en'
                ? `${item.name} updated to ${newQuantity}.`
                : `${item.name} atualizado para ${newQuantity}.`;
            } else {
              isNewProduct = true;
              inferredCategory = category;
              await usageClient
                .from('pantry_items')
                .insert([{
                  pantry_id: profile.pantry_id,
                  name: parsedAction.product_name,
                  category,
                  current_quantity: quantity,
                  min_quantity: 1,
                  unit,
                  updated_at: new Date().toISOString(),
                }]);
              responseText = lang === 'en'
                ? `${parsedAction.product_name} added.`
                : `Adicionado: ${parsedAction.product_name}.`;
            }
            actionApplied = true;
          }

          if (parsedAction.intent === 'consume') {
            if (!item) {
              responseText = lang === 'en'
                ? `I couldn't find ${parsedAction.product_name} in your pantry.`
                : `Não encontrei ${parsedAction.product_name} na sua despensa.`;
            } else {
              const currentQuantity = Number(item.current_quantity || 0);
              const newQuantity = Math.max(0, currentQuantity - quantity);
              await usageClient
                .from('pantry_items')
                .update({ current_quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq('id', item.id);
              responseText = lang === 'en'
                ? `${item.name} updated to ${newQuantity}.`
                : `${item.name} atualizado para ${newQuantity}.`;
              actionApplied = true;
            }
          }
        }
      }
    } else if (!parsedAction) {
      responseText = lang === 'en'
        ? 'I could not understand your command. Please try again.'
        : 'Não consegui entender seu comando. Tente novamente.';
    }

    const usageMetadata = aiResponse.usageMetadata as Record<string, unknown> | undefined;
    const tokenUsage = extractTokenUsage(usageMetadata);
    const fallbackTotalTokens = estimateTokensFromChars(requestChars, responseText.length);

    const { error: usageInsertError } = await usageClient.from('ai_usage').insert({
      user_id: userId,
      feature: FEATURE,
      request_chars: requestChars,
      response_chars: responseText.length,
      request_tokens: tokenUsage.requestTokens,
      response_tokens: tokenUsage.responseTokens,
      total_tokens: tokenUsage.totalTokens > 0 ? tokenUsage.totalTokens : fallbackTotalTokens,
      provider: 'gemini',
      model: MODEL,
    });

    if (usageInsertError) {
      console.error('Failed to log ai usage:', usageInsertError);
    }

    return jsonResponse(request, {
      text: responseText,
      action_applied: actionApplied,
      inferred_category: inferredCategory,
      is_new_product: isNewProduct,
    }, 200);
  } catch (error) {
    console.error('voice-assistant error:', error);
    return jsonResponse(request, { error: 'Failed to process voice request' }, 500);
  }
});
