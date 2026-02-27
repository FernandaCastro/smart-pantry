import React from 'react';
import { Database, ExternalLink, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../../types';

interface SettingsScreenProps {
  currentUser: User | null;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ currentUser, onLogout }) => {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 p-5 bg-[var(--sp-gray-50)] rounded-[2rem]">
        <div className="w-12 h-12 bg-[var(--sp-violet-500)] rounded-2xl flex items-center justify-center text-[var(--sp-white)]"><UserIcon size={24} /></div>
        <div className="flex-1">
          <p className="font-bold text-[var(--sp-gray-900)]">{currentUser?.name}</p>
          <p className="text-xs text-[var(--sp-gray-400)]">{currentUser?.email}</p>
        </div>
        <button onClick={onLogout} className="p-3 text-[var(--sp-red-400)]"><LogOut size={20} /></button>
      </div>

      <div className="p-6 bg-[var(--sp-white)] border border-[var(--sp-gray-100)] rounded-[2rem] space-y-4">
        <h3 className="font-bold text-[var(--sp-gray-800)] flex items-center gap-2">
          <Database size={18} className="text-[var(--sp-violet-500)]" /> Status do Sistema
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--sp-gray-400)] font-bold uppercase tracking-widest">Base de Dados</span>
            <span className="text-[var(--sp-green-500)] font-bold">Conectado</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--sp-gray-400)] font-bold uppercase tracking-widest">IA (Gemini)</span>
            <span className="text-[var(--sp-green-500)] font-bold">Ativo</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--sp-gray-400)] font-bold uppercase tracking-widest">Voz</span>
            <span className="text-[var(--sp-green-500)] font-bold">Pronto</span>
          </div>
        </div>
      </div>
    </div>
  );
};
