import React from 'react';
import { Loader2 } from 'lucide-react';
import { CATEGORIES, UNITS } from '../constants';
import { Unit } from '../types';

interface ProductFormData {
  name: string;
  category: string;
  currentQuantity: number;
  minQuantity: number;
  unit: Unit;
}

interface ProductFormModalProps {
  isOpen: boolean;
  editingProductId: string | null;
  formData: ProductFormData;
  isLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (next: ProductFormData) => void;
  t: (key: string) => string;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  editingProductId,
  formData,
  isLoading,
  onClose,
  onSave,
  onFormChange,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl">
        <h2 className="text-2xl font-black text-gray-900 mb-6">{editingProductId ? t('editTitle') : t('addTitle')}</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('nameLabel')}</label>
            <input type="text" autoFocus className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none" value={formData.name} onChange={e => onFormChange({ ...formData, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('catLabel')}</label>
              <select className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none" value={formData.category} onChange={e => onFormChange({ ...formData, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('unitLabel')}</label>
              <select className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none" value={formData.unit} onChange={e => onFormChange({ ...formData, unit: e.target.value as Unit })}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('currQtyLabel')}</label>
              <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none" value={formData.currentQuantity} onChange={e => onFormChange({ ...formData, currentQuantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('minQtyLabel')}</label>
              <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none" value={formData.minQuantity} onChange={e => onFormChange({ ...formData, minQuantity: Number(e.target.value) })} />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-bold">{t('cancel')}</button>
            <button onClick={onSave} disabled={isLoading || !formData.name} className="flex-[2] bg-violet-500 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : (editingProductId ? t('updateItem') : t('save'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
