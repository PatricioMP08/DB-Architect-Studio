import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Save,
  Trash2,
  X,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';

/**
 * Modal de advertencia para confirmar si el usuario desea guardar sus cambios
 * antes de realizar una acción que reemplazaría el lienzo actual (por ejemplo:
 * crear un nuevo proyecto, cargar una plantilla o importar un script SQL).
 */
export const UnsavedChangesModal: React.FC = () => {
  const { project, saveProject, markAsSaved } = useProjectStore();
  const { activeModal, setActiveModal, pendingAction, setPendingAction } = useUiStore();

  const estaAbierto = activeModal === 'unsavedChanges';

  // Manejo de atajos de teclado dentro del modal (Enter para guardar, Escape para cancelar)
  useEffect(() => {
    if (!estaAbierto) return;

    const manejarTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        manejarCancelar();
      }
    };

    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [estaAbierto, pendingAction]);

  if (!estaAbierto) return null;

  // Cancela la acción pendiente y mantiene al usuario en su proyecto actual
  const manejarCancelar = () => {
    setPendingAction(null);
    setActiveModal(null);
  };

  // Descarta los cambios pendientes y procede con la acción solicitada
  const manejarDescartarYContinuar = () => {
    markAsSaved();
    setActiveModal(null);
    if (pendingAction) {
      const accion = pendingAction;
      setPendingAction(null);
      accion();
    }
  };

  // Guarda el proyecto actual y luego ejecuta la acción solicitada
  const manejarGuardarYContinuar = () => {
    saveProject();
    setActiveModal(null);
    if (pendingAction) {
      const accion = pendingAction;
      setPendingAction(null);
      accion();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0F172A] border border-amber-500/30 dark:border-amber-500/20 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-xs transition-colors shadow-amber-500/5">
        {/* Encabezado del Modal con Alerta Visual */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                ¿Deseas guardar los cambios antes de continuar?
              </h2>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 font-medium mt-0.5">
                Tienes modificaciones no guardadas en el modelo actual
              </p>
            </div>
          </div>
          <button
            onClick={manejarCancelar}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Cancelar y volver"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumen del Proyecto Afectado */}
        <div className="p-6 space-y-4">
          <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
            Estás a punto de iniciar una nueva acción que reemplazará el lienzo activo. Si continúas sin guardar, todas las adiciones, posiciones y relaciones recientes se descartarán.
          </p>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                  {project.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {project.tables.length} tabla{project.tables.length === 1 ? '' : 's'} • Motor {project.dialect.toUpperCase()}
                </span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
              Sin guardar
            </span>
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={manejarCancelar}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:text-white transition-colors font-medium text-xs"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={manejarDescartarYContinuar}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 transition-colors font-semibold text-xs"
              title="Perder cambios y continuar"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Descartar cambios</span>
            </button>

            <button
              onClick={manejarGuardarYContinuar}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20 transition-all text-xs"
              title="Guardar proyecto y proceder con la acción"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar y Continuar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;
