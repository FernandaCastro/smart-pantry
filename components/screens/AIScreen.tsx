import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { TranslationKey } from '../../i18n';

interface AIScreenProps {
  isLoading: boolean;
  aiSuggestions: string;
  t: (key: TranslationKey) => string;
  onBack: () => void;
}

export const AIScreen: React.FC<AIScreenProps> = ({ isLoading, aiSuggestions, t, onBack }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[var(--sp-violet-600)]"><Sparkles size={24} /><h2 className="text-xl font-bold">{t('aiTitle')}</h2></div>
      <div className="bg-[var(--sp-white)] border-2 border-[var(--sp-violet-50)] p-6 rounded-[2.5rem] shadow-sm leading-relaxed text-[var(--sp-gray-700)] prose text-sm">
        {isLoading ? <Loader2 className="animate-spin text-[var(--sp-violet-500)] mx-auto" /> : <div className="whitespace-pre-wrap">{aiSuggestions || 'Nenhuma sugestão disponível.'}</div>}
      </div>
      <button onClick={onBack} className="w-full py-4 border-2 border-[var(--sp-violet-500)] text-[var(--sp-violet-500)] font-bold rounded-2xl">{t('back')}</button>
    </div>
  );
};
