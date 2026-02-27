import { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPPORTED_LANGUAGES, TranslationKey, translate } from '../i18n';
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
      setVoiceLog(translate(lang, 'voiceUnavailableShort'));
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
      setVoiceLog(translate(lang, 'voiceRecognitionUnsupported'));
      return;
    }

    const recognition = new speechApi();
    recognitionRef.current = recognition;
    recognition.lang = SUPPORTED_LANGUAGES[lang].speechLocale;
    recognition.interimResults = false;
    recognition.continuous = false;

    setIsVoiceActive(true);
    setVoiceLog(translate(lang, 'listening'));

    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || '';

      if (!transcript) {
        setVoiceLog(translate(lang, 'voiceNotUnderstood'));
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
      setVoiceLog(translate(lang, 'voiceCaptureFailed'));
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
