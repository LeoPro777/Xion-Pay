import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, ArrowRight, ShieldAlert, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { devLogin } = useAuth();
  const [devEmail, setDevEmail] = useState<string>('admin@xionpay.internal');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-bypass if ?bypass=true query param is provided
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bypass') === 'true') {
      executeBypass('admin@xionpay.internal');
    }
  }, []);

  const executeBypass = async (emailToUse: string) => {
    setLoading(true);
    setError(null);
    try {
      await devLogin(emailToUse);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error autenticando con lista blanca.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    executeBypass(devEmail);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-2xl p-8 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 m-0 tracking-tight">XION-PAY ADMIN</h1>
          <p className="text-xs text-slate-500">
            Portal administrativo POS y conciliación. Acceso seguro.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Bypass Button */}
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2.5">
          <div className="flex items-center space-x-2 text-amber-800">
            <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Acceso Directo / Bypass Rápido
            </span>
          </div>
          <p className="text-[11px] text-slate-600">
            Ingresa al panel administrativo en 1 clic utilizando el perfil maestro{' '}
            <code className="text-amber-900 bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[10px]">admin@xionpay.internal</code>.
          </p>
          <button
            type="button"
            onClick={() => executeBypass('admin@xionpay.internal')}
            disabled={loading}
            className="w-full py-2.5 bg-[#18181b] hover:bg-black text-white font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>{loading ? 'Conectando...' : 'Bypass Login (Entrar como Superadmin)'}</span>
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-[10px] uppercase font-mono text-slate-400">
            o Autenticación Estándar
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Google OAuth Section */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              alert(
                'Para inicio con Google en producción, configura GOOGLE_CLIENT_ID en .env. Utiliza el botón de Bypass arriba para entrar de inmediato.'
              );
            }}
            className="w-full flex items-center justify-center space-x-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-medium py-2.5 px-4 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
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
        </div>

        {/* Custom Whitelisted Dev Form */}
        <form onSubmit={handleDevLogin} className="space-y-3 pt-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Ingresar con otro correo de lista blanca:
            </label>
            <input
              type="email"
              required
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-800 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer border border-slate-200"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{loading ? 'Verificando Sesión...' : 'Ingresar con este correo'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center pt-2 text-[10px] text-slate-400">
          Sesiones protegidas con tokens criptográficos JWT y cookies seguras.
        </div>
      </div>
    </div>
  );
};

