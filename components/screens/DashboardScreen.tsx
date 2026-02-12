import React from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Package, ShoppingBasket, Sparkles } from 'lucide-react';
import { CATEGORIES, getUnitLabel } from '../../constants';
import { TranslationKey } from '../../i18n';
import { Language, Product, ShoppingItem, ViewType } from '../../types';

interface DashboardScreenProps {
  pantry: Product[];
  shoppingList: ShoppingItem[];
  lang: Language;
  isLoading: boolean;
  t: (key: TranslationKey) => string;
  onSetCurrentView: (view: ViewType) => void;
  onFetchAiSuggestions: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  pantry,
  shoppingList,
  lang,
  isLoading,
  t,
  onSetCurrentView,
  onFetchAiSuggestions
}) => {
  return (
    <div className="h-full min-h-0 flex flex-col gap-6">
      <div className="shrink-0 bg-gradient-to-br from-[var(--sp-violet-500)] to-[var(--sp-violet-700)] rounded-[2rem] p-6 text-[var(--sp-white)] relative overflow-hidden shadow-xl">
        <div className="relative z-10">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Sparkles size={18} className="text-[var(--sp-violet-200)]" /> {t('aiTitle')}</h2>
          <p className="text-[var(--sp-violet-100)] text-xs mb-4">{t('aiSub')}</p>
          <button onClick={onFetchAiSuggestions} disabled={isLoading} className="bg-[color:color-mix(in_srgb,var(--sp-white)_20%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--sp-white)_30%,transparent)] backdrop-blur-md border border-[color:color-mix(in_srgb,var(--sp-white)_30%,transparent)] px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95">
            {isLoading ? t('thinking') : t('getSuggestions')}
            <ChevronRight size={16} />
          </button>
        </div>
        <Sparkles className="absolute -bottom-6 -right-6 text-[color:color-mix(in_srgb,var(--sp-white)_10%,transparent)] w-40 h-40 transform rotate-12" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-6">
        <div className="shrink-0 grid grid-cols-2 gap-4 lg:hidden">
          <button onClick={() => onSetCurrentView('pantry')} className="text-left bg-[var(--sp-violet-50)] p-4 rounded-3xl border border-[var(--sp-violet-100)] cursor-pointer active:scale-[0.99] transition-all">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--sp-violet-700)] font-bold uppercase tracking-wider">{t('totalItems')}</p>
              <Package size={16} className="text-[var(--sp-violet-600)]" />
            </div>
            <p className="text-3xl font-black text-[var(--sp-violet-900)]">{pantry.length}</p>
          </button>
          <button onClick={() => onSetCurrentView('shopping')} className="text-left bg-[var(--sp-indigo-50)] p-4 rounded-3xl border border-[var(--sp-indigo-100)] cursor-pointer active:scale-[0.99] transition-all">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--sp-indigo-700)] font-bold uppercase tracking-wider">{t('missingItems')}</p>
              <ShoppingBasket size={16} className="text-[var(--sp-indigo-600)]" />
            </div>
            <p className="text-3xl font-black text-[var(--sp-indigo-900)]">{shoppingList.length}</p>
          </button>
        </div>

        <section className="flex-1 min-h-0 flex flex-col">
          <h3 className="shrink-0 font-bold text-[var(--sp-gray-800)] mb-3 flex items-center gap-2"><AlertCircle size={18} className="text-[var(--sp-indigo-500)]" /> {t('lowStock')}</h3>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {pantry.length === 0 ? (
              <div className="py-10 text-center bg-[var(--sp-gray-50)] rounded-3xl border-2 border-dashed border-[var(--sp-gray-200)] text-[var(--sp-gray-400)] text-sm">{t('pantryEmpty')}</div>
            ) : shoppingList.length === 0 ? (
              <div className="py-10 text-center bg-[var(--sp-violet-50)] rounded-3xl border border-[var(--sp-violet-100)] text-[var(--sp-violet-600)] text-sm font-bold flex flex-col items-center gap-2">
                <CheckCircle2 size={32} /> {t('stockOk')}
              </div>
            ) : (
              shoppingList.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-[var(--sp-white)] border border-[var(--sp-gray-100)] rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CATEGORIES.find(c => c.id === item.category)?.icon || '📦'}</span>
                    <div>
                      <p className="font-bold text-[var(--sp-gray-700)]">{item.name}</p>
                      <p className="text-[10px] text-[var(--sp-fuchsia-500)] font-bold uppercase">{t('stockAlertMsg')} {item.currentQuantity} {getUnitLabel(item.unit, lang)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--sp-gray-400)] font-bold uppercase">{t('buyMsg')}</p>
                    <p className="font-black text-[var(--sp-violet-600)]">+{item.neededQuantity} {getUnitLabel(item.unit, lang)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
