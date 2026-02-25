import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

interface PantryItemInput {
  name: string;
  currentQuantity: number;
}

const DAILY_LIMIT = 30;
const FEATURE = 'ai-suggestions';

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
    const { pantry, lang = 'pt' } = await request.json() as { pantry: PantryItemInput[]; lang?: 'pt' | 'en' };

    const requestChars = JSON.stringify({ pantry, lang }).length;
    const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();

    const { count, error: usageCountError } = await usageClient
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature', FEATURE)
      .gte('created_at', last24Hours);

    if (usageCountError) {
      console.error('Failed to count usage:', usageCountError);
      return jsonResponse({ error: 'Failed to validate usage limits' }, 500);
    }

    if ((count ?? 0) >= DAILY_LIMIT) {
      return jsonResponse({
        error: 'Daily AI request limit reached. Please try again in 24 hours.',
        limit: DAILY_LIMIT,
      }, 429);
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const productsList = (pantry || [])
      .map((p) => `${p.name} (${p.currentQuantity})`)
      .join(', ');

    const localizedPrompt = lang === 'en'
      ? `Based on my pantry items: ${productsList}. Suggest 3 quick recipes or stock optimization tips. Respond in friendly English and use Markdown.`
      : `Com base nos itens que tenho na minha despensa: ${productsList}. Sugira 3 receitas rápidas que eu possa fazer ou me dê dicas de organização/otimização de estoque. Responda em Português do Brasil com linguagem amigável e use Markdown.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: localizedPrompt,
      config: { temperature: 0.7 },
    });

    const text = aiResponse.text || '';

    const { error: usageInsertError } = await usageClient.from('ai_usage').insert({
      user_id: userId,
      feature: FEATURE,
      request_chars: requestChars,
      response_chars: text.length,
    });

    if (usageInsertError) {
      console.error('Failed to log ai usage:', usageInsertError);
    }

    return jsonResponse({ text }, 200);
  } catch (error) {
    console.error('ai-suggestions error:', error);
    return jsonResponse({ error: 'Failed to generate suggestions' }, 500);
  }
});
