import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ShieldCheck, ShieldAlert, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { devLogin, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Fetch Google Client ID and environment config from backend
  useEffect(() => {
    const loadAuthConfig = async () => {
      try {
        const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (envClientId) {
          setGoogleClientId(envClientId);
        }
        const res = await api.get<{ google_client_id: string; is_dev?: boolean }>('/auth/config');
        if (res.data?.google_client_id && !envClientId) {
          setGoogleClientId(res.data.google_client_id);
        }
        // ONLY activate dev bypass mode if backend is in dev, Vite is in DEV mode, and running on localhost
        const isLocalhost = Boolean(
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]'
        );
        const devActive = Boolean(res.data?.is_dev) && Boolean(import.meta.env.DEV) && isLocalhost;
        setIsDevMode(devActive);
      } catch (e) {
        console.warn('Could not fetch auth config:', e);
        setIsDevMode(false);
      }
    };
    loadAuthConfig();
  }, []);

  // Optional bypass ONLY in local development when explicitly requested via URL (?bypass=true)
  useEffect(() => {
    if (!isDevMode) return;

    const params = new URLSearchParams(window.location.search);
    const forceBypass = params.get('bypass') === 'true';

    if (forceBypass) {
      executeBypass('Leodfernandez@gmail.com');
    }
  }, [isDevMode]);

  // Initialize Google Identity Services (GIS)
  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;

    const isMock = !googleClientId || googleClientId.includes('mock-google-client-id');
    if (isMock) return;

    const interval = setInterval(() => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        clearInterval(interval);
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: googleBtnRef.current.offsetWidth || 380,
          });
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [googleClientId]);

  const handleGoogleCredentialResponse = async (response: { credential: string }) => {
    if (!response.credential) return;
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle(response.credential);
    } catch {
      setError('Acceso denegado.');
    } finally {
      setLoading(false);
    }
  };

  const executeBypass = async (emailToUse: string = 'Leodfernandez@gmail.com') => {
    if (!isDevMode) return;
    setLoading(true);
    setError(null);
    try {
      await devLogin(emailToUse);
    } catch {
      setError('Acceso denegado.');
    } finally {
      setLoading(false);
    }
  };

  const isMockClient = !googleClientId || googleClientId.includes('mock-google-client-id');

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#09090b] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-8 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white m-0 tracking-tight">XION-PAY ADMIN</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Portal administrativo POS y conciliación. Acceso seguro.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google OAuth Section */}
        <div className="space-y-3">
          <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block">
            Autenticación con Google Workspace / Gmail:
          </label>

          {/* Official Google Identity Button container */}
          <div
            ref={googleBtnRef}
            className={`min-h-[44px] flex items-center justify-center ${isMockClient && isDevMode ? 'hidden' : ''}`}
          />

          {/* Fallback button strictly in mock development mode */}
          {isDevMode && isMockClient && (
            <button
              type="button"
              onClick={() => {
                loginWithGoogle('Leodfernandez@gmail.com').catch(() => {
                  setError('Acceso denegado.');
                });
              }}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 font-medium py-2.5 px-4 rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google Workspace</span>
            </button>
          )}

          {isDevMode && isMockClient && (
            <p className="text-[10px] text-slate-400 italic text-center">
              * Para habilitar el popup real de Google, define GOOGLE_CLIENT_ID en .env
            </p>
          )}
        </div>

        {/* Development Bypass Section - Completely removed in Production / Docker */}
        {isDevMode && (
          <div className="pt-2">
            <div className="relative flex py-1 items-center mb-3">
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-[10px] uppercase font-mono text-slate-400 dark:text-zinc-500">
                Solo Modo Desarrollo Local
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
            </div>

            <button
              type="button"
              onClick={() => executeBypass('Leodfernandez@gmail.com')}
              disabled={loading}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300/60 dark:border-amber-800/60 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>{loading ? 'Conectando...' : 'Bypass Login (Solo Modo Dev)'}</span>
            </button>
          </div>
        )}

        <div className="text-center pt-2 text-[10px] text-slate-400">
          Sesiones protegidas con tokens criptográficos JWT y cookies seguras.
        </div>
      </div>
    </div>
  );
};
