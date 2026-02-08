import { GoogleGenAI } from 'npm:@google/genai';

interface PantryItemInput {
  name: string;
  currentQuantity: number;
  unit: string;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }), { status: 500 });
  }

  try {
    const { pantry, lang = 'pt' } = await request.json() as { pantry: PantryItemInput[]; lang?: 'pt' | 'en' };
    const ai = new GoogleGenAI({ apiKey });

    const productsList = (pantry || [])
      .map((p) => `${p.name} (${p.currentQuantity} ${p.unit})`)
      .join(', ');

    const localizedPrompt = lang === 'en'
      ? `Based on my pantry items: ${productsList}. Suggest 3 quick recipes or stock optimization tips. Respond in friendly English and use Markdown.`
      : `Com base nos itens que tenho na minha despensa: ${productsList}. Sugira 3 receitas rápidas que eu possa fazer ou me dê dicas de organização/otimização de estoque. Responda em Português do Brasil com linguagem amigável e use Markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: localizedPrompt,
      config: { temperature: 0.7 },
    });

    return new Response(JSON.stringify({ text: response.text || '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ai-suggestions error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate suggestions' }), { status: 500 });
  }
});
