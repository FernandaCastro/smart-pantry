import React from 'react';
import { Mic, X } from 'lucide-react';

interface VoiceAssistantOverlayProps {
  voiceLog: string;
  onStop: () => void;
  t: (key: string) => string;
}

export const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({ voiceLog, onStop, t }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl border border-white/70 rounded-[3rem] p-10 flex flex-col items-center text-center shadow-2xl">
        <div className="relative mb-8"><div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-20"></div><div className="relative w-24 h-24 bg-violet-500 rounded-full flex items-center justify-center text-white shadow-xl"><Mic size={40} /></div></div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">{t('listening')}</h2>
        <p className="text-gray-400 text-sm mb-6 px-4">{t('voiceInstruction')}</p>
        {voiceLog && <div className="w-full p-4 bg-violet-50 rounded-2xl border border-violet-100 text-violet-700 font-bold mb-6">{voiceLog}</div>}
        <button onClick={onStop} className="bg-gradient-to-r from-slate-900 to-slate-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg"><X size={20} /> {t('stopVoice')}</button>
      </div>
    </div>
  );
};
