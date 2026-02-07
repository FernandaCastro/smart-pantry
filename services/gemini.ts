
import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";

// Função auxiliar para obter a chave de forma segura
const getApiKey = () => {
  try {
    return typeof process !== 'undefined' ? process.env.API_KEY : undefined;
  } catch {
    return undefined;
  }
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey: apiKey || 'temporary-placeholder' });

export const getSmartSuggestions = async (pantry: Product[]) => {
  if (!apiKey) return "Configuração de IA pendente (API_KEY ausente).";
  
  try {
    const productsList = pantry
      .map(p => `${p.name} (${p.currentQuantity} ${p.unit})`)
      .join(", ");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base nos itens que tenho na minha despensa: ${productsList}.
                 Sugira 3 receitas rápidas que eu possa fazer ou me dê dicas de organização/otimização de estoque.
                 Responda em Português do Brasil com uma linguagem amigável e use Markdown para formatação.`,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "Não foi possível gerar sugestões no momento.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Erro ao conectar com o assistente inteligente.";
  }
};

export const categorizeProduct = async (productName: string) => {
  if (!apiKey) return "Outros";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Categorize o produto "${productName}" em uma destas categorias: Cereais & Grãos, Laticínios, Limpeza, Higiene, Bebidas, Congelados ou Outros. Responda apenas o nome da categoria.`,
    });
    return response.text?.trim() || "Outros";
  } catch (error) {
    return "Outros";
  }
};
