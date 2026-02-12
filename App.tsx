
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, 
  LayoutDashboard,
  Plus, 
  Minus, 
  Trash2, 
  ChevronRight,
  Sparkles,
  Settings,
  AlertCircle,
  Search,
  LogOut,
  CheckCircle2,
  Circle,
  ChevronDown,
  User as UserIcon,
  Pencil,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Database,
  Copy,
  Terminal,
  ExternalLink,
  Mic,
  ShoppingBasket
} from 'lucide-react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Product, ViewType, Unit, User, Language } from './types';
import { CATEGORIES, UNITS, getCategoryLabel, getUnitLabel, normalizeUnitId } from './constants';
import { getSmartSuggestions } from './services/gemini';
import { translations, TranslationKey } from './i18n';
import { findBestPantryItemByName, inferVoiceIntent, normalizeVoiceCategory, normalizeVoiceUnit } from './voiceUtils';
import { BottomNav } from './components/BottomNav';
import { VoiceAssistantOverlay } from './components/VoiceAssistantOverlay';
import { ProductFormModal } from './components/ProductFormModal';
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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  }, []);

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

  const viewHeaderIconMap: Partial<Record<ViewType, React.ComponentType<{ size?: number; className?: string }>>> = {
    dashboard: LayoutDashboard,
    pantry: Package,
    shopping: ShoppingBasket,
    ai: Sparkles,
    settings: Settings
  };

  const HeaderIcon = viewHeaderIconMap[currentView] || Package;

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

  // View de Erro de Banco de Dados (Tabelas não encontradas)
  if (dbTableError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="w-full max-w-2xl bg-slate-800 rounded-[2.5rem] p-8 shadow-2xl border border-slate-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configuração de Banco Necessária</h2>
              <p className="text-slate-400 text-sm">A tabela <code className="text-amber-400">public.{dbTableError}</code> não foi encontrada.</p>
            </div>
          </div>
          
          <div className="bg-slate-950 rounded-2xl p-6 mb-6 relative group">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={12} /> SQL Setup Script
              </span>
              <button onClick={handleCopySql} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold">
                <Copy size={14} /> Copiar SQL
              </button>
            </div>
            <pre className="text-[11px] text-emerald-400 font-mono overflow-x-auto leading-relaxed max-h-60 custom-scrollbar">
              {SQL_SETUP_SCRIPT}
            </pre>
          </div>

          <div className="space-y-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              Para corrigir este erro, siga estes passos:
            </p>
            <ol className="space-y-3">
              <li className="flex gap-3 text-xs text-slate-400">
                <span className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">1</span>
                <span>Acesse o <b>Dashboard do Supabase</b> do seu projeto.</span>
              </li>
              <li className="flex gap-3 text-xs text-slate-400">
                <span className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">2</span>
                <span>Clique em <b>SQL Editor</b> na barra lateral esquerda.</span>
              </li>
              <li className="flex gap-3 text-xs text-slate-400">
                <span className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">3</span>
                <span>Cole o script acima e clique em <b>Run</b>.</span>
              </li>
            </ol>
            
            <div className="pt-4 flex gap-3">
              <a href={SUPABASE_URL.replace('https://', 'https://app.supabase.com/project/')} target="_blank" rel="noopener noreferrer" className="flex-1 bg-violet-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-all">
                Ir para o Supabase <ExternalLink size={16} />
              </a>
              <button onClick={() => window.location.reload()} className="flex-1 bg-slate-700 text-white py-4 rounded-2xl font-bold hover:bg-slate-600 transition-all">
                Já executei, recarregar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!IS_CONFIGURED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border border-red-100 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse">
            <AlertCircle size={40} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4">Configuração Necessária</h1>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            As chaves do Supabase e do Google não foram detectadas. Certifique-se de que o arquivo <code>.env</code> está preenchido corretamente.
          </p>
          <div className="w-full p-4 bg-gray-50 rounded-2xl text-left font-mono text-xs text-gray-400 mb-8 border border-gray-100">
            SUPABASE_URL: {SUPABASE_URL ? 'OK' : 'Pendente'}<br/>
            SUPABASE_KEY: {SUPABASE_KEY ? 'OK' : 'Pendente'}<br/>
            GOOGLE_ID: {GOOGLE_CLIENT_ID ? 'OK' : 'Pendente'}
          </div>
          <p className="text-xs text-gray-400">Verifique o arquivo .env para continuar.</p>
        </div>
      </div>
    );
  }

  if (currentView === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 relative">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-violet-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
              <Package size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Pantry</h1>
            <p className="text-gray-400 text-sm">{isRegistering ? t('authRegisterTitle') : t('authLoginTitle')}</p>
          </div>
          
          <div className="space-y-6">
            {!isRegistering && (
              <div className="flex flex-col gap-3">
                {GOOGLE_CLIENT_ID ? (
                  <div id="googleBtn" className="w-full min-h-[44px]"></div>
                ) : (
                  <div className="p-3 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} /> Google Auth desativado
                  </div>
                )}

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-gray-200 w-full"></div>
                  <span className="bg-white px-4 text-[10px] font-black text-gray-400 uppercase absolute tracking-widest">ou use e-mail</span>
                </div>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('userName')}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" required className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none transition-all" placeholder="Seu Nome Completo" value={authName} onChange={e => setAuthName(e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('email')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="email" required className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none transition-all" placeholder="seu@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    className="w-full p-4 pl-12 pr-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none transition-all" 
                    placeholder="••••••••" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-500"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isDataLoading} className="w-full bg-violet-500 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-violet-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                {isDataLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? t('register') : t('login'))}
              </button>
              
              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors uppercase tracking-widest"
                >
                  {isRegistering ? t('alreadyHaveAccount') : t('newHere')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-indigo-50 to-fuchsia-100 lg:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl"></div>
      <div className="mx-auto flex min-h-screen max-w-6xl bg-white/85 backdrop-blur-xl shadow-2xl shadow-violet-900/10 relative lg:min-h-[calc(100vh-3rem)] lg:rounded-[2rem] lg:border lg:border-white/60 lg:overflow-hidden">
      <aside className="hidden lg:flex w-72 border-r border-white/70 bg-gradient-to-b from-violet-100/80 via-indigo-50/70 to-white/80 p-6 flex-col gap-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-violet-500 rounded-xl text-white"><Package size={20} /></div>
            <h2 className="font-black text-lg text-violet-900">Smart Pantry</h2>
          </div>
          <p className="text-sm text-violet-600/70">Controle inteligente da despensa</p>
        </div>

        <nav className="space-y-2">
          {[
            { id: 'dashboard' as ViewType, label: t('dashboard'), icon: LayoutDashboard },
            { id: 'pantry' as ViewType, label: t('pantry'), icon: Package },
            { id: 'shopping' as ViewType, label: t('shopping'), icon: ShoppingBasket },
            { id: 'ai' as ViewType, label: t('ai'), icon: Sparkles },
            { id: 'settings' as ViewType, label: t('settings'), icon: Settings }
          ].map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${isActive ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30' : 'text-slate-500 hover:bg-white/90 hover:text-violet-600'}`}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex justify-center">
          <button
            onClick={startVoiceSession}
            aria-label={t('voice')}
            className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all border ${isVoiceActive ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30 animate-pulse' : 'bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-500/30 hover:bg-violet-600'}`}
          >
            <Mic size={20} />
          </button>
        </div>

        <div className="mt-auto space-y-3">
          <button onClick={() => setCurrentView('pantry')} className="w-full text-left bg-white rounded-2xl p-4 border border-violet-100 hover:border-violet-200 transition-all cursor-pointer active:scale-[0.99]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">{t('totalItems')}</p>
              <Package size={16} className="text-violet-500" />
            </div>
            <p className="text-3xl font-black text-violet-900">{pantry.length}</p>
          </button>
          <button onClick={() => setCurrentView('shopping')} className="w-full text-left bg-white rounded-2xl p-4 border border-indigo-100 hover:border-indigo-200 transition-all cursor-pointer active:scale-[0.99]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-indigo-600">{t('missingItems')}</p>
              <ShoppingBasket size={16} className="text-indigo-500" />
            </div>
            <p className="text-3xl font-black text-indigo-900">{shoppingList.length}</p>
          </button>
        </div>
      </aside>

      <div className="flex flex-col min-h-screen pb-24 lg:pb-0 lg:min-h-0 flex-1 relative">
      <header className="sticky top-0 z-40 bg-white/75 backdrop-blur-xl border-b border-white/70 p-4 lg:px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-xl text-violet-600">
            <HeaderIcon size={20} />
          </div>
          <h1 className="font-bold text-gray-800">{currentView === 'dashboard' ? 'Smart Pantry' : t(currentView as TranslationKey)}</h1>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1.5 p-1 rounded-xl border border-violet-200 bg-violet-50">
             <button
               onClick={() => { setLang('pt'); localStorage.setItem('app_lang', 'pt'); }}
               aria-label="Português"
               title="Português"
               className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${lang === 'pt' ? 'bg-white shadow-sm' : 'grayscale opacity-45 hover:opacity-70'}`}
             >
               🇧🇷
             </button>
             <button
               onClick={() => { setLang('en'); localStorage.setItem('app_lang', 'en'); }}
               aria-label="English"
               title="English"
               className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${lang === 'en' ? 'bg-white shadow-sm' : 'grayscale opacity-45 hover:opacity-70'}`}
             >
               🇺🇸
             </button>
           </div>
           <button onClick={() => setCurrentView('settings')} className="p-2 text-gray-400 hover:text-violet-500 transition-colors"><Settings size={20} /></button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {isDataLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-violet-400 animate-pulse">
            <Loader2 className="animate-spin mb-4" size={40} />
            <span className="text-sm font-bold uppercase tracking-widest">Sincronizando...</span>
          </div>
        )}

        {!isDataLoading && currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl">
               <div className="relative z-10">
                 <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Sparkles size={18} className="text-violet-200" /> {t('aiTitle')}</h2>
                 <p className="text-violet-100 text-xs mb-4">{t('aiSub')}</p>
                 <button onClick={handleFetchAiSuggestions} disabled={isLoading} className="bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95">
                    {isLoading ? t('thinking') : t('getSuggestions')}
                    <ChevronRight size={16} />
                 </button>
               </div>
               <Sparkles className="absolute -bottom-6 -right-6 text-white/10 w-40 h-40 transform rotate-12" />
            </div>

            <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
              <div className="grid grid-cols-2 gap-4 lg:hidden">
                <button onClick={() => setCurrentView('pantry')} className="text-left bg-violet-50 p-4 rounded-3xl border border-violet-100 cursor-pointer active:scale-[0.99] transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-violet-700 font-bold uppercase tracking-wider">{t('totalItems')}</p>
                    <Package size={16} className="text-violet-600" />
                  </div>
                  <p className="text-3xl font-black text-violet-900">{pantry.length}</p>
                </button>
                <button onClick={() => setCurrentView('shopping')} className="text-left bg-indigo-50 p-4 rounded-3xl border border-indigo-100 cursor-pointer active:scale-[0.99] transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-indigo-700 font-bold uppercase tracking-wider">{t('missingItems')}</p>
                    <ShoppingBasket size={16} className="text-indigo-600" />
                  </div>
                  <p className="text-3xl font-black text-indigo-900">{shoppingList.length}</p>
                </button>
              </div>

              <section className="lg:col-span-3">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><AlertCircle size={18} className="text-indigo-500" /> {t('lowStock')}</h3>
              <div className="space-y-2">
                {pantry.length === 0 ? (
                  <div className="py-10 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">{t('pantryEmpty')}</div>
                ) : shoppingList.length === 0 ? (
                  <div className="py-10 text-center bg-violet-50 rounded-3xl border border-violet-100 text-violet-600 text-sm font-bold flex flex-col items-center gap-2">
                    <CheckCircle2 size={32} /> {t('stockOk')}
                  </div>
                ) : (
                  shoppingList.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{CATEGORIES.find(c => c.id === item.category)?.icon || '📦'}</span>
                        <div>
                          <p className="font-bold text-gray-700">{item.name}</p>
                          <p className="text-[10px] text-fuchsia-500 font-bold uppercase">{t('stockAlertMsg')} {item.currentQuantity} {getUnitLabel(item.unit, lang)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{t('buyMsg')}</p>
                        <p className="font-black text-violet-600">+{item.neededQuantity} {getUnitLabel(item.unit, lang)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
          </div>
        )}

        {!isDataLoading && currentView === 'pantry' && (
          <div className="space-y-4 lg:space-y-6">
            <div className="flex items-center gap-3 lg:max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder={t('searchPlaceholder')} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-violet-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button onClick={() => setIsModalOpen(true)} className="w-14 h-14 bg-violet-100 text-violet-600 rounded-2xl shadow-lg border border-violet-200 flex items-center justify-center active:scale-90 transition-all"><Plus size={24} /></button>
            </div>
            <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
              {pantry.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                <div key={item.id} className="bg-white border border-gray-100 p-4 rounded-3xl shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl p-3 bg-gray-50 rounded-2xl">{CATEGORIES.find(c => c.id === item.category)?.icon || '📦'}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 text-left truncate">{item.name}</h4>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest text-left">{getCategoryLabel(item.category, lang)}</p>
                      <span className="text-[10px] font-bold text-gray-400 text-left block">{item.currentQuantity}/{item.minQuantity} {getUnitLabel(item.unit, lang)}</span>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-2 text-gray-400"><Minus size={18} /></button>
                          <span className="w-8 text-center font-bold">{item.currentQuantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-2 text-gray-400"><Plus size={18} /></button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditClick(item)} className="p-1.5 text-gray-300 hover:text-violet-500"><Pencil size={16} /></button>
                          <button onClick={() => handleDeleteProduct(item.id)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'shopping' && (
          <div className="space-y-4 pb-32 lg:pb-8">
            <div className="space-y-4">
              {shoppingListByCategory.map(group => {
                const isExpanded = shoppingCategoryExpanded[group.categoryId];
                return (
                  <div key={group.categoryId} className="bg-white border border-gray-100 rounded-3xl p-4">
                    <button
                      onClick={() => setShoppingCategoryExpanded(prev => ({ ...prev, [group.categoryId]: !isExpanded }))}
                      className="w-full flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-2xl">{group.categoryIcon}</span>
                        <div>
                          <p className="font-black text-gray-900">{group.categoryLabel}</p>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{group.items.length} item(ns)</p>
                        </div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
                        {group.items.map(item => (
                          <div key={item.id} className={`bg-white border-2 p-4 rounded-3xl flex flex-col gap-4 ${selectedShopItems[item.id] ? 'border-violet-500 bg-violet-50/30' : 'border-gray-50'}`}>
                            <div className="flex items-center gap-4">
                              <button onClick={() => setSelectedShopItems(prev => ({...prev, [item.id]: !prev[item.id]}))} className={selectedShopItems[item.id] ? 'text-violet-600' : 'text-gray-300'}>
                                {selectedShopItems[item.id] ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                              </button>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-800">{item.name}</h4>
                                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">+{item.neededQuantity} {getUnitLabel(item.unit, lang)}</p>
                              </div>
                            </div>
                            {selectedShopItems[item.id] && (
                              <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-violet-100">
                                <p className="text-xs font-bold text-violet-700">{t('purchasedQty')}:</p>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => setShopQuantities(prev => ({...prev, [item.id]: Math.max(0, (shopQuantities[item.id] || item.neededQuantity) - 1)}))} className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center"><Minus size={14}/></button>
                                  <span className="font-black">{shopQuantities[item.id] !== undefined ? shopQuantities[item.id] : item.neededQuantity}</span>
                                  <button onClick={() => setShopQuantities(prev => ({...prev, [item.id]: (shopQuantities[item.id] || item.neededQuantity) + 1}))} className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center"><Plus size={14}/></button>
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
                <button onClick={handleFinishPurchase} disabled={isLoading} className="w-full bg-violet-600 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3">
                  {isLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                  {t('finishPurchase')}
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'settings' && (
          <div className="space-y-8">
            <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-[2rem]">
              <div className="w-12 h-12 bg-violet-500 rounded-2xl flex items-center justify-center text-white"><UserIcon size={24} /></div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{currentUser?.name}</p>
                <p className="text-xs text-gray-400">{currentUser?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-3 text-red-400"><LogOut size={20} /></button>
            </div>
            
            <div className="p-6 bg-white border border-gray-100 rounded-[2rem] space-y-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Database size={18} className="text-violet-500" /> Status do Sistema
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-widest">Base de Dados</span>
                  <span className="text-green-500 font-bold">Conectado</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-widest">IA (Gemini)</span>
                  <span className="text-green-500 font-bold">Ativo</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-widest">Voz</span>
                  <span className="text-green-500 font-bold">Pronto</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'ai' && (
          <div className="space-y-6">
             <div className="flex items-center gap-2 text-violet-600"><Sparkles size={24} /><h2 className="text-xl font-bold">{t('aiTitle')}</h2></div>
             <div className="bg-white border-2 border-violet-50 p-6 rounded-[2.5rem] shadow-sm leading-relaxed text-gray-700 prose prose-violet text-sm">
                {isLoading ? <Loader2 className="animate-spin text-violet-500 mx-auto" /> : <div className="whitespace-pre-wrap">{aiSuggestions || "Nenhuma sugestão disponível."}</div>}
             </div>
             <button onClick={() => setCurrentView('dashboard')} className="w-full py-4 border-2 border-violet-500 text-violet-500 font-bold rounded-2xl">{t('back')}</button>
          </div>
        )}
      </main>

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
      </div>
      </div>
    </div>
  );
};

export default App;
