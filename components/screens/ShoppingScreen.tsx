import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, Loader2, Minus, Plus } from 'lucide-react';
import { CATEGORIES, getCategoryLabel, getUnitLabel } from '../../constants';
import { TranslationKey } from '../../i18n';
import { Language, Product, ShoppingItem } from '../../types';

interface ShoppingScreenProps {
  pantry: Product[];
  selectedShopItems: Record<string, boolean>;
  shopQuantities: Record<string, number>;
  lang: Language;
  isLoading: boolean;
  t: (key: TranslationKey) => string;
  onToggleSelectedShopItem: (itemId: string) => void;
  onDecreaseShopQuantity: (item: ShoppingItem) => void;
  onIncreaseShopQuantity: (item: ShoppingItem) => void;
  onFinishPurchase: () => void;
}

export const ShoppingScreen: React.FC<ShoppingScreenProps> = ({
  pantry,
  selectedShopItems,
  shopQuantities,
  lang,
  isLoading,
  t,
  onToggleSelectedShopItem,
  onDecreaseShopQuantity,
  onIncreaseShopQuantity,
  onFinishPurchase
}) => {
  const [shoppingCategoryExpanded, setShoppingCategoryExpanded] = useState<Record<string, boolean>>({});

  const shoppingList = useMemo(() => {
    return pantry
      .filter(p => p.currentQuantity < p.minQuantity)
      .map(p => ({ ...p, neededQuantity: Math.max(0, p.minQuantity - p.currentQuantity) }));
  }, [pantry]);

  const shoppingListByCategory = useMemo(() => {
    const grouped = shoppingList.reduce<Record<string, typeof shoppingList>>((acc, item) => {
      const categoryId = item.category || 'others';
      if (!acc[categoryId]) acc[categoryId] = [];
      acc[categoryId].push(item);
      return acc;
    }, {});

    const collator = new Intl.Collator(lang === 'pt' ? 'pt-BR' : 'en-US');

    return Object.entries(grouped)
      .map(([categoryId, items]) => {
        const category = CATEGORIES.find(c => c.id === categoryId);
        return {
          categoryId,
          categoryLabel: getCategoryLabel(categoryId, lang),
          categoryIcon: category?.icon || '📦',
          items: [...items].sort((a, b) => collator.compare(a.name, b.name))
        };
      })
      .sort((a, b) => collator.compare(a.categoryLabel, b.categoryLabel));
  }, [shoppingList, lang]);

  useEffect(() => {
    setShoppingCategoryExpanded(prev => {
      const next: Record<string, boolean> = {};
      shoppingListByCategory.forEach(({ categoryId }) => {
        next[categoryId] = prev[categoryId] ?? true;
      });
      return next;
    });
  }, [shoppingListByCategory]);

  return (
    <div className="space-y-4 pb-32 lg:pb-8">
      <div className="space-y-4">
        {shoppingListByCategory.map(group => {
          const isExpanded = shoppingCategoryExpanded[group.categoryId];
          return (
            <div key={group.categoryId} className="bg-[var(--sp-white)] border border-[var(--sp-gray-100)] rounded-3xl p-4">
              <button
                onClick={() => setShoppingCategoryExpanded(prev => ({ ...prev, [group.categoryId]: !prev[group.categoryId] }))}
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
  );
};
