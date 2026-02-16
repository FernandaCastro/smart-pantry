import { SupabaseClient } from '@supabase/supabase-js';
import { MutableRefObject, useCallback, useEffect, useState } from 'react';
import { TranslationKey } from '../i18n';
import { Product, User } from '../types';

interface UseVoiceAssistantParams {
  currentUser: User | null;
  isConfigured: boolean;
  pantryRef: MutableRefObject<Product[]>;
  supabase: SupabaseClient;
  loadPantryData: (pantryId: string) => Promise<void>;
  t: (key: TranslationKey) => string;
}

export function useVoiceAssistant(_: UseVoiceAssistantParams) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLog, setVoiceLog] = useState('');

  const stopVoiceSession = useCallback((options: { clearLog?: boolean } = {}) => {
    setIsVoiceActive(false);
    if (options.clearLog) {
      setVoiceLog('');
    }
  }, []);

  const startVoiceSession = useCallback(async () => {
    setIsVoiceActive(true);
    setVoiceLog('IA indisponível. Tente novamente mais tarde.');
  }, []);

  useEffect(() => {
    return () => {
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
