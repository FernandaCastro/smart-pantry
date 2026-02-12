import React from 'react';
import { LayoutDashboard, Moon, Package, Settings, ShoppingBasket, Sparkles, Sun } from 'lucide-react';
import { TranslationKey } from '../../i18n';
import { Language, ViewType } from '../../types';

interface MainHeaderProps {
  currentView: ViewType;
  lang: Language;
  theme: 'light' | 'dark';
  t: (key: TranslationKey) => string;
  onSetCurrentView: (view: ViewType) => void;
  onSetLang: (lang: Language) => void;
  onToggleTheme: () => void;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
  currentView,
  lang,
  theme,
  t,
  onSetCurrentView,
  onSetLang,
  onToggleTheme
}) => {
  const viewHeaderIconMap: Partial<Record<ViewType, React.ComponentType<{ size?: number; className?: string }>>> = {
    dashboard: LayoutDashboard,
    pantry: Package,
    shopping: ShoppingBasket,
    ai: Sparkles,
    settings: Settings
  };

  const HeaderIcon = viewHeaderIconMap[currentView] || Package;

  return (
    <header className="sticky top-0 z-40 sp-header-surface backdrop-blur-2xl border-b border-[color:color-mix(in_srgb,var(--sp-white)_80%,transparent)] p-4 lg:px-6 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-[var(--sp-violet-100)] to-[var(--sp-indigo-100)] rounded-xl text-[var(--sp-violet-600)] shadow-sm ring-1 ring-[color:color-mix(in_srgb,var(--sp-white)_80%,transparent)]">
          <HeaderIcon size={20} />
        </div>
        <h1 className="font-bold text-[var(--sp-gray-800)]">{currentView === 'dashboard' ? 'Smart Pantry' : t(currentView as TranslationKey)}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-[var(--sp-violet-200)] bg-[var(--sp-violet-50)]">
          <button
            onClick={() => onSetLang('pt')}
            aria-label="Português"
            title="Português"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${lang === 'pt' ? 'bg-[var(--sp-white)] shadow-sm' : 'grayscale opacity-45 hover:opacity-70'}`}
          >
            🇧🇷
          </button>
          <button
            onClick={() => onSetLang('en')}
            aria-label="English"
            title="English"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${lang === 'en' ? 'bg-[var(--sp-white)] shadow-sm' : 'grayscale opacity-45 hover:opacity-70'}`}
          >
            🇺🇸
          </button>
        </div>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl border border-[var(--sp-violet-200)] bg-[var(--sp-violet-50)] text-[var(--sp-violet-600)] hover:text-[var(--sp-violet-700)] transition-colors"
          aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
          title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button onClick={() => onSetCurrentView('settings')} className="p-2 text-[var(--sp-gray-400)] hover:text-[var(--sp-violet-500)] transition-colors"><Settings size={20} /></button>
      </div>
    </header>
  );
};
