import { normalizeVoiceTranscriptToSingular } from '../voiceUtils';
import { Language } from '../types';
import { supabase } from './supabase';

export interface VoiceAssistantResult {
  text: string;
  actionApplied: boolean;
  inferredCategory: string;
  isNewProduct: boolean;
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
    const normalizedTranscript = normalizeVoiceTranscriptToSingular(transcript);

    const { data, error } = await supabase.functions.invoke('voice-assistant', {
      body: {
        transcript: normalizedTranscript || transcript,
        lang,
      },
    });

    if (error) {
      console.error('Error invoking voice-assistant:', error);
      return {
        text: getUnavailableMessage(lang),
        actionApplied: false,
        inferredCategory: 'others',
        isNewProduct: false,
      };
    }

    if (data?.text) {
      return {
        text: data.text as string,
        actionApplied: Boolean(data.action_applied),
        inferredCategory: String(data.inferred_category || 'others'),
        isNewProduct: Boolean(data.is_new_product),
      };
    }

    return {
      text: getUnavailableMessage(lang),
      actionApplied: false,
      inferredCategory: 'others',
      isNewProduct: false,
    };
  } catch (error) {
    console.error('Unexpected voice-assistant error:', error);
    return {
      text: getUnavailableMessage(lang),
      actionApplied: false,
      inferredCategory: 'others',
      isNewProduct: false,
    };
  }
};
