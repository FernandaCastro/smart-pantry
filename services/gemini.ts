import { Product, Language } from '../types';
import { supabase } from './supabase';

const getUnavailableMessage = (lang: Language) => (
  lang === 'en'
    ? 'AI unavailable. Please try again later.'
    : 'IA indisponível. Tente novamente mais tarde.'
);

export const getSmartSuggestions = async (pantry: Product[], lang: Language = 'pt') => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-suggestions', {
      body: { pantry, lang },
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
