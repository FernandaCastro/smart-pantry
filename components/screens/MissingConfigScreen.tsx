import React from 'react';
import { AlertCircle } from 'lucide-react';

interface MissingConfigScreenProps {
  supabaseUrl: string;
  supabaseKey: string;
  googleClientId: string;
}

export const MissingConfigScreen: React.FC<MissingConfigScreenProps> = ({
  supabaseUrl,
  supabaseKey,
  googleClientId
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--sp-gray-50)] p-6">
      <div className="w-full max-w-md bg-[var(--sp-white)] p-10 rounded-[3rem] shadow-2xl border border-[var(--sp-red-100)] flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-[var(--sp-red-100)] rounded-full flex items-center justify-center text-[var(--sp-red-500)] mb-6 animate-pulse">
          <AlertCircle size={40} />
        </div>
        <h1 className="text-2xl font-black text-[var(--sp-gray-900)] mb-4">Configuração Necessária</h1>
        <p className="text-[var(--sp-gray-500)] text-sm mb-8 leading-relaxed">
          As chaves do Supabase e do Google não foram detectadas. Certifique-se de que o arquivo <code>.env</code> está preenchido corretamente.
        </p>
        <div className="w-full p-4 bg-[var(--sp-gray-50)] rounded-2xl text-left font-mono text-xs text-[var(--sp-gray-400)] mb-8 border border-[var(--sp-gray-100)]">
          SUPABASE_URL: {supabaseUrl ? 'OK' : 'Pendente'}<br/>
          SUPABASE_ANON_KEY: {supabaseKey ? 'OK' : 'Pendente'}<br/>
          GOOGLE_ID: {googleClientId ? 'OK' : 'Pendente'}
        </div>
        <p className="text-xs text-[var(--sp-gray-400)]">Verifique o arquivo .env para continuar.</p>
      </div>
    </div>
  );
};
