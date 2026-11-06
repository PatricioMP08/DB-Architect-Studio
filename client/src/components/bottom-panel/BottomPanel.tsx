import React, { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Code2,
  AlertTriangle,
  Zap,
  Copy,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Info,
  Filter,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { SqlGeneratorFactory } from '../../core/dialects/factory';
import { downloadFile } from '../../core/exporters/image-exporter';
import { SupportedDialect } from '../../core/ir/types';

export const BottomPanel: React.FC = () => {
  // Estado global del proyecto y de la interfaz
  const {
    project,
    healthResult,
    addColumn,
    addIndex,
  } = useProjectStore();

  const {
    theme,
    isBottomPanelOpen,
    toggleBottomPanel,
    bottomPanelTab,
    setBottomPanelTab,
    selectedTableId,
  } = useUiStore();

  // Estados locales del panel
  const [copiado, setCopiado] = useState(false);
  const [incluirDropTable, setIncluirDropTable] = useState(false);
  const [filtroTabla, setFiltroTabla] = useState<string>('all');
  const [dialectoVistaPrevia, setDialectoVistaPrevia] = useState<SupportedDialect>(project.dialect);

  // Mantener sincronizado el dialecto si el proyecto cambia de dialecto global
  React.useEffect(() => {
    setDialectoVistaPrevia(project.dialect);
  }, [project.dialect]);

  // Obtener la entidad seleccionada en caso de filtrado individual
  const tablaActual = project.tables.find(t => t.id === filtroTabla);

  // Generación reactiva de código SQL en tiempo real según el dialecto y filtro activo
  const sqlGenerado = useMemo(() => {
    try {
      const generador = SqlGeneratorFactory.getGenerator(dialectoVistaPrevia);
      const idsTablasSeleccionadas = filtroTabla === 'all' ? undefined : [filtroTabla];
      return generador.generate(project, {
        includeDropTable: incluirDropTable,
        includeComments: true,
        includeForeignKeys: true,
        includeIndexes: true,
        selectedTableIds: idsTablasSeleccionadas,
      });
    } catch (error: any) {
      return `-- Error al generar el script SQL: ${error?.message}`;
    }
  }, [project, incluirDropTable, filtroTabla, dialectoVistaPrevia]);

  // Copia segura de código al portapapeles con confirmación visual
  const manejarCopiarSql = () => {
    navigator.clipboard.writeText(sqlGenerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // Descarga del script SQL generado según el ámbito elegido
  const manejarDescargarSql = () => {
    const etiquetaAmbito = filtroTabla === 'all' ? 'bd_completa' : (tablaActual?.name || 'tabla');
    const nombreArchivo = `${project.name.toLowerCase().replace(/\s+/g, '_')}_${etiquetaAmbito}_${dialectoVistaPrevia}.sql`;
    downloadFile(sqlGenerado, nombreArchivo, 'application/sql');
  };

  // Auto-corrección inmediata de incidencias comunes de salud
  const manejarAutoCorreccion = (incidencia: any) => {
    if (incidencia.code === 'MISSING_PRIMARY_KEY' && incidencia.tableId) {
      addColumn(incidencia.tableId, {
        name: 'id',
        dataType: project.dialect === 'postgres' ? 'UUID' : 'INT',
        isPrimaryKey: true,
        isNullable: false,
        isAutoIncrement: project.dialect !== 'postgres',
        defaultValue: project.dialect === 'postgres' ? 'gen_random_uuid()' : undefined,
      });
    } else if (incidencia.code === 'MISSING_FK_INDEX' && incidencia.tableId && incidencia.columnId) {
      addIndex(incidencia.tableId, {
        name: `idx_${incidencia.tableName}_${incidencia.columnName}`,
        columnIds: [incidencia.columnId],
        isUnique: false,
        method: 'BTREE',
      });
    }
  };


  if (!isBottomPanelOpen) {
    return (
      <div className="h-8 bg-white dark:bg-[#0B0F17] border-t border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between select-none text-xs transition-colors duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBottomPanelTab('sql')}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <Code2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>SQL ({dialectoVistaPrevia.toUpperCase()}) {filtroTabla !== 'all' ? `— ${tablaActual?.name}` : ''}</span>
          </button>
          <button
            onClick={() => setBottomPanelTab('diagnostics')}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Diagnóstico ({healthResult.issues.length})</span>
          </button>
        </div>

        <button
          onClick={toggleBottomPanel}
          className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          title="Abrir panel inferior"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-64 bg-white dark:bg-[#0B0F17] border-t border-slate-200 dark:border-slate-800 flex flex-col select-none text-xs transition-colors duration-200">
      {/* Barra Superior del Panel Inferior */}
      <div className="h-9 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBottomPanelTab('sql')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-t border-b-2 transition-colors ${
              bottomPanelTab === 'sql'
                ? 'border-brand-500 text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/15 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SQL DDL ({dialectoVistaPrevia.toUpperCase()})</span>
          </button>

          <button
            onClick={() => setBottomPanelTab('diagnostics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-t border-b-2 transition-colors ${
              bottomPanelTab === 'diagnostics'
                ? 'border-brand-500 text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/15 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Diagnóstico ({healthResult.issues.length})</span>
          </button>
        </div>

        {/* Controles de la barra derecha */}
        <div className="flex items-center gap-2">
          {bottomPanelTab === 'sql' && (
            <>
              {/* Selector interactivo de motor SQL */}
              <div className="flex items-center gap-1.5 mr-1">
                <span className="text-[11px] text-slate-500 font-medium">Motor:</span>
                <select
                  value={dialectoVistaPrevia}
                  onChange={(e) => setDialectoVistaPrevia(e.target.value as SupportedDialect)}
                  aria-label="Motor SQL en panel"
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-500 cursor-pointer shadow-sm"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="sqlserver">SQL Server</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>

              {/* Selector dinámico de ámbito: Toda la BD vs Tabla específica */}
              <div className="flex items-center gap-1.5 mr-1">
                <span className="text-[11px] text-slate-500 font-medium">Ámbito:</span>
                <select
                  value={filtroTabla}
                  onChange={(e) => setFiltroTabla(e.target.value)}
                  aria-label="Filtrar tabla en editor SQL"
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-500 cursor-pointer shadow-sm"
                >
                  <option value="all">Toda la BD ({project.tables.length} tablas)</option>
                  {project.tables.map(t => (
                    <option key={t.id} value={t.id}>
                      Tabla: {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer mr-1">
                <input
                  type="checkbox"
                  checked={incluirDropTable}
                  onChange={(e) => setIncluirDropTable(e.target.checked)}
                  className="rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-brand-500"
                />
                <span>DROP TABLE</span>
              </label>

              <button
                onClick={manejarCopiarSql}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors font-medium shadow-sm"
                title="Copiar código SQL al portapapeles"
              >
                {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiado ? 'Copiado' : 'Copiar'}</span>
              </button>

              <button
                onClick={manejarDescargarSql}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors font-medium shadow-sm"
                title="Descargar script .sql del ámbito seleccionado"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .sql</span>
              </button>
            </>
          )}

          <button
            onClick={toggleBottomPanel}
            className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            title="Minimizar panel"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cuerpo del Panel */}
      <div className="flex-1 overflow-hidden">
        {bottomPanelTab === 'sql' && (
          <div className="w-full h-full bg-white dark:bg-[#080C14]">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={sqlGenerado}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                folding: true,
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        )}

        {bottomPanelTab === 'diagnostics' && (
          <div className="w-full h-full overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-[#080C14]">
            {healthResult.issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 py-6">
                <Check className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mb-2" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">¡Modelo en Excelente Estado!</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  No se detectaron errores de integridad referencial, faltas de claves primarias o tipos incompatibles.
                </p>
              </div>
            ) : (
              healthResult.issues.map((incidencia) => (
                <div
                  key={incidencia.id}
                  className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                    incidencia.severity === 'error'
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-200'
                      : incidencia.severity === 'warning'
                      ? 'bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200'
                      : 'bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {incidencia.severity === 'error' ? (
                      <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                    ) : incidencia.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
                    )}

                    <div>
                      <div className="font-semibold text-xs mb-0.5">{incidencia.message}</div>
                      {incidencia.suggestion && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-sans">{incidencia.suggestion}</div>
                      )}
                    </div>
                  </div>

                  {incidencia.autoFixAvailable && (
                    <button
                      onClick={() => manejarAutoCorreccion(incidencia)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded transition-colors shadow-glow"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Auto-Corregir</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
