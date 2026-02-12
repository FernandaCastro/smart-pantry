import React from 'react';
import { Minus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { CATEGORIES, getCategoryLabel, getUnitLabel } from '../../constants';
import { TranslationKey } from '../../i18n';
import { Language, Product } from '../../types';

interface PantryScreenProps {
  pantry: Product[];
  searchQuery: string;
  lang: Language;
  t: (key: TranslationKey) => string;
  onSetSearchQuery: (value: string) => void;
  onOpenCreateModal: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
}

export const PantryScreen: React.FC<PantryScreenProps> = ({
  pantry,
  searchQuery,
  lang,
  t,
  onSetSearchQuery,
  onOpenCreateModal,
  onUpdateQuantity,
  onEditProduct,
  onDeleteProduct
}) => {
  return (
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
  );
};
