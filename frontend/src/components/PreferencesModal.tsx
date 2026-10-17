import React from 'react';
import { usePreferences, type ThemeMode, type ThemeAccent, type FontSize } from '../context/PreferencesContext';
import { X, Sun, Moon, Laptop, Type, Palette, RotateCcw, Check, Contrast } from 'lucide-react';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const {
    mode,
    accent,
    fontSize,
    highContrast,
    resolvedMode,
    setMode,
    setAccent,
    setFontSize,
    setHighContrast,
    resetDefaults,
  } = usePreferences();

  if (!isOpen) return null;

  const modeOptions: { id: ThemeMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'dark', label: 'Oscuro', icon: Moon },
    { id: 'system', label: 'Sistema', icon: Laptop },
  ];

  const accentOptions: { id: ThemeAccent; label: string; color: string; bgClass: string }[] = [
    { id: 'monochrome', label: 'Monocromo', color: '#18181b', bgClass: 'bg-zinc-900 dark:bg-white' },
    { id: 'emerald', label: 'Esmeralda', color: '#10b981', bgClass: 'bg-emerald-500' },
    { id: 'indigo', label: 'Índigo', color: '#4f46e5', bgClass: 'bg-indigo-600' },
    { id: 'blue', label: 'Zafiro', color: '#2563eb', bgClass: 'bg-blue-600' },
    { id: 'violet', label: 'Violeta', color: '#7c3aed', bgClass: 'bg-violet-600' },
    { id: 'amber', label: 'Ámbar', color: '#f59e0b', bgClass: 'bg-amber-500' },
    { id: 'rose', label: 'Rosa Carmesí', color: '#f43f5e', bgClass: 'bg-rose-500' },
    { id: 'cyan', label: 'Cian Océano', color: '#06b6d4', bgClass: 'bg-cyan-500' },
    { id: 'orange', label: 'Naranja', color: '#f97316', bgClass: 'bg-orange-500' },
    { id: 'titanium', label: 'Titanio', color: '#64748b', bgClass: 'bg-slate-500' },
  ];

  const fontOptions: { id: FontSize; label: string; desc: string }[] = [
    { id: 'sm', label: 'Compacta', desc: '13px' },
    { id: 'md', label: 'Estándar', desc: '14px' },
    { id: 'lg', label: 'Amplia', desc: '16px' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center">
              <Palette className="w-4 h-4 text-slate-900 dark:text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white m-0">
                Preferencias de Interfaz
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 m-0">
                Ajuste visual de temas, contraste y tipografía
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 1. Theme Mode (Light / Dark / System) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center space-x-1.5">
              <span>Modo de Apariencia</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {modeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setMode(opt.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. High Contrast Toggle */}
          <div className="bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-800 dark:text-zinc-200">
                <Contrast className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Alto Contraste Estricto
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                  Fondos puros y bordes definidos para máxima legibilidad
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHighContrast(!highContrast)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                highContrast ? 'bg-black dark:bg-white' : 'bg-slate-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white dark:bg-black transition-transform ${
                  highContrast ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Theme Accents */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Paleta y Acentos
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {accentOptions.map((opt) => {
                const isSelected = accent === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setAccent(opt.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 bg-slate-100 dark:bg-zinc-800 shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full ${opt.bgClass} flex items-center justify-center shadow-xs transition-transform ${isSelected ? 'scale-110' : ''}`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white dark:text-black stroke-[3]" />}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 text-center truncate w-full">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Font Size */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center space-x-1.5">
              <Type className="w-3.5 h-3.5" />
              <span>Escala Tipográfica</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {fontOptions.map((opt) => {
                const isSelected = fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setFontSize(opt.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">{opt.label}</span>
                    <span className="text-[10px] opacity-70 block font-mono">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Live Preview Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/60 dark:bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              <span>Vista previa de contraste y acento</span>
              <span className="font-mono text-[10px]">
                {resolvedMode === 'dark' ? 'Modo Oscuro' : 'Modo Claro'} · {fontSize.toUpperCase()}
              </span>
            </div>
            <div className="p-3 bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white m-0">
                  Xion-Pay Licenciamiento
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 m-0">
                  Contraste optimizado para lectura y auditoría continua
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-accent">
                Activo
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={resetDefaults}
            className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-accent text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
