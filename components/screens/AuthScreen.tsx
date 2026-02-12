import React from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Package, User as UserIcon } from 'lucide-react';
import { TranslationKey } from '../../i18n';

interface AuthScreenProps {
  isRegistering: boolean;
  googleClientId: string;
  isDataLoading: boolean;
  showPassword: boolean;
  authName: string;
  authEmail: string;
  authPassword: string;
  onAuthSubmit: () => void;
  onAuthNameChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleRegistering: () => void;
  t: (key: TranslationKey) => string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isRegistering,
  googleClientId,
  isDataLoading,
  showPassword,
  authName,
  authEmail,
  authPassword,
  onAuthSubmit,
  onAuthNameChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onTogglePassword,
  onToggleRegistering,
  t
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--sp-gray-50)] p-6">
      <div className="w-full max-w-md bg-[var(--sp-white)] p-8 rounded-[2.5rem] shadow-xl border border-[var(--sp-gray-100)] relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[var(--sp-violet-500)] rounded-2xl flex items-center justify-center text-[var(--sp-white)] mb-4 shadow-lg">
            <Package size={32} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--sp-gray-900)]">Smart Pantry</h1>
          <p className="text-[var(--sp-gray-400)] text-sm">{isRegistering ? t('authRegisterTitle') : t('authLoginTitle')}</p>
        </div>

        <div className="space-y-6">
          {!isRegistering && (
            <div className="flex flex-col gap-3">
              {googleClientId ? (
                <div id="googleBtn" className="w-full min-h-[44px]"></div>
              ) : (
                <div className="p-3 bg-[var(--sp-amber-50)] text-[var(--sp-amber-700)] text-[10px] font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} /> Google Auth desativado
                </div>
              )}

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-[var(--sp-gray-200)] w-full"></div>
                <span className="bg-[var(--sp-white)] px-4 text-[10px] font-black text-[var(--sp-gray-400)] uppercase absolute tracking-widest">ou use e-mail</span>
              </div>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); onAuthSubmit(); }} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-[10px] font-black text-[var(--sp-gray-400)] uppercase tracking-widest mb-2">{t('userName')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sp-gray-400)]" size={18} />
                  <input type="text" required className="w-full p-4 pl-12 bg-[var(--sp-gray-50)] rounded-2xl border-2 border-transparent focus:border-[var(--sp-violet-500)] outline-none transition-all" placeholder="Seu Nome Completo" value={authName} onChange={e => onAuthNameChange(e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-[var(--sp-gray-400)] uppercase tracking-widest mb-2">{t('email')}</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sp-gray-400)]" size={18} />
                <input type="email" required className="w-full p-4 pl-12 bg-[var(--sp-gray-50)] rounded-2xl border-2 border-transparent focus:border-[var(--sp-violet-500)] outline-none transition-all" placeholder="seu@email.com" value={authEmail} onChange={e => onAuthEmailChange(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[var(--sp-gray-400)] uppercase tracking-widest mb-2">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sp-gray-400)]" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full p-4 pl-12 pr-12 bg-[var(--sp-gray-50)] rounded-2xl border-2 border-transparent focus:border-[var(--sp-violet-500)] outline-none transition-all"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={e => onAuthPasswordChange(e.target.value)}
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--sp-gray-400)] hover:text-[var(--sp-violet-500)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isDataLoading} className="w-full bg-[var(--sp-violet-500)] text-[var(--sp-white)] py-4 rounded-2xl font-bold shadow-lg hover:bg-[var(--sp-violet-600)] transition-all active:scale-95 flex items-center justify-center gap-2">
              {isDataLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? t('register') : t('login'))}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onToggleRegistering}
                className="text-[11px] font-bold text-[var(--sp-violet-600)] hover:text-[var(--sp-violet-800)] transition-colors uppercase tracking-widest"
              >
                {isRegistering ? t('alreadyHaveAccount') : t('newHere')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
