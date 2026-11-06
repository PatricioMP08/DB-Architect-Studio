import React from 'react';
import {
  X,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { TEMPLATES } from '../../core/templates';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';

/**
 * Modal interactivo para seleccionar e instanciar plantillas de arquitectura preconfiguradas
 * (Comercio Electrónico, Red Social y Plataforma SaaS CRM).
 */
export const TemplatesModal: React.FC = () => {
  const { loadTemplate, hasUnsavedChanges } = useProjectStore();
  const { activeModal, setActiveModal, setPendingAction } = useUiStore();

  if (activeModal !== 'templates') return null;

  // Carga el esquema de la plantilla en el lienzo y cierra el diálogo tras confirmar
  const manejarSeleccionPlantilla = (idPlantilla: string) => {
    if (hasUnsavedChanges) {
      setPendingAction(() => {
        loadTemplate(idPlantilla);
        setActiveModal(null);
      });
      setActiveModal('unsavedChanges');
    } else {
      loadTemplate(idPlantilla);
      setActiveModal(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-fade-in text-xs transition-colors">
        {/* Encabezado */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Biblioteca de Esquemas Preconfigurados</span>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuadrícula de Plantillas de Base de Datos */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
          {TEMPLATES.map((plantilla) => (
            <div
              key={plantilla.id}
              onClick={() => manejarSeleccionPlantilla(plantilla.id)}
              className="group p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-brand-500 hover:bg-brand-500/5 dark:hover:bg-brand-500/10 transition-all cursor-pointer flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono font-bold text-brand-600 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/30 px-2 py-0.5 rounded">
                    {plantilla.category}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {plantilla.tableCount} tablas
                  </span>
                </div>

                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                  {plantilla.name}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {plantilla.description}
                </p>

                <div className="flex flex-wrap gap-1 mt-3">
                  {plantilla.tags.map((etiqueta) => (
                    <span key={etiqueta} className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                      {etiqueta}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-brand-600 dark:text-brand-400 font-medium">
                <span>Cargar Esquema</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Pie de acción */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex justify-end">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
