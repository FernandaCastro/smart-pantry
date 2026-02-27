import { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { User, ViewType, Product } from '../types';

const LAST_AI_SUGGESTION_STORAGE_KEY = 'last_ai_suggestion';

interface UseAuthenticationParams {
  supabase: SupabaseClient;
  isConfigured: boolean;
  loadPantryData: (pantryId: string) => Promise<void>;
  setCurrentView: React.Dispatch<React.SetStateAction<ViewType>>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setPantry: React.Dispatch<React.SetStateAction<Product[]>>;
  setIsDataLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDbTableError: React.Dispatch<React.SetStateAction<string | null>>;
  currentView: ViewType;
}

export function useAuthentication({
  supabase,
  isConfigured,
  loadPantryData,
  setCurrentView,
  setCurrentUser,
  setPantry,
  setIsDataLoading,
  setDbTableError,
  currentView
}: UseAuthenticationParams) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleExternalProfileSync = useCallback(async (userData: { email: string; name: string; id: string }) => {
    if (!isConfigured) return;

    setIsDataLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.id)
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          setDbTableError('profiles');
          return;
        }
        throw error;
      }

      let user: User;
      if (!profile) {
        const pantryId = Math.random().toString(36).substr(2, 9);
        const { error: insError } = await supabase
          .from('profiles')
          .insert([{ id: userData.id, email: userData.email, name: userData.name, pantry_id: pantryId }]);

        if (insError && insError.code !== '23505') throw insError;
        user = { id: userData.id, email: userData.email, name: userData.name, pantryId };
      } else {
        user = { id: profile.id, email: profile.email, name: profile.name, pantryId: profile.pantry_id };
      }

      setCurrentUser(user);
      localStorage.setItem('current_user', JSON.stringify(user));
      await loadPantryData(user.pantryId);
      setCurrentView('dashboard');
    } catch (err: any) {
      console.error('Erro Sync Perfil:', err);
      alert('Erro: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setIsDataLoading(false);
    }
  }, [isConfigured, setIsDataLoading, supabase, setDbTableError, setCurrentUser, loadPantryData, setCurrentView]);

  const handleGoogleResponse = useCallback(async (response: any) => {
    if (!response?.credential || !isConfigured) return;

    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error('Não foi possível autenticar com Google.');

      await handleExternalProfileSync({
        email: user.email || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || 'Usuário',
        id: user.id,
      });
    } catch (err: any) {
      console.error('Google login error:', err);
      const msg = err?.message || 'Erro desconhecido.';
      if (msg.includes('Provider (issuer "https://accounts.google.com") is not enabled')) {
        alert(
          'Login Google não habilitado no Supabase.\n' +
          'Acesse Authentication > Providers > Google no painel do Supabase e habilite o provider, configurando Client ID/Secret e redirect URL.'
        );
        return;
      }
      alert('Erro Google: ' + msg);
    }
  }, [isConfigured, supabase.auth, handleExternalProfileSync]);

  const handleAuth = useCallback(async () => {
    if (!authEmail || !authPassword || (isRegistering && !authName)) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    if (!isConfigured) {
      alert('Erro de configuração do banco de dados.');
      return;
    }

    setIsDataLoading(true);
    setDbTableError(null);

    try {
      if (isRegistering) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authName } }
        });

        if (signUpError) throw signUpError;

        const sessionUserId = signUpData.session?.user?.id;
        const userId = signUpData.user?.id;
        if (!userId || !sessionUserId) {
          alert('Conta criada. Confirme o e-mail para concluir o acesso.');
          setIsRegistering(false);
          setAuthPassword('');
          return;
        }

        const pantryId = Math.random().toString(36).substr(2, 9);
        const { error: insError } = await supabase
          .from('profiles')
          .insert([{ id: userId, email: authEmail, name: authName, pantry_id: pantryId }]);

        if (insError && insError.code !== '23505') throw insError;

        const user = { id: userId, email: authEmail, name: authName, pantryId };
        setCurrentUser(user);
        localStorage.setItem('current_user', JSON.stringify(user));
        setCurrentView('dashboard');
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        if (signInError) throw signInError;

        const loggedUserId = signInData.user?.id;
        if (!loggedUserId) throw new Error('Não foi possível identificar o usuário autenticado.');

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', loggedUserId)
          .maybeSingle();

        if (error) {
          if (error.code === '42P01') {
            setDbTableError('profiles');
            setIsDataLoading(false);
            return;
          }
          throw error;
        }

        if (!profile) {
          const pantryId = Math.random().toString(36).substr(2, 9);
          const nameFallback = authName || signInData.user.user_metadata?.full_name || authEmail.split('@')[0] || 'Usuário';
          const { error: profileInsertError } = await supabase
            .from('profiles')
            .insert([{ id: loggedUserId, email: authEmail, name: nameFallback, pantry_id: pantryId }]);

          if (profileInsertError && profileInsertError.code !== '23505') throw profileInsertError;

          const user = { id: loggedUserId, email: authEmail, name: nameFallback, pantryId };
          setCurrentUser(user);
          localStorage.setItem('current_user', JSON.stringify(user));
          setCurrentView('dashboard');
          return;
        }

        const user = { id: profile.id, email: profile.email, name: profile.name, pantryId: profile.pantry_id };
        setCurrentUser(user);
        localStorage.setItem('current_user', JSON.stringify(user));
        await loadPantryData(user.pantryId);
        setCurrentView('dashboard');
      }
    } catch (e: any) {
      console.error('Erro handleAuth:', e);
      alert('Erro: ' + (e.message || 'Erro desconhecido.'));
    } finally {
      setIsDataLoading(false);
    }
  }, [
    authEmail,
    authPassword,
    isRegistering,
    authName,
    isConfigured,
    setIsDataLoading,
    setDbTableError,
    supabase,
    setCurrentUser,
    setCurrentView,
    loadPantryData
  ]);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('current_user');
    localStorage.removeItem(LAST_AI_SUGGESTION_STORAGE_KEY);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setCurrentView('auth');
    setPantry([]);
  }, [supabase.auth, setCurrentUser, setCurrentView, setPantry]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        localStorage.removeItem('current_user');
        localStorage.removeItem(LAST_AI_SUGGESTION_STORAGE_KEY);
        setCurrentUser(null);
        setCurrentView('auth');
        return;
      }

      const savedUser = localStorage.getItem('current_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser) as User;
          if (user.id === session.user.id) {
            setCurrentUser(user);
            setCurrentView('dashboard');
            await loadPantryData(user.pantryId);
            return;
          }
        } catch (_e) {
          // ignore invalid local cache and fallback to profile sync
        }
      }

      const { email, user_metadata, id } = session.user;
      await handleExternalProfileSync({
        email: email || '',
        name: user_metadata.full_name || user_metadata.user_name || 'Usuário',
        id,
      });
    };

    checkSession();
  }, [supabase.auth, setCurrentUser, setCurrentView, loadPantryData, handleExternalProfileSync]);

  useEffect(() => {
    if (currentView !== 'auth') return;

    const initGoogle = () => {
      const google = (window as any).google;
      if (google && googleClientId) {
        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleResponse,
            auto_select: false,
          });
          const btn = document.getElementById('googleBtn');
          if (btn) {
            google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', width: '100%', shape: 'pill' });
          }
        } catch (err) {
          console.error('Google Auth Init Error:', err);
        }
      } else if (!google) {
        setTimeout(initGoogle, 500);
      }
    };

    initGoogle();
  }, [currentView, googleClientId, handleGoogleResponse]);

  return {
    authEmail,
    authPassword,
    authName,
    isRegistering,
    showPassword,
    handleAuth,
    handleLogout,
    setAuthEmail,
    setAuthPassword,
    setAuthName,
    setIsRegistering,
    setShowPassword
  };
}
