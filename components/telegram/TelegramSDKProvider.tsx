'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MOCK_TELEGRAM_USER, type MockTelegramUser } from '@/lib/telegram/mock-data';

// =============================================================================
// TYPES
// =============================================================================

interface ThemeParams {
  backgroundColor: string;
  textColor: string;
  hintColor: string;
  linkColor: string;
  buttonColor: string;
  buttonTextColor: string;
  secondaryBackgroundColor: string;
}

interface TelegramSDKContextType {
  // Estado
  isReady: boolean;
  isMock: boolean;
  isDark: boolean;

  // Usuário
  user: MockTelegramUser | null;
  isLinked: boolean;

  // Theme
  themeParams: ThemeParams;

  // Actions
  setIsLinked: (linked: boolean) => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
  hapticFeedback: (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
  close: () => void;
  expand: () => void;
  requestFullscreen: () => void;
}

// =============================================================================
// DEFAULT THEME (Dark mode - estilo Telegram)
// =============================================================================

const DARK_THEME: ThemeParams = {
  backgroundColor: '#18181b',      // zinc-900
  textColor: '#fafafa',            // zinc-50
  hintColor: '#a1a1aa',            // zinc-400
  linkColor: '#60a5fa',            // blue-400
  buttonColor: '#22c55e',          // green-500 (primary SmartZap)
  buttonTextColor: '#ffffff',
  secondaryBackgroundColor: '#27272a', // zinc-800
};

const LIGHT_THEME: ThemeParams = {
  backgroundColor: '#ffffff',
  textColor: '#18181b',
  hintColor: '#71717a',
  linkColor: '#2563eb',
  buttonColor: '#16a34a',
  buttonTextColor: '#ffffff',
  secondaryBackgroundColor: '#f4f4f5',
};

// =============================================================================
// CONTEXT
// =============================================================================

const TelegramSDKContext = createContext<TelegramSDKContextType | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface TelegramSDKProviderProps {
  children: ReactNode;
}

export function TelegramSDKProvider({ children }: TelegramSDKProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isDark, setIsDark] = useState(true); // Sempre dark mode
  const [isLinked, setIsLinked] = useState(MOCK_TELEGRAM_USER.isLinked);
  const [isMock, setIsMock] = useState(true);

  // Sempre usar dark theme (UI foi desenhada para isso)
  const themeParams = DARK_THEME;

  // Inicialização
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Verificar se estamos no Telegram
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // Verificar se realmente estamos dentro do Telegram
      // Se platform é 'unknown' ou vazio, estamos no browser normal
      const isRealTelegram = tg.platform && tg.platform !== 'unknown';

      if (!isRealTelegram) {
        console.log('📱 Telegram SDK loaded but running in browser (mock mode)');
        setIsMock(true);
        setIsReady(true);
        return;
      }

      setIsMock(false);
      console.log('📱 Telegram WebApp detected, version:', tg.version, 'platform:', tg.platform);

      // Sinalizar que estamos prontos
      tg.ready();

      // Função para expandir e tentar fullscreen (com tratamento defensivo)
      const setupViewport = () => {
        // Expandir para altura máxima (sempre suportado)
        try {
          tg.expand();
        } catch (e) {
          console.log('expand() failed:', e);
        }

        // Verificar versão para evitar erros
        const version = parseFloat(tg.version) || 0;
        console.log(`📱 Telegram version: ${version}`);

        // setHeaderColor e setBackgroundColor (Bot API 6.1+)
        if (version >= 6.1) {
          try {
            if (typeof tg.setHeaderColor === 'function') {
              tg.setHeaderColor('#18181b');
            }
            if (typeof tg.setBackgroundColor === 'function') {
              tg.setBackgroundColor('#18181b');
            }
          } catch (e) {
            // Silenciosamente ignorar - não quebrar o app
          }
        }

        // requestFullscreen (Bot API 8.0+)
        if (version >= 8.0) {
          try {
            if (typeof tg.requestFullscreen === 'function') {
              tg.requestFullscreen();
              console.log('📱 Fullscreen requested');
            }
          } catch (e) {
            // Silenciosamente ignorar
          }
        }

        // disableVerticalSwipes (Bot API 7.7+)
        if (version >= 7.7) {
          try {
            if (typeof tg.disableVerticalSwipes === 'function') {
              tg.disableVerticalSwipes();
            }
          } catch (e) {
            // Silenciosamente ignorar
          }
        }
      };

      // Executar imediatamente
      setupViewport();

      // Tentar novamente após 500ms apenas se versão suporta recursos avançados
      const version = parseFloat(tg.version) || 0;
      if (version >= 7.0) {
        setTimeout(setupViewport, 500);
      }

      // Forçar dark mode independente do Telegram
      setIsDark(true);

      // Aplicar SEMPRE o dark theme (ignorar themeParams do Telegram)
      const root = document.documentElement;
      root.style.setProperty('--tg-theme-bg-color', DARK_THEME.backgroundColor);
      root.style.setProperty('--tg-theme-text-color', DARK_THEME.textColor);
      root.style.setProperty('--tg-theme-hint-color', DARK_THEME.hintColor);
      root.style.setProperty('--tg-theme-link-color', DARK_THEME.linkColor);
      root.style.setProperty('--tg-theme-button-color', DARK_THEME.buttonColor);
      root.style.setProperty('--tg-theme-button-text-color', DARK_THEME.buttonTextColor);
      root.style.setProperty('--tg-theme-secondary-bg-color', DARK_THEME.secondaryBackgroundColor);
      root.classList.add('dark');

      setIsReady(true);
      console.log('📱 Telegram Mini App initialized (forced dark mode)');
      return;
    }

    // Mock mode
    setIsMock(true);
    console.log('🤖 Telegram Mock Mode');

    // Simular delay de inicialização
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Aplicar CSS variables do theme (mock mode) - sempre dark
  useEffect(() => {
    if (typeof window === 'undefined' || !isMock) return;

    const root = document.documentElement;
    root.style.setProperty('--tg-theme-bg-color', DARK_THEME.backgroundColor);
    root.style.setProperty('--tg-theme-text-color', DARK_THEME.textColor);
    root.style.setProperty('--tg-theme-hint-color', DARK_THEME.hintColor);
    root.style.setProperty('--tg-theme-link-color', DARK_THEME.linkColor);
    root.style.setProperty('--tg-theme-button-color', DARK_THEME.buttonColor);
    root.style.setProperty('--tg-theme-button-text-color', DARK_THEME.buttonTextColor);
    root.style.setProperty('--tg-theme-secondary-bg-color', DARK_THEME.secondaryBackgroundColor);
    root.classList.add('dark');
  }, [isMock]);

  // Actions
  const showAlert = (message: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(message);
    } else {
      alert(`[Telegram Alert]\n${message}`);
    }
  };

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const tg = window.Telegram?.WebApp;
      if (tg?.showConfirm) {
        tg.showConfirm(message, resolve);
      } else {
        resolve(confirm(`[Telegram Confirm]\n${message}`));
      }
    });
  };

  const hapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    const hf = window.Telegram?.WebApp?.HapticFeedback;
    if (hf) {
      if (['light', 'medium', 'heavy'].includes(type)) {
        hf.impactOccurred(type as 'light' | 'medium' | 'heavy');
      } else {
        hf.notificationOccurred(type as 'success' | 'warning' | 'error');
      }
    } else {
      console.log(`📳 Haptic: ${type}`);
    }
  };

  const close = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.close) {
      tg.close();
    } else {
      console.log('🚪 Mini App close (mock)');
    }
  };

  const expand = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.expand) {
      tg.expand();
    } else {
      console.log('📐 Mini App expand (mock)');
    }
  };

  const requestFullscreen = () => {
    const tg = window.Telegram?.WebApp;
    if (tg && typeof (tg as any).requestFullscreen === 'function') {
      (tg as any).requestFullscreen();
    } else {
      console.log('📐 Fullscreen not supported (mock)');
    }
  };

  const contextValue: TelegramSDKContextType = {
    isReady,
    isMock,
    isDark,
    user: MOCK_TELEGRAM_USER,
    isLinked,
    themeParams,
    setIsLinked,
    showAlert,
    showConfirm,
    hapticFeedback,
    close,
    expand,
    requestFullscreen,
  };

  return (
    <TelegramSDKContext.Provider value={contextValue}>
      {children}
    </TelegramSDKContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useTelegramSDK() {
  const context = useContext(TelegramSDKContext);
  if (!context) {
    throw new Error('useTelegramSDK must be used within TelegramSDKProvider');
  }
  return context;
}

// =============================================================================
// TYPES DECLARATION (para window.Telegram)
// =============================================================================

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        // Core
        ready: () => void;
        expand: () => void;
        close: () => void;

        // Fullscreen (Bot API 8.0+)
        requestFullscreen?: () => void;
        exitFullscreen?: () => void;
        isFullscreen?: boolean;

        // Swipes (Bot API 7.7+)
        disableVerticalSwipes?: () => void;
        enableVerticalSwipes?: () => void;
        isVerticalSwipesEnabled?: boolean;

        // Theme
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
          header_bg_color?: string;
          accent_text_color?: string;
          section_bg_color?: string;
          section_header_text_color?: string;
          subtitle_text_color?: string;
          destructive_text_color?: string;
        };

        // Popups
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text?: string;
          }>;
        }, callback?: (buttonId: string) => void) => void;

        // Buttons
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setParams: (params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        SettingsButton?: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };

        // Haptic
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
          selectionChanged: () => void;
        };

        // User data
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          receiver?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          chat?: {
            id: number;
            type: 'group' | 'supergroup' | 'channel';
            title: string;
            username?: string;
            photo_url?: string;
          };
          chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
          chat_instance?: string;
          start_param?: string;
          can_send_after?: number;
          auth_date: number;
          hash: string;
        };

        // Viewport
        viewportHeight: number;
        viewportStableHeight: number;
        isExpanded: boolean;

        // Platform
        platform: string;
        version: string;

        // Cloud Storage
        CloudStorage?: {
          setItem: (key: string, value: string, callback?: (error: Error | null, success?: boolean) => void) => void;
          getItem: (key: string, callback: (error: Error | null, value?: string) => void) => void;
          getItems: (keys: string[], callback: (error: Error | null, values?: Record<string, string>) => void) => void;
          removeItem: (key: string, callback?: (error: Error | null, success?: boolean) => void) => void;
          removeItems: (keys: string[], callback?: (error: Error | null, success?: boolean) => void) => void;
          getKeys: (callback: (error: Error | null, keys?: string[]) => void) => void;
        };

        // Biometric
        BiometricManager?: {
          isInited: boolean;
          isBiometricAvailable: boolean;
          biometricType: 'finger' | 'face' | 'unknown';
          isAccessRequested: boolean;
          isAccessGranted: boolean;
          isBiometricTokenSaved: boolean;
          deviceId: string;
          init: (callback?: () => void) => void;
          requestAccess: (params: { reason?: string }, callback?: (granted: boolean) => void) => void;
          authenticate: (params: { reason?: string }, callback?: (success: boolean, token?: string) => void) => void;
          updateBiometricToken: (token: string, callback?: (updated: boolean) => void) => void;
          openSettings: () => void;
        };

        // Events
        onEvent: (eventType: string, callback: () => void) => void;
        offEvent: (eventType: string, callback: () => void) => void;

        // Utils
        sendData: (data: string) => void;
        switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
        readTextFromClipboard: (callback?: (text: string | null) => void) => void;
        requestWriteAccess: (callback?: (granted: boolean) => void) => void;
        requestContact: (callback?: (shared: boolean) => void) => void;
        setHeaderColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void;
        setBackgroundColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
      };
    };
  }
}
