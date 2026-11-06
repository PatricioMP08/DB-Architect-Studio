import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

/**
 * Modal informativo de atajos de teclado y gestos interactivos del lienzo.
 */
export const ShortcutsModal: React.FC = () => {
  const { activeModal, setActiveModal } = useUiStore();

  if (activeModal !== 'shortcuts') return null;

  // Catálogo de atajos de teclado y combinaciones disponibles
  const listaAtajos = [
    { tecla: 'Ctrl + S / ⌘ + S', descripcion: 'Guardar proyecto en el navegador' },
    { tecla: 'Ctrl + Shift + S', descripcion: 'Guardar copia de respaldo en disco (.json)' },
    { tecla: 'Ctrl + Z / ⌘ + Z', descripcion: 'Deshacer la última acción' },
    { tecla: 'Ctrl + Y / ⌘ + Y', descripcion: 'Rehacer la última acción' },
    { tecla: 'Delete / Supr', descripcion: 'Eliminar la tabla o relación seleccionada' },
    { tecla: 'Doble Clic (Lienzo)', descripcion: 'Crear una nueva tabla en la posición del puntero' },
    { tecla: 'Doble Clic (Nombre)', descripcion: 'Editar el nombre de la tabla en línea' },
    { tecla: 'Arrastrar Puerto', descripcion: 'Crear relación FK arrastrando de columna a columna' },
    { tecla: 'Rueda del Ratón', descripcion: 'Zoom interactivo en el lienzo' },
    { tecla: 'Arrastrar Fondo', descripcion: 'Desplazamiento panorámico (Pan) por el diagrama' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in text-xs transition-colors">
        {/* Encabezado */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Atajos de Teclado y Gestos</span>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Atajos */}
        <div className="p-5 space-y-2.5">
          {listaAtajos.map((atajo) => (
            <div key={atajo.tecla} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <span className="text-slate-600 dark:text-slate-400">{atajo.descripcion}</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded font-mono text-[11px] text-slate-800 dark:text-slate-200 shadow-sm">
                {atajo.tecla}
              </kbd>
            </div>
          ))}
        </div>

        {/* Pie de acción */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex justify-end">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:text-white transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
