import { Language, Product } from '../types';
import { DEFAULT_LANGUAGE, translate } from '../i18n';
import { supabase } from './supabase';

interface PantrySuggestionInput {
  name: string;
  currentQuantity: number;
}

const getUnavailableMessage = (lang: Language) => translate(lang, 'aiUnavailable');

export const getSmartSuggestions = async (pantry: Product[], lang: Language = DEFAULT_LANGUAGE) => {
  const minimalPantry: PantrySuggestionInput[] = pantry.map((product) => ({
    name: product.name,
    currentQuantity: product.currentQuantity,
  }));

  try {
    const { data, error } = await supabase.functions.invoke('ai-suggestions', {
      body: { pantry: minimalPantry, lang },
    });

    if (error) {
      console.error('Error invoking ai-suggestions:', error);
      return getUnavailableMessage(lang);
    }

    if (data?.text) {
      return data.text as string;
    }

    return getUnavailableMessage(lang);
  } catch (error) {
    console.error('Unexpected ai-suggestions error:', error);
    return getUnavailableMessage(lang);
  }
};
