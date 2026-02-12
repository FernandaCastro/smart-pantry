import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mic,
  Minus,
  Moon,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Sun,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import { CATEGORIES, getCategoryLabel, getUnitLabel } from '../../constants';
import { TranslationKey } from '../../i18n';
import { Language, Product, ShoppingItem, User, ViewType } from '../../types';

interface ShoppingCategoryGroup {
  categoryId: string;
  categoryLabel: string;
  categoryIcon: string;
  items: ShoppingItem[];
}

interface MainAppLayoutProps {
  currentView: ViewType;
  isVoiceActive: boolean;
  pantry: Product[];
  shoppingList: ShoppingItem[];
  shoppingListByCategory: ShoppingCategoryGroup[];
  shoppingCategoryExpanded: Record<string, boolean>;
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
  onToggleShoppingCategory: (categoryId: string) => void;
  onToggleSelectedShopItem: (itemId: string) => void;
  onDecreaseShopQuantity: (item: ShoppingItem) => void;
  onIncreaseShopQuantity: (item: ShoppingItem) => void;
  onFinishPurchase: () => void;
  onLogout: () => void;
}

export const MainAppLayout: React.FC<MainAppLayoutProps> = (props) => {
  const {
    currentView,
    isVoiceActive,
    pantry,
    shoppingList,
    shoppingListByCategory,
    shoppingCategoryExpanded,
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
    onToggleShoppingCategory,
    onToggleSelectedShopItem,
    onDecreaseShopQuantity,
    onIncreaseShopQuantity,
    onFinishPurchase,
    onLogout
  } = props;

  const viewHeaderIconMap: Partial<Record<ViewType, React.ComponentType<{ size?: number; className?: string }>>> = {
    dashboard: LayoutDashboard,
    pantry: Package,
    shopping: ShoppingBasket,
    ai: Sparkles,
    settings: Settings
  };

  const HeaderIcon = viewHeaderIconMap[currentView] || Package;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--sp-violet-100)] via-[var(--sp-indigo-50)] to-[var(--sp-fuchsia-100)] lg:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-16 h-80 w-80 rounded-full bg-[color:color-mix(in_srgb,var(--sp-violet-500)_25%,transparent)] blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--sp-indigo-500)_25%,transparent)] blur-3xl"></div>
      <div className="mx-auto flex min-h-screen max-w-6xl bg-[color:color-mix(in_srgb,var(--sp-white)_85%,transparent)] backdrop-blur-xl shadow-2xl shadow-[0_25px_45px_-30px_rgba(76,29,149,0.35)] relative lg:min-h-[calc(100vh-3rem)] lg:rounded-[2rem] lg:border lg:border-[color:color-mix(in_srgb,var(--sp-white)_60%,transparent)] lg:overflow-hidden">
        <aside className="hidden lg:flex w-72 border-r border-[color:color-mix(in_srgb,var(--sp-white)_70%,transparent)] bg-gradient-to-b from-[color:color-mix(in_srgb,var(--sp-violet-100)_80%,transparent)] via-[color:color-mix(in_srgb,var(--sp-indigo-50)_70%,transparent)] to-[color:color-mix(in_srgb,var(--sp-white)_80%,transparent)] p-6 flex-col gap-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-[var(--sp-violet-500)] rounded-xl text-[var(--sp-white)]"><Package size={20} /></div>
              <h2 className="font-black text-lg text-[var(--sp-violet-900)]">Smart Pantry</h2>
            </div>
            <p className="text-sm text-[var(--sp-violet-600)]/70">Controle inteligente da despensa</p>
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
              className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all border ${isVoiceActive ? 'bg-[var(--sp-red-500)] text-[var(--sp-white)] border-[var(--sp-red-500)] shadow-[0_12px_24px_-14px_rgba(239,68,68,0.55)] animate-pulse' : 'bg-[var(--sp-violet-500)] text-[var(--sp-white)] border-[var(--sp-violet-500)] shadow-lg shadow-[0_12px_24px_-14px_rgba(139,92,246,0.55)] hover:bg-[var(--sp-violet-600)]'}`}
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

        <div className="flex flex-col min-h-screen pb-24 lg:pb-0 lg:min-h-0 flex-1 relative">
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

          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
            {isDataLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--sp-violet-400)] animate-pulse">
                <Loader2 className="animate-spin mb-4" size={40} />
                <span className="text-sm font-bold uppercase tracking-widest">Sincronizando...</span>
              </div>
            )}

            {!isDataLoading && currentView === 'dashboard' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-[var(--sp-violet-500)] to-[var(--sp-violet-700)] rounded-[2rem] p-6 text-[var(--sp-white)] relative overflow-hidden shadow-xl">
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

                <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
                  <div className="grid grid-cols-2 gap-4 lg:hidden">
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

                  <section className="lg:col-span-3">
                    <h3 className="font-bold text-[var(--sp-gray-800)] mb-3 flex items-center gap-2"><AlertCircle size={18} className="text-[var(--sp-indigo-500)]" /> {t('lowStock')}</h3>
                    <div className="space-y-2">
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
            )}

            {!isDataLoading && currentView === 'pantry' && (
              <div className="space-y-4 lg:space-y-6">
                <div className="flex items-center gap-3 lg:max-w-2xl">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sp-gray-400)]" size={18} />
                    <input type="text" placeholder={t('searchPlaceholder')} className="w-full pl-12 pr-4 py-4 bg-[var(--sp-gray-50)] rounded-2xl border-2 border-transparent focus:border-[var(--sp-violet-500)] outline-none" value={searchQuery} onChange={e => onSetSearchQuery(e.target.value)} />
                  </div>
                  <button onClick={onOpenCreateModal} className="w-14 h-14 bg-[var(--sp-violet-100)] text-[var(--sp-violet-600)] rounded-2xl shadow-lg border border-[var(--sp-violet-200)] flex items-center justify-center active:scale-90 transition-all"><Plus size={24} /></button>
                </div>
                <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
                  {pantry.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                    <div key={item.id} className="bg-[var(--sp-white)] border border-[var(--sp-gray-100)] p-4 rounded-3xl shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="text-3xl p-3 bg-[var(--sp-gray-50)] rounded-2xl">{CATEGORIES.find(c => c.id === item.category)?.icon || '📦'}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[var(--sp-gray-800)] text-left truncate">{item.name}</h4>
                          <p className="text-[10px] text-[var(--sp-gray-400)] uppercase font-bold tracking-widest text-left">{getCategoryLabel(item.category, lang)}</p>
                          <span className="text-[10px] font-bold text-[var(--sp-gray-400)] text-left block">{item.currentQuantity}/{item.minQuantity} {getUnitLabel(item.unit, lang)}</span>
                          <div className="mt-1 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <button onClick={() => onUpdateQuantity(item.id, -1)} className="p-2 text-[var(--sp-gray-400)]"><Minus size={18} /></button>
                              <span className="w-8 text-center font-bold">{item.currentQuantity}</span>
                              <button onClick={() => onUpdateQuantity(item.id, 1)} className="p-2 text-[var(--sp-gray-400)]"><Plus size={18} /></button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => onEditProduct(item)} className="p-1.5 text-[var(--sp-gray-300)] hover:text-[var(--sp-violet-500)]"><Pencil size={16} /></button>
                              <button onClick={() => onDeleteProduct(item.id)} className="p-1.5 text-[var(--sp-gray-300)] hover:text-[var(--sp-red-400)]"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentView === 'shopping' && (
              <div className="space-y-4 pb-32 lg:pb-8">
                <div className="space-y-4">
                  {shoppingListByCategory.map(group => {
                    const isExpanded = shoppingCategoryExpanded[group.categoryId];
                    return (
                      <div key={group.categoryId} className="bg-[var(--sp-white)] border border-[var(--sp-gray-100)] rounded-3xl p-4">
                        <button
                          onClick={() => onToggleShoppingCategory(group.categoryId)}
                          className="w-full flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 text-left">
                            <span className="text-2xl">{group.categoryIcon}</span>
                            <div>
                              <p className="font-black text-[var(--sp-gray-900)]">{group.categoryLabel}</p>
                              <p className="text-[11px] font-bold text-[var(--sp-gray-400)] uppercase tracking-wider">{group.items.length} item(ns)</p>
                            </div>
                          </div>
                          <ChevronDown
                            size={18}
                            className={`text-[var(--sp-gray-400)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isExpanded && (
                          <div className="mt-4 space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
                            {group.items.map(item => (
                              <div key={item.id} className={`bg-[var(--sp-white)] border-2 p-4 rounded-3xl flex flex-col gap-4 ${selectedShopItems[item.id] ? 'border-[var(--sp-violet-500)] bg-[color:color-mix(in_srgb,var(--sp-violet-50)_30%,transparent)]' : 'border-[var(--sp-gray-50)]'}`}>
                                <div className="flex items-center gap-4">
                                  <button onClick={() => onToggleSelectedShopItem(item.id)} className={selectedShopItems[item.id] ? 'text-[var(--sp-violet-600)]' : 'text-[var(--sp-gray-300)]'}>
                                    {selectedShopItems[item.id] ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                                  </button>
                                  <div className="flex-1">
                                    <h4 className="font-bold text-[var(--sp-gray-800)]">{item.name}</h4>
                                    <p className="text-[11px] text-[var(--sp-gray-400)] font-bold uppercase tracking-wider">+{item.neededQuantity} {getUnitLabel(item.unit, lang)}</p>
                                  </div>
                                </div>
                                {selectedShopItems[item.id] && (
                                  <div className="flex items-center justify-between p-3 bg-[var(--sp-white)] rounded-2xl border border-[var(--sp-violet-100)]">
                                    <p className="text-xs font-bold text-[var(--sp-violet-700)]">{t('purchasedQty')}:</p>
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => onDecreaseShopQuantity(item)} className="w-8 h-8 rounded-full bg-[var(--sp-violet-100)] text-[var(--sp-violet-600)] flex items-center justify-center"><Minus size={14} /></button>
                                      <span className="font-black">{shopQuantities[item.id] !== undefined ? shopQuantities[item.id] : item.neededQuantity}</span>
                                      <button onClick={() => onIncreaseShopQuantity(item)} className="w-8 h-8 rounded-full bg-[var(--sp-violet-100)] text-[var(--sp-violet-600)] flex items-center justify-center"><Plus size={14} /></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.values(selectedShopItems).some(v => v) && (
                  <div className="fixed bottom-24 left-4 right-4 z-[60] lg:static lg:bottom-auto lg:left-auto lg:right-auto lg:mt-2 lg:max-w-sm lg:ml-auto">
                    <button onClick={onFinishPurchase} disabled={isLoading} className="w-full bg-[var(--sp-violet-600)] text-[var(--sp-white)] py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3">
                      {isLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                      {t('finishPurchase')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentView === 'settings' && (
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
            )}

            {currentView === 'ai' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[var(--sp-violet-600)]"><Sparkles size={24} /><h2 className="text-xl font-bold">{t('aiTitle')}</h2></div>
                <div className="bg-[var(--sp-white)] border-2 border-[var(--sp-violet-50)] p-6 rounded-[2.5rem] shadow-sm leading-relaxed text-[var(--sp-gray-700)] prose text-sm">
                  {isLoading ? <Loader2 className="animate-spin text-[var(--sp-violet-500)] mx-auto" /> : <div className="whitespace-pre-wrap">{aiSuggestions || 'Nenhuma sugestão disponível.'}</div>}
                </div>
                <button onClick={() => onSetCurrentView('dashboard')} className="w-full py-4 border-2 border-[var(--sp-violet-500)] text-[var(--sp-violet-500)] font-bold rounded-2xl">{t('back')}</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
