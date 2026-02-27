
import React, { useState, useEffect, useRef } from 'react';
import { Product, ViewType, User, Language } from './types';
import { getSmartSuggestions } from './services/gemini';
import { createTranslator, DEFAULT_LANGUAGE, resolveLanguage, TranslationKey } from './i18n';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import { BottomNav } from './components/BottomNav';
import { VoiceAssistantOverlay } from './components/VoiceAssistantOverlay';
import { ProductFormModal } from './components/ProductFormModal';
import { DbSetupErrorScreen } from './components/screens/DbSetupErrorScreen';
import { MissingConfigScreen } from './components/screens/MissingConfigScreen';
import { AuthScreen } from './components/screens/AuthScreen';
import { MainAppLayout } from './components/screens/MainAppLayout';
import { ProductFormData, useProductActions } from './hooks/useProductActions';
import { useAuthentication } from './hooks/useAuthentication';
import { IS_CONFIGURED, supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './services/supabase';
import { useDatabaseSetup } from './hooks/useDatabaseSetup';

const App: React.FC = () => {
  type ThemeMode = 'light' | 'dark';

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [pantry, setPantry] = useState<Product[]>([]);
  const pantryRef = useRef<Product[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('auth');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [dbTableError, setDbTableError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    category: 'others',
    currentQuantity: 0,
    minQuantity: 1,
    unit: 'un'
  });

  const [selectedShopItems, setSelectedShopItems] = useState<Record<string, boolean>>({});
  const [shopQuantities, setShopQuantities] = useState<Record<string, number>>({});

  useEffect(() => { pantryRef.current = pantry; }, [pantry]);
  const t = createTranslator(lang);

  const { sqlSetupScript, supabaseDashboardUrl, handleCopySql } = useDatabaseSetup({
    supabaseUrl: SUPABASE_URL
  });

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang) setLang(resolveLanguage(savedLang));

    const savedTheme = localStorage.getItem('app_theme') as ThemeMode | null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, []);


  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('app_theme', theme);
  }, [theme]);





  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProductId(null);
    setFormData({ name: '', category: 'others', currentQuantity: 0, minQuantity: 1, unit: 'un' });
  };

  const {
    loadPantryData,
    handleFinishPurchase,
    updateQuantity,
    handleSaveProduct,
    handleDeleteProduct,
    handleEditClick
  } = useProductActions({
    currentUser,
    isConfigured: IS_CONFIGURED,
    pantry,
    selectedShopItems,
    shopQuantities,
    editingProductId,
    formData,
    supabase,
    setIsLoading,
    setIsDataLoading,
    setDbTableError,
    setSelectedShopItems,
    setShopQuantities,
    setCurrentView,
    setPantry,
    setEditingProductId,
    setFormData,
    setIsModalOpen
  });

  const {
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
  } = useAuthentication({
    supabase,
    isConfigured: IS_CONFIGURED,
    loadPantryData,
    setCurrentView,
    setCurrentUser,
    setPantry,
    setIsDataLoading,
    setDbTableError,
    currentView
  });

  const { isVoiceActive, voiceLog, startVoiceSession, stopVoiceSession } = useVoiceAssistant({
    currentUser,
    isConfigured: IS_CONFIGURED,
    supabase,
    loadPantryData,
    t,
    lang
  });

  const handleFetchAiSuggestions = async () => {
    if (pantry.length === 0) return;
    setIsLoading(true);
    const text = await getSmartSuggestions(pantry, lang);
    setAiSuggestions(text);
    setIsLoading(false);
    setCurrentView('ai');
  };

  if (dbTableError) {
    return (
      <DbSetupErrorScreen
        dbTableError={dbTableError}
        sqlSetupScript={sqlSetupScript}
        supabaseUrl={supabaseDashboardUrl}
        onCopySql={handleCopySql}
      />
    );
  }

  if (!IS_CONFIGURED) {
    return (
      <MissingConfigScreen
        supabaseUrl={SUPABASE_URL}
        supabaseKey={SUPABASE_ANON_KEY}
        googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}
      />
    );
  }

  if (currentView === 'auth') {
    return (
      <AuthScreen
        isRegistering={isRegistering}
        googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}
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
