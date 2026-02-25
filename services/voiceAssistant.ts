import { Language } from '../types';
import { supabase } from './supabase';

export interface VoiceAssistantResult {
  text: string;
  actionApplied: boolean;
}

const getUnavailableMessage = (lang: Language) => (
  lang === 'en'
    ? 'Voice assistant is unavailable. Please try again later.'
    : 'Assistente de voz indisponível. Tente novamente mais tarde.'
);

export const askVoiceAssistant = async (
  transcript: string,
  lang: Language = 'pt',
): Promise<VoiceAssistantResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('voice-assistant', {
      body: {
        transcript,
        lang,
      },
    });

    if (error) {
      console.error('Error invoking voice-assistant:', error);
      return { text: getUnavailableMessage(lang), actionApplied: false };
    }

    if (data?.text) {
      return {
        text: data.text as string,
        actionApplied: Boolean(data.action_applied),
      };
    }

    return { text: getUnavailableMessage(lang), actionApplied: false };
  } catch (error) {
    console.error('Unexpected voice-assistant error:', error);
    return { text: getUnavailableMessage(lang), actionApplied: false };
  }
};
