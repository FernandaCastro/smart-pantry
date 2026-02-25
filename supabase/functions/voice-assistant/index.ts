import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const DAILY_TOKEN_LIMIT = 12000;
const FEATURE = 'voice-assistant';
const MODEL = 'gemini-2.5-flash';
const ALLOWED_UNITS = new Set(['un', 'kg', 'l', 'g', 'ml', 'package', 'box']);

type VoiceIntent = 'add' | 'consume' | 'none';

interface VoiceAction {
  intent: VoiceIntent;
  product_name: string;
  quantity: number;
  unit?: string;
  message?: string;
}

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

const parseJsonFromModel = (rawText: string): VoiceAction | null => {
  if (!rawText?.trim()) return null;

  const stripped = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const maybeJson = stripped.slice(start, end + 1);

  try {
    const parsed = JSON.parse(maybeJson) as Partial<VoiceAction>;
    const intent = (parsed.intent || 'none') as VoiceIntent;
    const productName = String(parsed.product_name || '').trim();
    const quantity = Number(parsed.quantity || 0);
    const unit = String(parsed.unit || '').trim().toLowerCase();
    const message = String(parsed.message || '').trim();

    if (!['add', 'consume', 'none'].includes(intent)) return null;

    return {
      intent,
      product_name: productName,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit,
      message,
    };
  } catch {
    return null;
  }
};

const normalizeUnit = (unit: string | undefined) => {
  const normalized = String(unit || '').trim().toLowerCase();
  return ALLOWED_UNITS.has(normalized) ? normalized : 'un';
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
    const { transcript, lang = 'pt' } = await request.json() as {
      transcript?: string;
      lang?: 'pt' | 'en';
    };

    if (!transcript || !transcript.trim()) {
      return jsonResponse({
        error: lang === 'en' ? 'Voice transcript is empty' : 'Transcrição de voz vazia',
      }, 400);
    }

    const requestChars = JSON.stringify({ transcript, lang }).length;
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

    const modelPrompt = lang === 'en'
      ? `Extract inventory action from the user's speech and return JSON only with this schema: {"intent":"add|consume|none","product_name":"string","quantity":number,"unit":"un|kg|l|g|ml|package|box","message":"short english message"}. If action is unclear, use intent=none with quantity=0.`
      : `Extraia a ação de estoque da fala do usuário e responda somente JSON no formato: {"intent":"add|consume|none","product_name":"string","quantity":number,"unit":"un|kg|l|g|ml|package|box","message":"mensagem curta em português"}. Se não estiver claro, use intent=none com quantity=0.`;

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const aiResponse = await ai.models.generateContent({
      model: MODEL,
      contents: `${modelPrompt}\n\nTranscription: ${transcript}`,
      config: { temperature: 0.1 },
    });

    const text = aiResponse.text || '';
    const parsedAction = parseJsonFromModel(text);

    const { data: profile, error: profileError } = await usageClient
      .from('profiles')
      .select('pantry_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile?.pantry_id) {
      return jsonResponse({ error: 'Failed to resolve user pantry' }, 500);
    }

    let responseText = parsedAction?.message || (lang === 'en' ? 'Voice command processed.' : 'Comando de voz processado.');
    let actionApplied = false;

    if (parsedAction && parsedAction.intent !== 'none' && parsedAction.product_name) {
      const quantity = Math.max(0, Number(parsedAction.quantity || 0));
      const unit = normalizeUnit(parsedAction.unit);

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
              await usageClient
                .from('pantry_items')
                .insert([{
                  pantry_id: profile.pantry_id,
                  name: parsedAction.product_name,
                  category: 'others',
                  current_quantity: quantity,
                  min_quantity: 1,
                  unit,
                  updated_at: new Date().toISOString(),
                }]);
              responseText = lang === 'en'
                ? `${parsedAction.product_name} added.`
                : `${parsedAction.product_name} adicionado.`;
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

    return jsonResponse({ text: responseText, action_applied: actionApplied }, 200);
  } catch (error) {
    console.error('voice-assistant error:', error);
    return jsonResponse({ error: 'Failed to process voice request' }, 500);
  }
});
