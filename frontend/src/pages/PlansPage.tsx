import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import type { Plan } from '../types';
import { Layers, Check, Cpu, Store, PlusCircle, Edit3, X, Save } from 'lucide-react';

export const PlansPage: React.FC = () => {
  const { showToast } = useDialog();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form fields
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priceUsd, setPriceUsd] = useState<number>(50);
  const [maxBranches, setMaxBranches] = useState<number>(1);
  const [maxPosRegisters, setMaxPosRegisters] = useState<number>(2);
  const [quarterlyDiscountPct, setQuarterlyDiscountPct] = useState<number>(5);
  const [annualDiscountPct, setAnnualDiscountPct] = useState<number>(15);
  const [featInventory, setFeatInventory] = useState<boolean>(true);
  const [featAudit, setFeatAudit] = useState<boolean>(false);
  const [featApi, setFeatApi] = useState<boolean>(false);

  const fetchPlans = async () => {
    try {
      const res = await api.get<Plan[]>('/plans');
      setPlans(res.data);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setCode('');
    setName('');
    setDescription('');
    setPriceUsd(49.99);
    setMaxBranches(1);
    setMaxPosRegisters(2);
    setQuarterlyDiscountPct(5);
    setAnnualDiscountPct(15);
    setFeatInventory(true);
    setFeatAudit(false);
    setFeatApi(false);
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setCode(plan.code);
    setName(plan.name);
    setDescription(plan.description || '');
    setPriceUsd(plan.price_usd);
    setMaxBranches(plan.max_branches);
    setMaxPosRegisters(plan.max_pos_registers);
    setQuarterlyDiscountPct(plan.quarterly_discount_pct);
    setAnnualDiscountPct(plan.annual_discount_pct);
    setFeatInventory(!!plan.features?.inventory_transfers);
    setFeatAudit(!!plan.features?.advanced_audit);
    setFeatApi(!!plan.features?.external_api);
    setShowModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      code,
      name,
      description,
      price_usd: priceUsd,
      max_branches: maxBranches,
      max_pos_registers: maxPosRegisters,
      quarterly_discount_pct: quarterlyDiscountPct,
      annual_discount_pct: annualDiscountPct,
      features: {
        inventory_transfers: featInventory,
        advanced_audit: featAudit,
        external_api: featApi,
      },
    };

    try {
      if (editingPlan) {
        // PATCH update
        await api.patch(`/plans/${editingPlan.id}`, payload);
      } else {
        // POST create
        await api.post('/plans', payload);
      }
      showToast(editingPlan ? 'Plan actualizado exitosamente.' : 'Plan creado exitosamente.', 'success');
      setShowModal(false);
      await fetchPlans();
    } catch (err: any) {
      showToast(`Error al guardar el plan: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white m-0">
            Catálogo Paramétrico de Planes y Tiers
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Definición de precios multimoneda, descuentos por periodicidad y límites técnicos para instancias de Xion-Manager y Xion-POS.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-accent text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer self-start hover:opacity-90"
        >
          <PlusCircle className="w-4 h-4 text-[var(--accent-fg)]" />
          <span>Crear Nuevo Plan</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">Cargando planes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white dark:bg-[#121215] border rounded-2xl p-6 flex flex-col justify-between transition-all shadow-xs ${
                plan.code === 'advanced'
                  ? 'border-blue-600 dark:border-blue-500 shadow-md relative ring-1 ring-blue-500/20'
                  : 'border-slate-200/80 dark:border-zinc-800'
              }`}
            >
              {plan.code === 'advanced' && (
                <span className="absolute -top-3 right-4 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                  Recomendado Comercial
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-900 dark:text-white">
                    <Layers className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    <h3 className="text-base font-bold m-0">{plan.name}</h3>
                  </div>
                  <button
                    onClick={() => openEditModal(plan)}
                    className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                    title="Editar Plan"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 min-h-[36px]">
                  {plan.description || 'Configuración estándar para el ecosistema Xion.'}
                </p>

                {/* Price Display */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                      ${plan.price_usd}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">/ mes (USD)</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                    Descuento anual: <strong>{plan.annual_discount_pct}%</strong> · Trimestral:{' '}
                    <strong>{plan.quarterly_discount_pct}%</strong>
                  </div>
                </div>

                {/* Technical Limits */}
                <div className="mt-5 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                    Límites de Ejecución Hardware:
                  </span>
                  <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-600 dark:text-zinc-400 flex items-center space-x-1.5">
                      <Store className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                      <span>Sucursales Autorizadas:</span>
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{plan.max_branches}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-600 dark:text-zinc-400 flex items-center space-x-1.5">
                      <Cpu className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                      <span>Cajas Xion-POS Concurrentes:</span>
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {plan.max_pos_registers}
                    </span>
                  </div>
                </div>

                {/* Modules Flags */}
                <div className="mt-5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                    Módulos y Privilegios de Licencia:
                  </span>
                  <ul className="text-xs space-y-1.5 text-slate-700 dark:text-zinc-300">
                    <li className="flex items-center space-x-2">
                      <Check
                        className={`w-3.5 h-3.5 ${
                          plan.features?.inventory_transfers ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-600'
                        }`}
                      />
                      <span className={plan.features?.inventory_transfers ? '' : 'text-slate-400 dark:text-zinc-500 line-through'}>
                        Transferencias entre sucursales
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check
                        className={`w-3.5 h-3.5 ${
                          plan.features?.advanced_audit ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-600'
                        }`}
                      />
                      <span className={plan.features?.advanced_audit ? '' : 'text-slate-400 dark:text-zinc-500 line-through'}>
                        Auditoría forense de transacciones
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check
                        className={`w-3.5 h-3.5 ${
                          plan.features?.external_api ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-600'
                        }`}
                      />
                      <span className={plan.features?.external_api ? '' : 'text-slate-400 dark:text-zinc-500 line-through'}>
                        API Externa & Webhooks de terceros
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 block text-center">
                  Código de Token: {plan.code}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 transition-colors">
            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold m-0 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-accent" />
                <span>{editingPlan ? `Editar Plan: ${editingPlan.name}` : 'Crear Nuevo Plan SaaS'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Código de Token / Plan:
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlan}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ej: enterprise-v2"
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Nombre Comercial:
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej: Plan Pro Corporativo"
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Descripción:
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles de cobertura comercial..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Precio ($/mes):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Max Sucursales:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={maxBranches}
                    onChange={(e) => setMaxBranches(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Max Cajas POS:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={maxPosRegisters}
                    onChange={(e) => setMaxPosRegisters(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Desc. Trimestral (%):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={quarterlyDiscountPct}
                    onChange={(e) => setQuarterlyDiscountPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Desc. Anual (%):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={annualDiscountPct}
                    onChange={(e) => setAnnualDiscountPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Module flags */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                  Privilegios de Módulos Incluidos:
                </span>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featInventory}
                      onChange={(e) => setFeatInventory(e.target.checked)}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-accent focus:ring-0"
                    />
                    <span>Transferencias entre sucursales</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featAudit}
                      onChange={(e) => setFeatAudit(e.target.checked)}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-accent focus:ring-0"
                    />
                    <span>Auditoría forense de transacciones</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featApi}
                      onChange={(e) => setFeatApi(e.target.checked)}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-accent focus:ring-0"
                    />
                    <span>API Externa y Webhooks de terceros</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Plan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

