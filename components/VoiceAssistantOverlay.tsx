import React from 'react';
import { Mic, X } from 'lucide-react';

interface VoiceAssistantOverlayProps {
  voiceLog: string;
  onStop: () => void;
  t: (key: string) => string;
}

export const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({ voiceLog, onStop, t }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[color:color-mix(in_srgb,var(--sp-black)_60%,transparent)] backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[color:color-mix(in_srgb,var(--sp-white)_90%,transparent)] backdrop-blur-2xl border border-[color:color-mix(in_srgb,var(--sp-white)_70%,transparent)] rounded-[3rem] p-10 flex flex-col items-center text-center shadow-2xl">
        <div className="relative mb-8"><div className="absolute inset-0 bg-[var(--sp-violet-500)] rounded-full animate-ping opacity-20"></div><div className="relative w-24 h-24 bg-[var(--sp-violet-500)] rounded-full flex items-center justify-center text-[var(--sp-white)] shadow-xl"><Mic size={40} /></div></div>
        <h2 className="text-2xl font-black text-[var(--sp-gray-900)] mb-2">{t('listening')}</h2>
        <p className="text-[var(--sp-gray-400)] text-sm mb-6 px-4">{t('voiceInstruction')}</p>
        {voiceLog && <div className="w-full p-4 bg-[var(--sp-violet-50)] rounded-2xl border border-[var(--sp-violet-100)] text-[var(--sp-violet-700)] font-bold mb-6">{voiceLog}</div>}
        <button onClick={onStop} className="bg-gradient-to-r from-[var(--sp-slate-900)] to-[var(--sp-slate-700)] text-[var(--sp-white)] px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg"><X size={20} /> {t('stopVoice')}</button>
      </div>
    </div>
  );
};
