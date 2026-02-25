import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

interface PantryItemInput {
  name: string;
  currentQuantity: number;
}

const DAILY_TOKEN_LIMIT = 12000;
const FEATURE = 'voice-assistant';
const MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
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
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  const authorization = request.headers.get('Authorization') || '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Supabase environment is not configured' }, 500);
  }

  if (!authorization) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (!geminiApiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY is not configured' }, 500);
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
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = authData.user.id;
    const { transcript, pantry = [], lang = 'pt' } = await request.json() as {
      transcript?: string;
      pantry?: PantryItemInput[];
      lang?: 'pt' | 'en';
    };

    if (!transcript || !transcript.trim()) {
      return jsonResponse({
        error: lang === 'en' ? 'Voice transcript is empty' : 'Transcrição de voz vazia',
      }, 400);
    }

    const requestChars = JSON.stringify({ transcript, pantry, lang }).length;
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
      return jsonResponse({ error: 'Failed to validate usage limits' }, 500);
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
      return jsonResponse({
        error: 'Daily AI token limit reached. Please try again in 24 hours.',
        limit: DAILY_TOKEN_LIMIT,
        remaining_tokens: Math.max(0, remainingBeforeCall),
      }, 429);
    }

    const pantryContext = pantry.map((p) => `${p.name} (${p.currentQuantity})`).join(', ');

    const localizedPrompt = lang === 'en'
      ? `You are a voice assistant for pantry management. User said: "${transcript}". Pantry items: ${pantryContext || 'no pantry items'}. Provide a short, direct response in friendly English with practical next action.`
      : `Você é um assistente de voz para gestão de despensa. Usuário disse: "${transcript}". Itens da despensa: ${pantryContext || 'sem itens na despensa'}. Responda de forma curta, direta e amigável em português, com próxima ação prática.`;

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const aiResponse = await ai.models.generateContent({
      model: MODEL,
      contents: localizedPrompt,
      config: { temperature: 0.4 },
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

    return jsonResponse({ text }, 200);
  } catch (error) {
    console.error('voice-assistant error:', error);
    return jsonResponse({ error: 'Failed to process voice request' }, 500);
  }
});
