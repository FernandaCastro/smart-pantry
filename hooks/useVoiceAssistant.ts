import { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TranslationKey } from '../i18n';
import { Language, User } from '../types';
import { askVoiceAssistant } from '../services/voiceAssistant';

interface UseVoiceAssistantParams {
  currentUser: User | null;
  isConfigured: boolean;
  supabase: SupabaseClient;
  loadPantryData: (pantryId: string) => Promise<void>;
  t: (key: TranslationKey) => string;
  lang: Language;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function useVoiceAssistant({ currentUser, isConfigured, loadPantryData, lang }: UseVoiceAssistantParams) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLog, setVoiceLog] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stopVoiceSession = useCallback((options: { clearLog?: boolean } = {}) => {
    recognitionRef.current?.stop();
    setIsVoiceActive(false);

    if (options.clearLog) {
      setVoiceLog('');
    }
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (!isConfigured || !currentUser) {
      setIsVoiceActive(true);
      setVoiceLog(lang === 'en' ? 'Voice assistant is unavailable.' : 'Assistente de voz indisponível.');
      return;
    }

    const speechApi = (window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition || (window as Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).webkitSpeechRecognition;

    if (!speechApi) {
      setIsVoiceActive(true);
      setVoiceLog(
        lang === 'en'
          ? 'Voice recognition is not supported in this browser.'
          : 'Reconhecimento de voz não é suportado neste navegador.',
      );
      return;
    }

    const recognition = new speechApi();
    recognitionRef.current = recognition;
    recognition.lang = lang === 'en' ? 'en-US' : 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;

    setIsVoiceActive(true);
    setVoiceLog(lang === 'en' ? 'Listening...' : 'Ouvindo...');

    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || '';

      if (!transcript) {
        setVoiceLog(
          lang === 'en'
            ? 'I could not understand. Please try again.'
            : 'Não consegui entender. Tente novamente.',
        );
        return;
      }

      setVoiceLog(transcript);
      const result = await askVoiceAssistant(transcript, lang);
      setVoiceLog(result.text);

      if (result.actionApplied && currentUser?.pantryId) {
        await loadPantryData(currentUser.pantryId);
      }
    };

    recognition.onerror = () => {
      setVoiceLog(
        lang === 'en'
          ? 'Could not capture audio. Please try again.'
          : 'Não foi possível capturar o áudio. Tente novamente.',
      );
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognition.start();
  }, [currentUser, isConfigured, lang, loadPantryData]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  return {
    isVoiceActive,
    voiceLog,
    setVoiceLog,
    startVoiceSession,
    stopVoiceSession,
  };
}
