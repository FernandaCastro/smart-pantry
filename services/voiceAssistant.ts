import { Language } from '../types';
import { supabase } from './supabase';


const getUnavailableMessage = (lang: Language) => (
  lang === 'en'
    ? 'Voice assistant is unavailable. Please try again later.'
    : 'Assistente de voz indisponível. Tente novamente mais tarde.'
);

export const askVoiceAssistant = async (
  transcript: string,
  lang: Language = 'pt',
) => {
  try {
    const { data, error } = await supabase.functions.invoke('voice-assistant', {
      body: {
        transcript,
        lang,
      },
    });

    if (error) {
      console.error('Error invoking voice-assistant:', error);
      return getUnavailableMessage(lang);
    }

    if (data?.text) {
      return data.text as string;
    }

    return getUnavailableMessage(lang);
  } catch (error) {
    console.error('Unexpected voice-assistant error:', error);
    return getUnavailableMessage(lang);
  }
};
