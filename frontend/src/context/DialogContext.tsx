import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showAlert: (message: string, title?: string, type?: 'info' | 'error' | 'success') => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: 'danger' | 'warning' | 'info';
    resolve: (val: boolean) => void;
  } | null>(null);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success';
    resolve: () => void;
  } | null>(null);

  // Toasts State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      setConfirmState({
        isOpen: true,
        title: opts.title || '¿Confirmar acción?',
        message: opts.message,
        confirmText: opts.confirmText || 'Sí, confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        variant: opts.variant || 'warning',
        resolve: (result: boolean) => {
          setConfirmState(null);
          resolve(result);
        },
      });
    });
  }, []);

  const showAlert = useCallback((message: string, title?: string, type: 'info' | 'error' | 'success' = 'info'): Promise<void> => {
    return new Promise<void>((resolve) => {
      setAlertState({
        isOpen: true,
        title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : 'Notificación'),
        message,
        type,
        resolve: () => {
          setAlertState(null);
          resolve();
        },
      });
    });
  }, []);

  // Intercept window.alert globally as a safety fallback to display modern toasts
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      showToast(String(msg), 'info');
    };
    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  return (
    <DialogContext.Provider value={{ confirm, showToast, showAlert }}>
      {children}

      {/* Confirmation Modal (Y/N) */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 scale-in-95 duration-150 animate-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start space-x-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.variant === 'danger'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                    : confirmState.variant === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                }`}
              >
                {confirmState.variant === 'danger' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : confirmState.variant === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  {confirmState.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1.5 whitespace-pre-line leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer"
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                  confirmState.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmState.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-200'
                }`}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal (Information / Error Detail) */}
      {alertState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in scale-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start space-x-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  alertState.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                    : alertState.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                }`}
              >
                {alertState.type === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : alertState.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  {alertState.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1.5 whitespace-pre-line leading-relaxed">
                  {alertState.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => alertState.resolve()}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-top-2 fade-in ${
              toast.type === 'success'
                ? 'bg-white dark:bg-[#121215] border-emerald-300 dark:border-emerald-800 text-slate-800 dark:text-zinc-200'
                : toast.type === 'error'
                ? 'bg-white dark:bg-[#121215] border-rose-300 dark:border-rose-800 text-slate-800 dark:text-zinc-200'
                : toast.type === 'warning'
                ? 'bg-white dark:bg-[#121215] border-amber-300 dark:border-amber-800 text-slate-800 dark:text-zinc-200'
                : 'bg-white dark:bg-[#121215] border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
            </div>
            <div className="flex-1 text-xs whitespace-pre-line leading-relaxed font-medium">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer shrink-0"
              title="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
