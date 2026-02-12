import { useMemo } from 'react';
import sqlSetupScriptSource from '../database.sql?raw';

const getSupabaseDashboardUrl = (supabaseUrl: string) => supabaseUrl.replace('https://', 'https://app.supabase.com/project/');

export const useDatabaseSetup = ({ supabaseUrl }: { supabaseUrl: string }) => {
  const sqlSetupScript = useMemo(() => sqlSetupScriptSource, []);
  const supabaseDashboardUrl = useMemo(() => getSupabaseDashboardUrl(supabaseUrl), [supabaseUrl]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlSetupScript);
      alert('Script SQL copiado com sucesso!');
    } catch (error) {
      console.error('Erro ao copiar SQL:', error);
      alert('Não foi possível copiar automaticamente. Selecione e copie o SQL manualmente.');
    }
  };

  return {
    sqlSetupScript,
    supabaseDashboardUrl,
    handleCopySql
  };
};
