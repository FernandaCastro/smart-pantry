import React from 'react';
import { LayoutDashboard, Package, ShoppingBasket, Sparkles, Mic } from 'lucide-react';
import { ViewType } from '../types';

interface BottomNavProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  onVoiceToggle: () => void;
  isVoiceActive: boolean;
  t: (key: string) => string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setCurrentView, onVoiceToggle, isVoiceActive, t }) => {
  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-lg bg-white/90 backdrop-blur-xl border-t border-gray-100 flex justify-around p-3 z-50 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] lg:hidden">
      <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center flex-1 transition-all ${currentView === 'dashboard' ? 'text-violet-600 scale-110' : 'text-gray-300'}`}><LayoutDashboard size={24} /><span className="text-[10px] font-bold mt-1 uppercase">{t('dashboard')}</span></button>
      <button onClick={() => setCurrentView('pantry')} className={`flex flex-col items-center flex-1 transition-all ${currentView === 'pantry' ? 'text-violet-600 scale-110' : 'text-gray-300'}`}><Package size={24} /><span className="text-[10px] font-bold mt-1 uppercase">{t('pantry')}</span></button>
      <div className="flex items-center justify-center -mt-8">
        <button onClick={onVoiceToggle} className={`p-4 rounded-2xl shadow-xl border-4 border-white active:scale-90 transition-all ${isVoiceActive ? 'bg-red-500 animate-pulse' : 'bg-violet-500'}`}><Mic size={24} className="text-white" /></button>
      </div>
      <button onClick={() => setCurrentView('shopping')} className={`flex flex-col items-center flex-1 transition-all ${currentView === 'shopping' ? 'text-violet-600 scale-110' : 'text-gray-300'}`}><ShoppingBasket size={24} /><span className="text-[10px] font-bold mt-1 uppercase">{t('shopping')}</span></button>
      <button onClick={() => setCurrentView('ai')} className={`flex flex-col items-center flex-1 transition-all ${currentView === 'ai' ? 'text-violet-600 scale-110' : 'text-gray-300'}`}><Sparkles size={24} /><span className="text-[10px] font-bold mt-1 uppercase">{t('ai')}</span></button>
    </nav>
  );
};
