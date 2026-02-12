import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { SupabaseClient } from '@supabase/supabase-js';
import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { TranslationKey } from '../i18n';
import { Product, Unit, User } from '../types';
import { API_KEY } from '../services/gemini';
import { findBestPantryItemByName, inferVoiceIntent, normalizeVoiceCategory, normalizeVoiceUnit } from '../voiceUtils';
import { createPantryItem, updatePantryItemQuantity } from './useProductActions';

interface UseVoiceAssistantParams {
  currentUser: User | null;
  isConfigured: boolean;
  pantryRef: MutableRefObject<Product[]>;
  supabase: SupabaseClient;
  loadPantryData: (pantryId: string) => Promise<void>;
  t: (key: TranslationKey) => string;
}

interface VoiceSessionRuntime {
  session: any | null;
  mediaStream: MediaStream | null;
  inputSource: MediaStreamAudioSourceNode | null;
  inputProcessor: ScriptProcessorNode | null;
  isListening: boolean;
  hasDetectedFirstRequest: boolean;
  autoCloseFallbackId: number | null;
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

export function useVoiceAssistant({ currentUser, isConfigured, pantryRef, supabase, loadPantryData, t }: UseVoiceAssistantParams) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLog, setVoiceLog] = useState('');
  const sessionRef = useRef<VoiceSessionRuntime>({
    session: null,
    mediaStream: null,
    inputSource: null,
    inputProcessor: null,
    isListening: false,
    hasDetectedFirstRequest: false,
    autoCloseFallbackId: null
  });
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const voiceQueueRef = useRef<Promise<void>>(Promise.resolve());

  const clearAutoCloseFallback = useCallback(() => {
    if (sessionRef.current.autoCloseFallbackId !== null) {
      window.clearTimeout(sessionRef.current.autoCloseFallbackId);
      sessionRef.current.autoCloseFallbackId = null;
    }
  }, []);

  const stopListeningInput = useCallback(() => {
    sessionRef.current.isListening = false;

    if (sessionRef.current.inputProcessor) {
      sessionRef.current.inputProcessor.disconnect();
      sessionRef.current.inputProcessor.onaudioprocess = null;
      sessionRef.current.inputProcessor = null;
    }

    if (sessionRef.current.inputSource) {
      sessionRef.current.inputSource.disconnect();
      sessionRef.current.inputSource = null;
    }

    if (sessionRef.current.mediaStream) {
      sessionRef.current.mediaStream.getTracks().forEach((track) => track.stop());
      sessionRef.current.mediaStream = null;
    }
  }, []);


  const refreshPantryInBackground = useCallback((pantryId: string) => {
    loadPantryData(pantryId).catch((error) => {
      console.error('Erro ao recarregar despensa após comando de voz:', error);
    });
  }, [loadPantryData]);

  const applyVoicePantryUpdate = useCallback(async (args: any) => {
    if (!currentUser || !isConfigured) {
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

        const { error } = await createPantryItem({
          supabase,
          payload: payload as {
            pantry_id: string;
            name: string;
            category: string;
            current_quantity: number;
            min_quantity: number;
            unit: Unit;
            updated_at: string;
          }
        });

        if (error) throw error;

        refreshPantryInBackground(currentUser.pantryId);
        const message = t('productCreated').replace('{name}', productName);
        setVoiceLog(message);
        return { status: 'created', message, name: productName, quantity: amount, category, unit };
      }

      const target = existingItem as Product;
      const newQty = intent === 'consume'
        ? Math.max(0, target.currentQuantity - amount)
        : target.currentQuantity + amount;

      const { error } = await updatePantryItemQuantity({
        supabase,
        id: target.id,
        quantity: newQty
      });

      if (error) throw error;

      refreshPantryInBackground(currentUser.pantryId);
      const message = t('quantityUpdated').replace('{name}', target.name);
      setVoiceLog(message);
      return { status: 'updated', message, id: target.id, quantity: newQty, category: target.category, unit: target.unit };
    } catch (error: any) {
      const message = `Erro ao atualizar estoque por voz: ${error.message}`;
      setVoiceLog(message);
      return { status: 'error', message };
    }
  }, [currentUser, isConfigured, pantryRef, t, supabase, refreshPantryInBackground]);

  const stopVoiceSession = useCallback((options?: { clearLog?: boolean }) => {
    setIsVoiceActive(false);
    if (options?.clearLog) {
      setVoiceLog('');
    }

    clearAutoCloseFallback();
    stopListeningInput();
    voiceQueueRef.current = Promise.resolve();
    sessionRef.current.hasDetectedFirstRequest = false;

    if (sessionRef.current.session) {
      try {
        sessionRef.current.session.close();
      } catch (_err) {
        // ignore close errors
      }
      sessionRef.current.session = null;
    }

    for (const source of sourcesRef.current) {
      try {
        source.stop();
      } catch (_err) {
        // ignore stop errors
      }
    }
    sourcesRef.current.clear();

    if (audioContextsRef.current) {
      const { input, output } = audioContextsRef.current;
      if (input.state !== 'closed') input.close().catch(() => {});
      if (output.state !== 'closed') output.close().catch(() => {});
      audioContextsRef.current = null;
    }
  }, [clearAutoCloseFallback, stopListeningInput]);

  const enqueueVoiceToolCall = useCallback((functionCall: any, sessionPromise: Promise<any>) => {
    voiceQueueRef.current = voiceQueueRef.current
      .then(async () => {
        const result = await applyVoicePantryUpdate(functionCall.args);
        const session = await sessionPromise;

        const toolResponse = {
          ...result,
          message: undefined,
          responseLanguage: 'match_user_current_utterance'
        };

        session.sendToolResponse({ functionResponses: { id: functionCall.id, name: functionCall.name, response: toolResponse } });
      })
      .catch((error) => {
        console.error('Erro na fila de comandos de voz:', error);
      });
  }, [applyVoicePantryUpdate]);

  const startVoiceSession = useCallback(async () => {
    if (isVoiceActive) return;

    try {
      setIsVoiceActive(true);
      setVoiceLog('');
      sessionRef.current.hasDetectedFirstRequest = false;
      const ai = new GoogleGenAI({ apiKey: API_KEY || '' });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sessionRef.current.mediaStream = stream;
      sessionRef.current.isListening = true;

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
            unit: { type: Type.STRING, description: 'Optional. Infer the most likely unit (un, kg, l, g, ml, package, box).' },
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
            const scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
            sessionRef.current.inputSource = source;
            sessionRef.current.inputProcessor = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              if (!sessionRef.current.isListening) return;
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
                  if (!sessionRef.current.hasDetectedFirstRequest) {
                    sessionRef.current.hasDetectedFirstRequest = true;
                    stopListeningInput();
                    clearAutoCloseFallback();
                    sessionRef.current.autoCloseFallbackId = window.setTimeout(() => {
                      stopVoiceSession({ clearLog: true });
                    }, 10000);
                  }
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
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sessionRef.current.hasDetectedFirstRequest && sourcesRef.current.size === 0) {
                  clearAutoCloseFallback();
                  stopVoiceSession({ clearLog: true });
                }
              };
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
1) Responda no idioma da fala atual do usuário (pt-BR quando o usuário falar português; en-US quando o usuário falar inglês).
2) Nunca misture idiomas na mesma resposta.
3) Não use o idioma do app para decidir a resposta; use apenas o idioma detectado no áudio do usuário.
4) O campo responseLanguage do tool response é apenas um lembrete para manter o idioma da fala do usuário.

Ao chamar updatePantryQuantity:
- use intent='consume' para consumo e intent='add' para adição;
- amount sempre positivo;
- infira unit e category quando houver evidência na fala; se faltar unit/category, envie vazio;
- em productName, preserve exatamente o nome falado pelo usuário (mesmo idioma, sem tradução, sem normalização, sem singularizar/pluralizar).`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });

      sessionRef.current.session = await sessionPromise;
    } catch (_err) {
      setIsVoiceActive(false);
    }
  }, [clearAutoCloseFallback, enqueueVoiceToolCall, isVoiceActive, stopListeningInput, stopVoiceSession]);

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  return {
    isVoiceActive,
    voiceLog,
    setVoiceLog,
    startVoiceSession,
    stopVoiceSession
  };
}
