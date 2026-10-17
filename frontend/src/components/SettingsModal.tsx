import React, { useState, useEffect } from 'react';
import { X, DollarSign, Sliders, ShieldCheck, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { SystemSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRateUpdated: (newRate: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onRateUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'rate' | 'general' | 'security'>('rate');
  const [currentRate, setCurrentRate] = useState<number>(36.50);
  const [newRateInput, setNewRateInput] = useState<string>('36.50');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get<SystemSettings>('/settings');
      setCurrentRate(res.data.usd_ves_rate);
      setNewRateInput(res.data.usd_ves_rate.toString());
      setUpdatedAt(res.data.updated_at || null);
    } catch (err: any) {
      console.error('Error al obtener configuraciones:', err);
      setErrorMessage('No se pudo cargar la tasa de cambio actual.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newRateInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMessage('Por favor ingrese un valor de tasa válido mayor a 0.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.put<SystemSettings>('/settings/exchange-rate', {
        usd_ves_rate: parsed,
      });
      setCurrentRate(res.data.usd_ves_rate);
      setNewRateInput(res.data.usd_ves_rate.toString());
      setUpdatedAt(res.data.updated_at || new Date().toISOString());
      setSuccessMessage('Tasa de cambio actualizada correctamente en toda la base de datos.');
      onRateUpdated(res.data.usd_ves_rate);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error al actualizar tasa de cambio:', err);
      setErrorMessage(
        err.response?.data?.message || 'Error al guardar la nueva tasa de cambio.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const parsedInput = parseFloat(newRateInput.replace(',', '.')) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121215] rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-accent text-white flex items-center justify-center shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Configuración del Sistema
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Administración central de parámetros y variables globales de Xion-Pay
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Layout: Left Navigation + Right Content */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-56 bg-slate-50/80 dark:bg-zinc-900/30 border-r border-slate-200 dark:border-zinc-800 p-3 space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab('rate')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'rate'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Tasa de Cambio</span>
            </button>

            <button
              disabled
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 dark:text-zinc-600 opacity-60 cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <Sliders className="w-4 h-4" />
                <span>General</span>
              </div>
              <span className="text-[9px] bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-md font-mono">
                Próx.
              </span>
            </button>

            <button
              disabled
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 dark:text-zinc-600 opacity-60 cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Seguridad</span>
              </div>
              <span className="text-[9px] bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-md font-mono">
                Próx.
              </span>
            </button>
          </div>

          {/* Main Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'rate' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1 flex items-center space-x-2">
                    <span>Ajuste de Tasa Oficial USD / VES</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    La tasa registrada actualiza automáticamente la conciliación multimoneda, la conversión de MRR y los recibos de cobro del sistema en la base de datos.
                  </p>
                </div>

                {/* Notifications */}
                {successMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Current vs New Form Card */}
                <form onSubmit={handleSaveRate} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Current Active Rate */}
                    <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Tasa Actual en BD
                      </span>
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                          {loading ? '...' : `${currentRate.toFixed(2)}`}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Bs / USD</span>
                      </div>
                      {updatedAt && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-2 block">
                          Última mod.: {new Date(updatedAt).toLocaleString('es-VE')}
                        </span>
                      )}
                    </div>

                    {/* New Rate Input */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-2xl p-4 shadow-xs focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all">
                      <label htmlFor="new_rate_field" className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block mb-1">
                        Nueva Tasa (VES por 1 USD)
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          id="new_rate_field"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={newRateInput}
                          onChange={(e) => setNewRateInput(e.target.value)}
                          className="w-full text-xl font-mono font-bold text-slate-900 dark:text-white bg-transparent focus:outline-hidden"
                          placeholder="Ej: 36.50"
                          required
                        />
                        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 shrink-0">Bs</span>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-2">
                        {[0.5, 1.0, 2.0].map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => {
                              const curr = parseFloat(newRateInput) || currentRate;
                              setNewRateInput((curr + inc).toFixed(2));
                            }}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] font-mono font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                          >
                            +{inc.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Impact Preview */}
                  <div className="bg-slate-900 dark:bg-zinc-950 border border-slate-800 dark:border-zinc-800 text-white rounded-2xl p-4 text-xs space-y-2 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Simulación de Conversión Directa
                    </span>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block">$10.00 USD</span>
                        <span className="font-bold text-emerald-400">
                          {(10 * parsedInput).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">$50.00 USD</span>
                        <span className="font-bold text-emerald-400">
                          {(50 * parsedInput).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">$100.00 USD</span>
                        <span className="font-bold text-emerald-400">
                          {(100 * parsedInput).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving || loading}
                      className="px-5 py-2.5 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Guardando en BD...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Actualizar Tasa Global</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
