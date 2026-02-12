
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Product, ViewType, Unit, User, Language } from './types';
import { CATEGORIES, getCategoryLabel, normalizeUnitId } from './constants';
import { getSmartSuggestions } from './services/gemini';
import { translations, TranslationKey } from './i18n';
import { findBestPantryItemByName, inferVoiceIntent, normalizeVoiceCategory, normalizeVoiceUnit } from './voiceUtils';
import { BottomNav } from './components/BottomNav';
import { VoiceAssistantOverlay } from './components/VoiceAssistantOverlay';
import { ProductFormModal } from './components/ProductFormModal';
import { DbSetupErrorScreen } from './components/screens/DbSetupErrorScreen';
import { MissingConfigScreen } from './components/screens/MissingConfigScreen';
import { AuthScreen } from './components/screens/AuthScreen';
import { MainAppLayout } from './components/screens/MainAppLayout';
const APP_ENV = import.meta.env;

const SUPABASE_URL = APP_ENV.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = APP_ENV.VITE_SUPABASE_ANON_KEY || APP_ENV.VITE_SUPABASE_KEY || '';
const GOOGLE_CLIENT_ID = APP_ENV.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = APP_ENV.VITE_API_KEY || APP_ENV.VITE_GEMINI_API_KEY || '';

const IS_CONFIGURED = !!(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'));

const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder'
);

const SQL_SETUP_SCRIPT = `-- SCRIPT DE INICIALIZAÇÃO SMART PANTRY
-- Copie e cole no SQL Editor do seu Dashboard do Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  pantry_id TEXT NOT NULL,
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pantry_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  current_quantity NUMERIC DEFAULT 0,
  min_quantity NUMERIC DEFAULT 0,
  unit TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_pantry_id ON public.pantry_items(pantry_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo para profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para pantry_items" ON public.pantry_items FOR ALL USING (true) WITH CHECK (true);
`;

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) { return null; }
}

function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const normalizeStoredUnit = (rawUnit: unknown): Unit => normalizeUnitId(rawUnit);

const App: React.FC = () => {
  type VoiceIntent = 'consume' | 'add';
  type ThemeMode = 'light' | 'dark';

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pantry, setPantry] = useState<Product[]>([]);
  const pantryRef = useRef<Product[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('auth');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [lang, setLang] = useState<Language>('pt');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [dbTableError, setDbTableError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'others',
    currentQuantity: 0,
    minQuantity: 1,
    unit: 'un' as Unit
  });

  const [selectedShopItems, setSelectedShopItems] = useState<Record<string, boolean>>({});
  const [shopQuantities, setShopQuantities] = useState<Record<string, number>>({});
  const [shoppingCategoryExpanded, setShoppingCategoryExpanded] = useState<Record<string, boolean>>({});
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLog, setVoiceLog] = useState<string>('');
  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const voiceQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { pantryRef.current = pantry; }, [pantry]);
  const t = (key: TranslationKey) => translations[lang][key];

  useEffect(() => {
    const checkSession = async () => {
      // 1. Verificar se há usuário local
      const savedUser = localStorage.getItem('current_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);
          setCurrentView('dashboard');
          loadPantryData(user.pantryId);
          return;
        } catch (e) { localStorage.removeItem('current_user'); }
      }

      // 2. Verificar se retornou de um login OAuth (Supabase)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { email, user_metadata, id } = session.user;
        handleExternalProfileSync({
          email: email || '',
          name: user_metadata.full_name || user_metadata.user_name || 'Usuário',
          id: id
        });
      }
    };
    
    checkSession();
    
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang) setLang(savedLang as Language);

    const savedTheme = localStorage.getItem('app_theme') as ThemeMode | null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Sincroniza perfis de logins externos (Google via Supabase)
  const handleExternalProfileSync = async (userData: { email: string, name: string, id: string }) => {
    if (!IS_CONFIGURED) return;
    setIsDataLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.id)
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') { setDbTableError('profiles'); return; }
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
      console.error("Erro Sync Perfil:", err);
      alert("Erro: " + (err.message || "Erro desconhecido."));
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'auth') {
      const initGoogle = () => {
        const google = (window as any).google;
        if (google && GOOGLE_CLIENT_ID) {
          try {
            google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: handleGoogleResponse,
              auto_select: false,
            });
            const btn = document.getElementById("googleBtn");
            if (btn) google.accounts.id.renderButton(btn, { theme: "outline", size: "large", width: "100%", shape: "pill" });
          } catch (err) { console.error("Google Auth Init Error:", err); }
        } else if (!google) {
          setTimeout(initGoogle, 500);
        }
      };
      initGoogle();
    }
  }, [currentView]);

  const handleGoogleResponse = async (response: any) => {
    if (!response?.credential || !IS_CONFIGURED) return;
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
      alert("Erro Google: " + msg);
    }
  };


  const loadPantryData = async (pantryId: string) => {
    if (!pantryId || !IS_CONFIGURED) return;
    setIsDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('pantry_id', pantryId)
        .order('name', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          setDbTableError('pantry_items');
          return;
        }
        throw error;
      }

      if (data) {
        setPantry(data.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category || 'others',
          currentQuantity: Number(item.current_quantity) || 0,
          minQuantity: Number(item.min_quantity) || 0,
          unit: normalizeStoredUnit(item.unit),
          updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now()
        })));
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error.message);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!authEmail || !authPassword || (isRegistering && !authName)) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    if (!IS_CONFIGURED) {
      alert("Erro de configuração do banco de dados.");
      return;
    }
    setIsDataLoading(true);
    setDbTableError(null);
    
    try {
      if (isRegistering) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { full_name: authName }
          }
        });

        if (signUpError) throw signUpError;

        const sessionUserId = signUpData.session?.user?.id;
        const userId = signUpData.user?.id;
        if (!userId || !sessionUserId) {
          alert("Conta criada. Confirme o e-mail para concluir o acesso.");
          setIsRegistering(false);
          setAuthPassword('');
          return;
        }

        const pantryId = Math.random().toString(36).substr(2, 9);
        const { error: insError } = await supabase
          .from('profiles')
          .insert([{ 
            id: userId,
            email: authEmail, 
            name: authName, 
            pantry_id: pantryId
          }]);

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
        if (!loggedUserId) {
          throw new Error("Não foi possível identificar o usuário autenticado.");
        }

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
      console.error("Erro handleAuth:", e);
      alert("Erro: " + (e.message || "Erro desconhecido."));
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    alert("Script SQL copiado com sucesso!");
  };

  const handleLogout = async () => {
    localStorage.removeItem('current_user');
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setCurrentView('auth');
    setPantry([]);
  };

  const applyVoicePantryUpdate = async (args: any) => {
    if (!currentUser || !IS_CONFIGURED) {
      return { status: 'error', message: 'Sessão indisponível.' };
    }

    const productName = String(args?.productName || '').trim();
    const amount = Number(args?.amount);
    const intent = inferVoiceIntent(args);
    const unit = normalizeVoiceUnit(args?.unit);
    const category = normalizeVoiceCategory(args?.category);

    if (!productName || !Number.isFinite(amount) || amount <= 0 || !intent) {
      const message = 'Comando de voz inválido.';
      setVoiceLog(message);
      return { status: 'error', message };
    }

    try {
      const existingItem = findBestPantryItemByName(pantryRef.current, productName);

      if (!existingItem && intent === 'consume') {
        const message = t('productNotFound');
        setVoiceLog(message);
        return { status: 'error', message };
      }

      if (!existingItem && intent === 'add') {
        const payload = {
          pantry_id: currentUser.pantryId,
          name: productName,
          category,
          current_quantity: amount,
          min_quantity: 1,
          unit,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('pantry_items').insert([payload]);
        if (error) throw error;

        await loadPantryData(currentUser.pantryId);
        const message = t('productCreated').replace('{name}', productName);
        setVoiceLog(message);
        return { status: 'created', message, name: productName, quantity: amount, category, unit };
      }

      const target = existingItem as Product;
      const newQty = intent === 'consume'
        ? Math.max(0, target.currentQuantity - amount)
        : target.currentQuantity + amount;

      const { error } = await supabase
        .from('pantry_items')
        .update({ current_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', target.id);

      if (error) throw error;

      await loadPantryData(currentUser.pantryId);
      const message = t('quantityUpdated').replace('{name}', target.name);
      setVoiceLog(message);
      return { status: 'updated', message, id: target.id, quantity: newQty, category: target.category, unit: target.unit };
    } catch (error: any) {
      const message = `Erro ao atualizar estoque por voz: ${error.message}`;
      setVoiceLog(message);
      return { status: 'error', message };
    }
  };

  const enqueueVoiceToolCall = (functionCall: any, sessionPromise: Promise<any>) => {
    voiceQueueRef.current = voiceQueueRef.current
      .then(async () => {
        const result = await applyVoicePantryUpdate(functionCall.args);
        const session = await sessionPromise;
        session.sendToolResponse({ functionResponses: { id: functionCall.id, name: functionCall.name, response: result } });
      })
      .catch((error) => {
        console.error('Erro na fila de comandos de voz:', error);
      });
  };

  const startVoiceSession = async () => {
    try {
      setIsVoiceActive(true);
      const ai = new GoogleGenAI({ apiKey: API_KEY || '' });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const updateStockTool = {
        name: 'updatePantryQuantity',
        parameters: {
          type: Type.OBJECT,
          description: 'Updates the quantity of a product in the pantry.',
          properties: {
            intent: { type: Type.STRING, description: "Use 'consume' to decrease or 'add' to increase stock." },
            productName: {
              type: Type.STRING,
              description: 'Always copy exactly the product words spoken by the user (same language, no translation, no rewriting).'
            },
            amount: { type: Type.NUMBER, description: 'Use always a positive amount.' },
            unit: { type: Type.STRING, description: "Optional. Infer the most likely unit (un, kg, l, g, ml, package, box)." },
            category: { type: Type.STRING, description: 'Optional. Infer the product category when possible.' }
          },
          required: ['intent', 'productName', 'amount']
        }
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'updatePantryQuantity') {
                  enqueueVoiceToolCall(fc, sessionPromise);
                }
              }
            }
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => stopVoiceSession(),
          onerror: () => stopVoiceSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [updateStockTool] }],
          systemInstruction: `Você é o assistente da Despensa Inteligente.
Regras obrigatórias de idioma:
1) Detecte o idioma da primeira frase do usuário e mantenha TODAS as respostas nesse mesmo idioma até o fim da sessão.
2) Nunca misture idiomas e nunca mude automaticamente para português/inglês.

Ao chamar updatePantryQuantity:
- use intent='consume' para consumo e intent='add' para adição;
- amount sempre positivo;
- infira unit e category quando houver evidência na fala; se faltar unit/category, envie vazio;
- em productName, preserve exatamente o nome falado pelo usuário (mesmo idioma, sem tradução, sem normalização, sem singularizar/pluralizar).`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { setIsVoiceActive(false); }
  };

  const stopVoiceSession = () => {
    setIsVoiceActive(false);
    voiceQueueRef.current = Promise.resolve();
    if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} sessionRef.current = null; }
    if (audioContextsRef.current) {
      const { input, output } = audioContextsRef.current;
      if (input.state !== 'closed') input.close().catch(() => {});
      if (output.state !== 'closed') output.close().catch(() => {});
      audioContextsRef.current = null;
    }
  };

  const handleFinishPurchase = async () => {
    if (!currentUser || !IS_CONFIGURED) return;
    const itemsToUpdate = pantry.filter(p => selectedShopItems[p.id]);
    setIsLoading(true);
    try {
      for (const item of itemsToUpdate) {
        const boughtQty = shopQuantities[item.id] || (item.minQuantity - item.currentQuantity);
        const newQty = item.currentQuantity + boughtQty;
        await supabase.from('pantry_items').update({ current_quantity: newQty, updated_at: new Date().toISOString() }).eq('id', item.id);
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
  };

  const updateQuantity = async (id: string, delta: number) => {
    const item = pantry.find(p => p.id === id);
    if (!item || !currentUser || !IS_CONFIGURED) return;
    const newQty = Math.max(0, item.currentQuantity + delta);
    setPantry(prev => prev.map(p => p.id === id ? { ...p, currentQuantity: newQty } : p));
    const { error } = await supabase.from('pantry_items').update({ current_quantity: newQty, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) await loadPantryData(currentUser.pantryId);
  };

  const handleSaveProduct = async () => {
    const { name, category, currentQuantity, minQuantity, unit } = formData;
    if (!name || !currentUser || !IS_CONFIGURED) { alert("Dados incompletos."); return; }
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
      handleCloseModal();
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Excluir este item?') || !currentUser || !IS_CONFIGURED) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('pantry_items').delete().eq('id', id);
      if (error) throw error;
      await loadPantryData(currentUser.pantryId);
    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      currentQuantity: product.currentQuantity,
      minQuantity: product.minQuantity,
      unit: product.unit
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProductId(null);
    setFormData({ name: '', category: 'others', currentQuantity: 0, minQuantity: 1, unit: 'un' });
  };

  const handleFetchAiSuggestions = async () => {
    if (pantry.length === 0) return;
    setIsLoading(true);
    const text = await getSmartSuggestions(pantry, lang);
    setAiSuggestions(text);
    setIsLoading(false);
    setCurrentView('ai');
  };

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


  if (dbTableError) {
    return (
      <DbSetupErrorScreen
        dbTableError={dbTableError}
        sqlSetupScript={SQL_SETUP_SCRIPT}
        supabaseUrl={SUPABASE_URL}
        onCopySql={handleCopySql}
      />
    );
  }

  if (!IS_CONFIGURED) {
    return (
      <MissingConfigScreen
        supabaseUrl={SUPABASE_URL}
        supabaseKey={SUPABASE_KEY}
        googleClientId={GOOGLE_CLIENT_ID}
      />
    );
  }

  if (currentView === 'auth') {
    return (
      <AuthScreen
        isRegistering={isRegistering}
        googleClientId={GOOGLE_CLIENT_ID}
        isDataLoading={isDataLoading}
        showPassword={showPassword}
        authName={authName}
        authEmail={authEmail}
        authPassword={authPassword}
        onAuthSubmit={handleAuth}
        onAuthNameChange={setAuthName}
        onAuthEmailChange={setAuthEmail}
        onAuthPasswordChange={setAuthPassword}
        onTogglePassword={() => setShowPassword(!showPassword)}
        onToggleRegistering={() => setIsRegistering(!isRegistering)}
        t={t}
      />
    );
  }

  return (
    <>
      <MainAppLayout
        currentView={currentView}
        isVoiceActive={isVoiceActive}
        pantry={pantry}
        shoppingList={shoppingList}
        shoppingListByCategory={shoppingListByCategory}
        shoppingCategoryExpanded={shoppingCategoryExpanded}
        selectedShopItems={selectedShopItems}
        shopQuantities={shopQuantities}
        searchQuery={searchQuery}
        lang={lang}
        theme={theme}
        isLoading={isLoading}
        isDataLoading={isDataLoading}
        aiSuggestions={aiSuggestions}
        currentUser={currentUser}
        t={t}
        onSetCurrentView={setCurrentView}
        onStartVoiceSession={startVoiceSession}
        onSetLang={(nextLang) => {
          setLang(nextLang);
          localStorage.setItem('app_lang', nextLang);
        }}
        onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
        onFetchAiSuggestions={handleFetchAiSuggestions}
        onSetSearchQuery={setSearchQuery}
        onOpenCreateModal={() => setIsModalOpen(true)}
        onUpdateQuantity={updateQuantity}
        onEditProduct={handleEditClick}
        onDeleteProduct={handleDeleteProduct}
        onToggleShoppingCategory={(categoryId) => setShoppingCategoryExpanded(prev => ({ ...prev, [categoryId]: !prev[categoryId] }))}
        onToggleSelectedShopItem={(itemId) => setSelectedShopItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))}
        onDecreaseShopQuantity={(item) => setShopQuantities(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || item.neededQuantity) - 1) }))}
        onIncreaseShopQuantity={(item) => setShopQuantities(prev => ({ ...prev, [item.id]: (prev[item.id] || item.neededQuantity) + 1 }))}
        onFinishPurchase={handleFinishPurchase}
        onLogout={handleLogout}
      />

      <BottomNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        onVoiceToggle={startVoiceSession}
        isVoiceActive={isVoiceActive}
        t={t}
      />

      {isVoiceActive && <VoiceAssistantOverlay voiceLog={voiceLog} onStop={stopVoiceSession} t={t} />}

      <ProductFormModal
        isOpen={isModalOpen}
        editingProductId={editingProductId}
        formData={formData}
        isLoading={isLoading}
        onClose={handleCloseModal}
        onSave={handleSaveProduct}
        onFormChange={setFormData}
        t={t}
        lang={lang}
      />
    </>
  );
};

export default App;
