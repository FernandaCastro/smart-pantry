import { GoogleGenAI } from '@google/genai';
import { Product, Language } from '../types';

export const API_KEY = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const edgeFunctionBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';

const ai = new GoogleGenAI({ apiKey: API_KEY || 'temporary-placeholder' });

const getLocalizedFallbackMessage = (lang: Language) => (
  lang === 'en'
    ? 'AI assistant setup pending (missing VITE_API_KEY).'
    : 'Configuração de IA pendente (VITE_API_KEY ausente).'
);

export const getSmartSuggestions = async (pantry: Product[], lang: Language = 'pt') => {
  if (edgeFunctionBase) {
    try {
      const response = await fetch(`${edgeFunctionBase}/ai-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pantry, lang }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.text) return data.text as string;
      }
    } catch (error) {
      console.warn('Edge function fallback to client Gemini:', error);
    }
  }

  if (!API_KEY) return getLocalizedFallbackMessage(lang);

  try {
    const productsList = pantry
      .map(p => `${p.name} (${p.currentQuantity} ${p.unit})`)
      .join(', ');

    const localizedPrompt = lang === 'en'
      ? `Based on my pantry items: ${productsList}. Suggest 3 quick recipes or stock optimization tips. Respond in friendly English and use Markdown.`
      : `Com base nos itens que tenho na minha despensa: ${productsList}. Sugira 3 receitas rápidas que eu possa fazer ou me dê dicas de organização/otimização de estoque. Responda em Português do Brasil com uma linguagem amigável e use Markdown para formatação.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: localizedPrompt,
      config: { temperature: 0.7 },
    });

    return response.text || (lang === 'en' ? 'Unable to generate suggestions right now.' : 'Não foi possível gerar sugestões no momento.');
  } catch (error) {
    console.error('Error calling Gemini:', error);
    return lang === 'en' ? 'Failed to connect to the AI assistant.' : 'Erro ao conectar com o assistente inteligente.';
  }
};

export const categorizeProduct = async (productName: string) => {
  if (!API_KEY) return 'Outros';
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Categorize o produto "${productName}" em uma destas categorias: Cereais & Grãos, Frutas e Legumes, Enlatados, Carnes e Peixes, Padaria, Culinária e Confeitaria, Doces e Salgados, Laticínios, Limpeza, Higiene, Bebidas, Congelados ou Outros. Responda apenas o nome da categoria.`,
    });
    return response.text?.trim() || 'Outros';
  } catch (error) {
    return 'Outros';
  }
};
