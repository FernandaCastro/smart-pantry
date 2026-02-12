import React from 'react';
import { Copy, Database, ExternalLink, Terminal } from 'lucide-react';

interface DbSetupErrorScreenProps {
  dbTableError: string;
  sqlSetupScript: string;
  supabaseUrl: string;
  onCopySql: () => void;
}

export const DbSetupErrorScreen: React.FC<DbSetupErrorScreenProps> = ({
  dbTableError,
  sqlSetupScript,
  supabaseUrl,
  onCopySql
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--sp-slate-900)] p-6">
      <div className="w-full max-w-2xl bg-[var(--sp-slate-700)] rounded-[2.5rem] p-8 shadow-2xl border border-[var(--sp-slate-700)]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-[var(--sp-amber-50)]0/20 text-[var(--sp-amber-500)] rounded-2xl flex items-center justify-center">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--sp-white)]">Configuração de Banco Necessária</h2>
            <p className="text-[var(--sp-slate-400)] text-sm">A tabela <code className="text-[var(--sp-amber-400)]">public.{dbTableError}</code> não foi encontrada.</p>
          </div>
        </div>

        <div className="bg-[var(--sp-slate-900)] rounded-2xl p-6 mb-6 relative group">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-[var(--sp-slate-500)] uppercase tracking-widest flex items-center gap-2">
              <Terminal size={12} /> SQL Setup Script
            </span>
            <button onClick={onCopySql} className="p-2 bg-[var(--sp-slate-700)] hover:bg-[var(--sp-slate-700)] text-[var(--sp-slate-300)] rounded-xl transition-colors flex items-center gap-2 text-xs font-bold">
              <Copy size={14} /> Copiar SQL
            </button>
          </div>
          <pre className="text-[11px] text-[var(--sp-green-500)] font-mono overflow-x-auto leading-relaxed max-h-60 custom-scrollbar">
            {sqlSetupScript}
          </pre>
        </div>

        <div className="space-y-4">
          <p className="text-[var(--sp-slate-300)] text-sm leading-relaxed">
            Para corrigir este erro, siga estes passos:
          </p>
          <ol className="space-y-3">
            <li className="flex gap-3 text-xs text-[var(--sp-slate-400)]">
              <span className="w-5 h-5 bg-[var(--sp-slate-700)] rounded-full flex items-center justify-center flex-shrink-0 text-[var(--sp-white)] font-bold">1</span>
              <span>Acesse o <b>Dashboard do Supabase</b> do seu projeto.</span>
            </li>
            <li className="flex gap-3 text-xs text-[var(--sp-slate-400)]">
              <span className="w-5 h-5 bg-[var(--sp-slate-700)] rounded-full flex items-center justify-center flex-shrink-0 text-[var(--sp-white)] font-bold">2</span>
              <span>Clique em <b>SQL Editor</b> na barra lateral esquerda.</span>
            </li>
            <li className="flex gap-3 text-xs text-[var(--sp-slate-400)]">
              <span className="w-5 h-5 bg-[var(--sp-slate-700)] rounded-full flex items-center justify-center flex-shrink-0 text-[var(--sp-white)] font-bold">3</span>
              <span>Cole o script acima e clique em <b>Run</b>.</span>
            </li>
          </ol>

          <div className="pt-4 flex gap-3">
            <a href={supabaseUrl.replace('https://', 'https://app.supabase.com/project/')} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[var(--sp-violet-600)] text-[var(--sp-white)] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[var(--sp-violet-700)] transition-all">
              Ir para o Supabase <ExternalLink size={16} />
            </a>
            <button onClick={() => window.location.reload()} className="flex-1 bg-[var(--sp-slate-700)] text-[var(--sp-white)] py-4 rounded-2xl font-bold hover:bg-[var(--sp-slate-500)] transition-all">
              Já executei, recarregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
