import React, { useMemo } from 'react';
import { LayoutDashboard, Loader2, Mic, Package, Settings, ShoppingBasket, Sparkles } from 'lucide-react';
import { TranslationKey } from '../../i18n';
import { Language, Product, ShoppingItem, User, ViewType } from '../../types';
import { MainHeader } from './MainHeader';
import { DashboardScreen } from './DashboardScreen';
import { PantryScreen } from './PantryScreen';
import { ShoppingScreen } from './ShoppingScreen';
import { SettingsScreen } from './SettingsScreen';
import { AIScreen } from './AIScreen';

interface MainAppLayoutProps {
  currentView: ViewType;
  isVoiceActive: boolean;
  pantry: Product[];
  selectedShopItems: Record<string, boolean>;
  shopQuantities: Record<string, number>;
  searchQuery: string;
  lang: Language;
  theme: 'light' | 'dark';
  isLoading: boolean;
  isDataLoading: boolean;
  aiSuggestions: string;
  currentUser: User | null;
  t: (key: TranslationKey) => string;
  onSetCurrentView: (view: ViewType) => void;
  onStartVoiceSession: () => void;
  onSetLang: (lang: Language) => void;
  onToggleTheme: () => void;
  onFetchAiSuggestions: () => void;
  onSetSearchQuery: (value: string) => void;
  onOpenCreateModal: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onToggleSelectedShopItem: (itemId: string) => void;
  onDecreaseShopQuantity: (item: ShoppingItem) => void;
  onIncreaseShopQuantity: (item: ShoppingItem) => void;
  onFinishPurchase: () => void;
  onLogout: () => void;
}

export const MainAppLayout: React.FC<MainAppLayoutProps> = ({
  currentView,
  isVoiceActive,
  pantry,
  selectedShopItems,
  shopQuantities,
  searchQuery,
  lang,
  theme,
  isLoading,
  isDataLoading,
  aiSuggestions,
  currentUser,
  t,
  onSetCurrentView,
  onStartVoiceSession,
  onSetLang,
  onToggleTheme,
  onFetchAiSuggestions,
  onSetSearchQuery,
  onOpenCreateModal,
  onUpdateQuantity,
  onEditProduct,
  onDeleteProduct,
  onToggleSelectedShopItem,
  onDecreaseShopQuantity,
  onIncreaseShopQuantity,
  onFinishPurchase,
  onLogout
}) => {
  const hasInternalScrollableList = currentView === 'dashboard' || currentView === 'pantry' || currentView === 'shopping';

  const shoppingList = useMemo(() => {
    return pantry
      .filter(p => p.currentQuantity < p.minQuantity)
      .map(p => ({ ...p, neededQuantity: Math.max(0, p.minQuantity - p.currentQuantity) }));
  }, [pantry]);

  return (
    <div className="h-screen bg-gradient-to-br from-[var(--sp-violet-100)] via-[var(--sp-indigo-50)] to-[var(--sp-fuchsia-100)] lg:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-16 h-80 w-80 rounded-full bg-[color:color-mix(in_srgb,var(--sp-violet-500)_25%,transparent)] blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--sp-indigo-500)_25%,transparent)] blur-3xl"></div>
      <div className="mx-auto flex h-screen max-w-6xl bg-[color:color-mix(in_srgb,var(--sp-white)_85%,transparent)] backdrop-blur-xl shadow-2xl shadow-[0_25px_45px_-30px_rgba(76,29,149,0.35)] relative lg:h-[calc(100vh-3rem)] lg:rounded-[2rem] lg:border lg:border-[color:color-mix(in_srgb,var(--sp-white)_60%,transparent)] lg:overflow-hidden">
        <aside className="hidden lg:flex h-full min-h-0 w-72 border-r border-[color:color-mix(in_srgb,var(--sp-white)_70%,transparent)] bg-gradient-to-b from-[color:color-mix(in_srgb,var(--sp-violet-100)_80%,transparent)] via-[color:color-mix(in_srgb,var(--sp-indigo-50)_70%,transparent)] to-[color:color-mix(in_srgb,var(--sp-white)_80%,transparent)] p-6 flex-col gap-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-[var(--sp-violet-500)] rounded-xl text-[var(--sp-white)]"><Package size={20} /></div>
              <h2 className="font-black text-lg text-[var(--sp-violet-900)]">Smart Pantry</h2>
            </div>
            <p className="text-sm text-[var(--sp-violet-600)]/70">{t('appTagline')}</p>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'dashboard' as ViewType, label: t('dashboard'), icon: LayoutDashboard },
              { id: 'pantry' as ViewType, label: t('pantry'), icon: Package },
              { id: 'shopping' as ViewType, label: t('shopping'), icon: ShoppingBasket },
              { id: 'ai' as ViewType, label: t('ai'), icon: Sparkles },
              { id: 'settings' as ViewType, label: t('settings'), icon: Settings }
            ].map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSetCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${isActive ? 'bg-gradient-to-r from-[var(--sp-violet-500)] to-[var(--sp-indigo-500)] text-[var(--sp-white)] shadow-lg shadow-[0_12px_24px_-14px_rgba(139,92,246,0.55)]' : 'text-[var(--sp-slate-500)] hover:bg-[color:color-mix(in_srgb,var(--sp-white)_90%,transparent)] hover:text-[var(--sp-violet-600)]'}`}
                >
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex justify-center">
            <button
              onClick={onStartVoiceSession}
              aria-label={t('voice')}
              className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all border ${isVoiceActive ? 'bg-gradient-to-r from-[var(--sp-red-500)] to-[var(--sp-red-400)] text-[var(--sp-white)] border-[var(--sp-red-500)] shadow-[0_12px_24px_-14px_rgba(239,68,68,0.55)] animate-pulse' : 'bg-gradient-to-r from-[var(--sp-violet-500)] to-[var(--sp-indigo-500)] text-[var(--sp-white)] border-[var(--sp-violet-500)] shadow-lg shadow-[0_12px_24px_-14px_rgba(139,92,246,0.55)] hover:brightness-105'}`}
            >
              <Mic size={20} />
            </button>
          </div>

          <div className="mt-auto space-y-3">
            <button onClick={() => onSetCurrentView('pantry')} className="w-full text-left bg-[var(--sp-white)] rounded-2xl p-4 border border-[var(--sp-violet-100)] hover:border-[var(--sp-violet-200)] transition-all cursor-pointer active:scale-[0.99]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--sp-violet-600)]">{t('totalItems')}</p>
                <Package size={16} className="text-[var(--sp-violet-500)]" />
              </div>
              <p className="text-3xl font-black text-[var(--sp-violet-900)]">{pantry.length}</p>
            </button>
            <button onClick={() => onSetCurrentView('shopping')} className="w-full text-left bg-[var(--sp-white)] rounded-2xl p-4 border border-[var(--sp-indigo-100)] hover:border-[var(--sp-indigo-200)] transition-all cursor-pointer active:scale-[0.99]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--sp-indigo-600)]">{t('missingItems')}</p>
                <ShoppingBasket size={16} className="text-[var(--sp-indigo-500)]" />
              </div>
              <p className="text-3xl font-black text-[var(--sp-indigo-900)]">{shoppingList.length}</p>
            </button>
          </div>
        </aside>

        <div className="flex flex-col h-full min-h-0 flex-1 relative overflow-hidden pb-24 lg:pb-0">
          <MainHeader
            currentView={currentView}
            lang={lang}
            theme={theme}
            t={t}
            onSetCurrentView={onSetCurrentView}
            onSetLang={onSetLang}
            onToggleTheme={onToggleTheme}
          />

          <main className={`flex-1 min-h-0 p-4 lg:p-6 ${hasInternalScrollableList ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {isDataLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--sp-violet-400)] animate-pulse">
                <Loader2 className="animate-spin mb-4" size={40} />
                <span className="text-sm font-bold uppercase tracking-widest">Sincronizando...</span>
              </div>
            )}

            {!isDataLoading && currentView === 'dashboard' && (
              <DashboardScreen
                pantry={pantry}
                shoppingList={shoppingList}
                lang={lang}
                isLoading={isLoading}
                t={t}
                onSetCurrentView={onSetCurrentView}
                onFetchAiSuggestions={onFetchAiSuggestions}
              />
            )}

            {!isDataLoading && currentView === 'pantry' && (
              <PantryScreen
                pantry={pantry}
                searchQuery={searchQuery}
                lang={lang}
                t={t}
                onSetSearchQuery={onSetSearchQuery}
                onOpenCreateModal={onOpenCreateModal}
                onUpdateQuantity={onUpdateQuantity}
                onEditProduct={onEditProduct}
                onDeleteProduct={onDeleteProduct}
              />
            )}

            {currentView === 'shopping' && (
              <ShoppingScreen
                pantry={pantry}
                selectedShopItems={selectedShopItems}
                shopQuantities={shopQuantities}
                lang={lang}
                isLoading={isLoading}
                t={t}
                onToggleSelectedShopItem={onToggleSelectedShopItem}
                onDecreaseShopQuantity={onDecreaseShopQuantity}
                onIncreaseShopQuantity={onIncreaseShopQuantity}
                onFinishPurchase={onFinishPurchase}
              />
            )}

            {currentView === 'settings' && (
              <SettingsScreen currentUser={currentUser} onLogout={onLogout} />
            )}

            {currentView === 'ai' && (
              <AIScreen
                isLoading={isLoading}
                aiSuggestions={aiSuggestions}
                t={t}
                onBack={() => onSetCurrentView('dashboard')}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
