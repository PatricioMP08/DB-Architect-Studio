import React, { useState } from 'react';
import {
  X,
  Upload,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';

/**
 * Modal para importar y reconstruir esquemas relacionales a partir de sentencias DDL SQL.
 * Realiza ingeniería inversa en el navegador mediante el analizador sintáctico integrado.
 */
export const ImportSqlModal: React.FC = () => {
  const { importSql, hasUnsavedChanges } = useProjectStore();
  const { activeModal, setActiveModal, setPendingAction } = useUiStore();

  // Estados locales para el texto SQL, mensajes de error y resumen de importación
  const [textoSql, setTextoSql] = useState('');
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [infoExito, setInfoExito] = useState<{ tableCount: number; relCount: number } | null>(null);

  if (activeModal !== 'importSql') return null;

  // Realiza la importación técnica
  const ejecutarAnalisis = () => {
    try {
      const resultadoAnalisis = importSql(textoSql);
      setInfoExito(resultadoAnalisis);
      setTimeout(() => {
        setActiveModal(null);
      }, 1200);
    } catch (errorCapturado: any) {
      setMensajeError(errorCapturado?.message || 'Error analizando la sintaxis del script SQL.');
    }
  };

  // Ejecuta el análisis sintáctico de las sentencias DDL con confirmación si hay cambios pendientes
  const manejarImportacion = () => {
    setMensajeError(null);
    setInfoExito(null);

    if (!textoSql.trim()) {
      setMensajeError('Por favor pega o carga un script SQL válido.');
      return;
    }

    if (hasUnsavedChanges) {
      setPendingAction(() => {
        ejecutarAnalisis();
      });
      setActiveModal('unsavedChanges');
    } else {
      ejecutarAnalisis();
    }
  };

  // Lee el contenido de un archivo .sql o .txt cargado desde el disco
  const manejarCargaArchivo = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivoSeleccionado = evento.target.files?.[0];
    if (archivoSeleccionado) {
      const lectorArchivo = new FileReader();
      lectorArchivo.onload = (eventoCarga) => {
        const contenido = eventoCarga.target?.result as string;
        if (contenido) {
          setTextoSql(contenido);
        }
      };
      lectorArchivo.readAsText(archivoSeleccionado);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in text-xs transition-colors">
        {/* Encabezado del Modal */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Ingeniería Inversa: Importar Script SQL DDL
            </span>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del formulario */}
        <div className="p-5 space-y-4">
          <p className="text-slate-600 dark:text-slate-400 text-xs">
            Pega sentencias <code className="text-brand-600 dark:text-brand-300 font-mono font-semibold">CREATE TABLE</code> y <code className="text-brand-600 dark:text-brand-300 font-mono font-semibold">ALTER TABLE ADD CONSTRAINT</code> de PostgreSQL, MySQL o SQLite para reconstruir visualmente las tablas, columnas y relaciones.
          </p>

          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Script SQL DDL:</label>
            <label className="cursor-pointer flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-[11px] font-medium">
              <FileCode className="w-3.5 h-3.5" />
              <span>Cargar archivo .sql</span>
              <input type="file" accept=".sql,.txt" onChange={manejarCargaArchivo} className="hidden" />
            </label>
          </div>

          <textarea
            rows={12}
            value={textoSql}
            onChange={(e) => setTextoSql(e.target.value)}
            placeholder={`-- Ejemplo:
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id UUID,
  total DECIMAL(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`}
            className="w-full bg-slate-50 dark:bg-[#080C14] border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-brand-500 leading-relaxed"
          />

          {mensajeError && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{mensajeError}</span>
            </div>
          )}

          {infoExito && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                ¡Importación exitosa! Se reconstruyeron {infoExito.tableCount} tablas y {infoExito.relCount} relaciones.
              </span>
            </div>
          )}
        </div>

        {/* Pie de acción */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Los scripts se analizan localmente en tu navegador.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={manejarImportacion}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors shadow-glow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analizar e Importar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
