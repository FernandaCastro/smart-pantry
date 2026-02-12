import { useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Product, Unit, User, ViewType } from '../types';

export interface ProductFormData {
  name: string;
  category: string;
  currentQuantity: number;
  minQuantity: number;
  unit: Unit;
}

interface UseProductActionsParams {
  currentUser: User | null;
  isConfigured: boolean;
  pantry: Product[];
  selectedShopItems: Record<string, boolean>;
  shopQuantities: Record<string, number>;
  editingProductId: string | null;
  formData: ProductFormData;
  supabase: SupabaseClient;
  loadPantryData: (pantryId: string) => Promise<void>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedShopItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setShopQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setCurrentView: React.Dispatch<React.SetStateAction<ViewType>>;
  setPantry: React.Dispatch<React.SetStateAction<Product[]>>;
  setEditingProductId: React.Dispatch<React.SetStateAction<string | null>>;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useProductActions = ({
  currentUser,
  isConfigured,
  pantry,
  selectedShopItems,
  shopQuantities,
  editingProductId,
  formData,
  supabase,
  loadPantryData,
  setIsLoading,
  setSelectedShopItems,
  setShopQuantities,
  setCurrentView,
  setPantry,
  setEditingProductId,
  setFormData,
  setIsModalOpen
}: UseProductActionsParams) => {
  const handleFinishPurchase = useCallback(async () => {
    if (!currentUser || !isConfigured) return;

    const itemsToUpdate = pantry.filter(p => selectedShopItems[p.id]);
    setIsLoading(true);

    try {
      for (const item of itemsToUpdate) {
        const boughtQty = shopQuantities[item.id] || (item.minQuantity - item.currentQuantity);
        const newQty = item.currentQuantity + boughtQty;

        await supabase
          .from('pantry_items')
          .update({ current_quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      }

      await loadPantryData(currentUser.pantryId);
      setSelectedShopItems({});
      setShopQuantities({});
      setCurrentView('pantry');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isConfigured, pantry, selectedShopItems, setIsLoading, shopQuantities, supabase, loadPantryData, setSelectedShopItems, setShopQuantities, setCurrentView]);

  const updateQuantity = useCallback(async (id: string, delta: number) => {
    const item = pantry.find(p => p.id === id);
    if (!item || !currentUser || !isConfigured) return;

    const newQty = Math.max(0, item.currentQuantity + delta);
    setPantry(prev => prev.map(p => p.id === id ? { ...p, currentQuantity: newQty } : p));

    const { error } = await supabase
      .from('pantry_items')
      .update({ current_quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) await loadPantryData(currentUser.pantryId);
  }, [pantry, currentUser, isConfigured, setPantry, supabase, loadPantryData]);

  const handleSaveProduct = useCallback(async () => {
    const { name, category, currentQuantity, minQuantity, unit } = formData;
    if (!name || !currentUser || !isConfigured) {
      alert('Dados incompletos.');
      return;
    }

    setIsLoading(true);

    const payload = {
      pantry_id: currentUser.pantryId,
      name,
      category,
      current_quantity: Number(currentQuantity),
      min_quantity: Number(minQuantity),
      unit,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = editingProductId
        ? await supabase.from('pantry_items').update(payload).eq('id', editingProductId)
        : await supabase.from('pantry_items').insert([payload]);

      if (error) throw error;

      await loadPantryData(currentUser.pantryId);
      setIsModalOpen(false);
      setEditingProductId(null);
      setFormData({ name: '', category: 'others', currentQuantity: 0, minQuantity: 1, unit: 'un' });
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [formData, currentUser, isConfigured, setIsLoading, editingProductId, supabase, loadPantryData, setIsModalOpen, setEditingProductId, setFormData]);

  const handleDeleteProduct = useCallback(async (id: string) => {
    if (!confirm('Excluir este item?') || !currentUser || !isConfigured) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('pantry_items').delete().eq('id', id);
      if (error) throw error;
      await loadPantryData(currentUser.pantryId);
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isConfigured, setIsLoading, supabase, loadPantryData]);

  const handleEditClick = useCallback((product: Product) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      currentQuantity: product.currentQuantity,
      minQuantity: product.minQuantity,
      unit: product.unit
    });
    setIsModalOpen(true);
  }, [setEditingProductId, setFormData, setIsModalOpen]);

  return {
    handleFinishPurchase,
    updateQuantity,
    handleSaveProduct,
    handleDeleteProduct,
    handleEditClick
  };
};
