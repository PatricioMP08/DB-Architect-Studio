import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Key,
  Link2,
  Sliders,
  Layers,
  Database,
  Info,
  Check,
  ShieldCheck,
  Zap,
  Download,
  Copy,
  FileCode,
  FileText,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { CANONICAL_TYPES, getTypesByCategory } from '../../core/ir/dialects';
import { ReferentialAction, Cardinality } from '../../core/ir/types';
import { SqlGeneratorFactory } from '../../core/dialects/factory';
import { downloadFile } from '../../core/exporters/image-exporter';
import { generateMarkdownDocumentation } from '../../core/exporters/markdown-doc';
import { generateCsvDataDictionary } from '../../core/exporters/csv-exporter';

export const Inspector: React.FC = () => {
  const {
    project,
    updateTable,
    updateColumn,
    addColumn,
    removeColumn,
    updateRelationship,
    removeRelationship,
    addIndex,
    removeIndex,
  } = useProjectStore();

  const {
    selectedTableId,
    selectedRelationshipId,
    clearSelection,
    setActiveModal,
  } = useUiStore();

  // Estado para la pestaña activa en el panel lateral del inspector
  const [pestanaActiva, establecerPestanaActiva] = useState<'columns' | 'indexes' | 'details'>('columns');
  // Estado para indicar si el script SQL fue copiado al portapapeles exitosamente
  const [sqlCopiado, establecerSqlCopiado] = useState(false);

  // Si el usuario tiene una relación seleccionada en el lienzo
  if (selectedRelationshipId) {
    const relacion = project.relationships.find(r => r.id === selectedRelationshipId);
    if (!relacion) return null;

    const tablaOrigen = project.tables.find(t => t.id === relacion.sourceTableId);
    const tablaDestino = project.tables.find(t => t.id === relacion.targetTableId);
    const columnaOrigen = tablaOrigen?.columns.find(c => c.id === relacion.sourceColumnId);
    const columnaDestino = tablaDestino?.columns.find(c => c.id === relacion.targetColumnId);

    return (
      <aside className="w-80 h-full bg-white dark:bg-[#0B0F17] border-l border-slate-200 dark:border-slate-800/80 flex flex-col select-none text-xs transition-colors duration-200">
        {/* Cabecera del Inspector de Relaciones */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Propiedades de Relación</span>
          </div>
          <button
            onClick={() => clearSelection()}
            className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1 font-medium">Nombre de la Restricción</label>
            <input
              type="text"
              value={relacion.name || ''}
              onChange={(e) => updateRelationship(relacion.id, { name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">Origen (Clave Foránea):</span>
              <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">{tablaOrigen?.name}.{columnaOrigen?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">Destino (Clave Primaria):</span>
              <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">{tablaDestino?.name}.{columnaDestino?.name}</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1 font-medium">Cardinalidad</label>
            <select
              value={relacion.cardinality}
              onChange={(e) => updateRelationship(relacion.id, { cardinality: e.target.value as Cardinality })}
              aria-label="Cardinalidad de la relación"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
            >
              <option value="1:N">Uno a Muchos (1:N)</option>
              <option value="1:1">Uno a Uno (1:1)</option>
              <option value="N:M">Muchos a Muchos (N:M)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isIdentifying"
              checked={relacion.isIdentifying}
              onChange={(e) => updateRelationship(relacion.id, { isIdentifying: e.target.checked })}
              className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-brand-500 focus:ring-0"
            />
            <label htmlFor="isIdentifying" className="text-slate-700 dark:text-slate-300 cursor-pointer">
              Relación Identificadora (Línea Continua)
            </label>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
            <div>
              <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1 font-medium">ON DELETE</label>
              <select
                value={relacion.onDelete}
                onChange={(e) => updateRelationship(relacion.id, { onDelete: e.target.value as ReferentialAction })}
                aria-label="Acción referencial ON DELETE"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
              >
                <option value="CASCADE">CASCADE</option>
                <option value="SET NULL">SET NULL</option>
                <option value="RESTRICT">RESTRICT</option>
                <option value="NO ACTION">NO ACTION</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1 font-medium">ON UPDATE</label>
              <select
                value={relacion.onUpdate}
                onChange={(e) => updateRelationship(relacion.id, { onUpdate: e.target.value as ReferentialAction })}
                aria-label="Acción referencial ON UPDATE"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
              >
                <option value="CASCADE">CASCADE</option>
                <option value="SET NULL">SET NULL</option>
                <option value="RESTRICT">RESTRICT</option>
                <option value="NO ACTION">NO ACTION</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              removeRelationship(relacion.id);
              clearSelection();
            }}
            className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar Relación</span>
          </button>
        </div>
      </aside>
    );
  }

  // Si hay una tabla seleccionada en el lienzo
  const tablaSeleccionada = project.tables.find(t => t.id === selectedTableId);

  if (!tablaSeleccionada) {
    return (
      <aside className="w-80 h-full bg-white dark:bg-[#0B0F17] border-l border-slate-200 dark:border-slate-800/80 flex flex-col items-center justify-center p-6 text-center select-none text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <Sliders className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
        <span className="font-medium text-slate-800 dark:text-slate-300 mb-1">Inspector de Propiedades</span>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Haz clic en una tabla, columna o relación en el lienzo para configurar sus propiedades, tipos de datos e índices.
        </p>
      </aside>
    );
  }

  // Obtener el catálogo de tipos agrupado por categoría (numérico, texto, fecha, etc.)
  const tiposPorCategoria = getTypesByCategory();

  // Función para descargar el script DDL de la tabla seleccionada
  const manejarDescargaSqlTabla = () => {
    try {
      const generador = SqlGeneratorFactory.getGenerator(project.dialect);
      const sql = generador.generate(project, {
        selectedTableIds: [tablaSeleccionada.id],
        includeComments: true,
        includeForeignKeys: true,
        includeIndexes: true,
      });
      const nombreArchivo = `${project.name.toLowerCase()}_${tablaSeleccionada.name}_${project.dialect}.sql`;
      downloadFile(sql, nombreArchivo, 'application/sql');
    } catch (error: any) {
      alert(`Error al generar SQL: ${error?.message}`);
    }
  };

  // Función para copiar el código SQL al portapapeles
  const manejarCopiaSqlTabla = () => {
    try {
      const generador = SqlGeneratorFactory.getGenerator(project.dialect);
      const sql = generador.generate(project, {
        selectedTableIds: [tablaSeleccionada.id],
        includeComments: true,
        includeForeignKeys: true,
        includeIndexes: true,
      });
      navigator.clipboard.writeText(sql);
      establecerSqlCopiado(true);
      setTimeout(() => establecerSqlCopiado(false), 2000);
    } catch (error: any) {
      alert(`Error al copiar SQL: ${error?.message}`);
    }
  };

  // Función para descargar el diccionario de datos de la tabla en CSV
  const manejarDescargaCsvTabla = () => {
    try {
      const csv = generateCsvDataDictionary(project, [tablaSeleccionada.id]);
      const nombreArchivo = `${project.name.toLowerCase()}_${tablaSeleccionada.name}_dictionary.csv`;
      downloadFile(csv, nombreArchivo, 'text/csv');
    } catch (error: any) {
      alert(`Error al generar CSV: ${error?.message}`);
    }
  };

  // Función para descargar la documentación en Markdown de la tabla
  const manejarDescargaMdTabla = () => {
    try {
      const markdown = generateMarkdownDocumentation(project, [tablaSeleccionada.id]);
      const nombreArchivo = `${project.name.toLowerCase()}_${tablaSeleccionada.name}_docs.md`;
      downloadFile(markdown, nombreArchivo, 'text/markdown');
    } catch (error: any) {
      alert(`Error al generar Markdown: ${error?.message}`);
    }
  };

  return (
    <aside className="w-80 h-full bg-white dark:bg-[#0B0F17] border-l border-slate-200 dark:border-slate-800/80 flex flex-col select-none text-xs transition-colors duration-200">

      {/* Cabecera del Inspector de Tabla */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: tablaSeleccionada.color || '#6366F1' }}
          />
          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">{tablaSeleccionada.name}</span>
        </div>
        <button
          onClick={() => clearSelection()}
          className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pestañas de Navegación del Inspector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 text-[11px]">
        <button
          onClick={() => establecerPestanaActiva('columns')}
          className={`flex-1 py-2 font-medium border-b-2 transition-colors ${
            pestanaActiva === 'columns'
              ? 'border-brand-500 text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/15 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Columnas ({tablaSeleccionada.columns.length})
        </button>
        <button
          onClick={() => establecerPestanaActiva('indexes')}
          className={`flex-1 py-2 font-medium border-b-2 transition-colors ${
            pestanaActiva === 'indexes'
              ? 'border-brand-500 text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/15 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Índices ({tablaSeleccionada.indexes?.length || 0})
        </button>
        <button
          onClick={() => establecerPestanaActiva('details')}
          className={`flex-1 py-2 font-medium border-b-2 transition-colors ${
            pestanaActiva === 'details'
              ? 'border-brand-500 text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/15 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Detalles
        </button>
      </div>

      {/* Contenido de las Pestañas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pestanaActiva === 'columns' && (
          <div className="space-y-3">
            {tablaSeleccionada.columns.map((columna) => (
              <div
                key={columna.id}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2"
              >
                {/* Nombre de la Columna y Acción de Eliminación */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {columna.isPrimaryKey ? (
                      <Key className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                    ) : columna.isForeignKey ? (
                      <Link2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                    ) : null}
                    <input
                      type="text"
                      value={columna.name}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { name: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded px-2 py-1 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <button
                    onClick={() => removeColumn(tablaSeleccionada.id, columna.id)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1"
                    title="Eliminar columna"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tipo de Dato y Longitud */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Tipo de Dato</label>
                    <select
                      value={columna.dataType}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { dataType: e.target.value })}
                      aria-label="Tipo de dato de la columna"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded px-1.5 py-1 text-slate-900 dark:text-white font-mono text-[11px] focus:outline-none"
                    >
                      {Object.entries(tiposPorCategoria).map(([categoria, tipos]) => (
                        <optgroup key={categoria} label={categoria.toUpperCase()} className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-sans">
                          {tipos.map(tipo => (
                            <option key={tipo.canonical} value={tipo.canonical} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white font-mono">
                              {tipo.canonical}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Longitud / Precisión</label>
                    <input
                      type="number"
                      value={columna.length || ''}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { length: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="255"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded px-2 py-1 text-slate-900 dark:text-white font-mono text-[11px] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Modificadores de Columna: PK, AutoInc, NotNull, Unique */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={columna.isPrimaryKey}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { isPrimaryKey: e.target.checked })}
                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-brand-500"
                    />
                    <span>Clave Primaria (PK)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={columna.isAutoIncrement}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { isAutoIncrement: e.target.checked })}
                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-brand-500"
                    />
                    <span>Auto-Incremental</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={!columna.isNullable}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { isNullable: !e.target.checked })}
                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-brand-500"
                    />
                    <span>No Nulo (NOT NULL)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={columna.isUnique}
                      onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { isUnique: e.target.checked })}
                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-brand-500"
                    />
                    <span>Único (UNIQUE)</span>
                  </label>
                </div>

                {/* Valor por Defecto */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Valor por Defecto</label>
                  <input
                    type="text"
                    value={columna.defaultValue || ''}
                    placeholder="ej. 'activo', 0, CURRENT_TIMESTAMP"
                    onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { defaultValue: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded px-2 py-0.5 text-slate-900 dark:text-white font-mono text-[11px] focus:outline-none"
                  />
                </div>

                {/* Comentario / Documentación del Campo */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                    Comentario / Documentación del Campo
                  </label>
                  <input
                    type="text"
                    value={columna.comment || ''}
                    placeholder="ej. Correo principal validado para autenticación..."
                    onChange={(e) => updateColumn(tablaSeleccionada.id, columna.id, { comment: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded px-2 py-0.5 text-slate-900 dark:text-white font-sans text-[11px] focus:outline-none focus:border-brand-500"
                  />
                </div>

              </div>
            ))}

            <button
              onClick={() => addColumn(tablaSeleccionada.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Columna</span>
            </button>
          </div>
        )}

        {pestanaActiva === 'indexes' && (
          <div className="space-y-3">
            {tablaSeleccionada.indexes && tablaSeleccionada.indexes.length > 0 ? (
              tablaSeleccionada.indexes.map(indice => (
                <div key={indice.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{indice.name}</span>
                    <button
                      onClick={() => removeIndex(tablaSeleccionada.id, indice.id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Método: {indice.method || 'BTREE'} | {indice.isUnique ? 'ÚNICO' : 'NO ÚNICO'}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-4">No hay índices personalizados creados.</p>
            )}

            <button
              onClick={() => {
                if (tablaSeleccionada.columns.length > 0) {
                  addIndex(tablaSeleccionada.id, {
                    name: `idx_${tablaSeleccionada.name}_${tablaSeleccionada.columns[0].name}`,
                    columnIds: [tablaSeleccionada.columns[0].id],
                    isUnique: false,
                    method: 'BTREE',
                  });
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Índice</span>
            </button>
          </div>
        )}

        {pestanaActiva === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1 font-medium">Nombre de la Tabla</label>
              <input
                type="text"
                value={tablaSeleccionada.name}
                onChange={(e) => updateTable(tablaSeleccionada.id, { name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Comentario / Descripción de la Tabla
                </label>
                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-mono">
                  Genera cabecera SQL
                </span>
              </div>
              <textarea
                rows={3}
                value={tablaSeleccionada.comment || ''}
                placeholder="Describe el propósito y alcance de la entidad en el dominio..."
                onChange={(e) => updateTable(tablaSeleccionada.id, { comment: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white font-sans text-xs focus:outline-none focus:border-brand-500"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Esta descripción se insertará automáticamente en el bloque de encabezado SQL DDL y diccionarios de datos.
              </p>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1 font-medium">Filas Estimadas</label>
              <input
                type="number"
                value={tablaSeleccionada.estimatedRows || ''}
                placeholder="ej. 50000"
                onChange={(e) => updateTable(tablaSeleccionada.id, { estimatedRows: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
              />
            </div>

            {/* Acciones de Exportación Directa de la Tabla */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>Exportación de la Tabla</span>
                </label>
                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-mono font-medium">
                  {project.dialect.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <button
                  onClick={manejarDescargaSqlTabla}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors font-medium text-left"
                  title="Descargar script SQL DDL de esta tabla"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Descargar DDL SQL</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">.sql</span>
                </button>

                <button
                  onClick={manejarCopiaSqlTabla}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors font-medium text-left"
                  title="Copiar código DDL al portapapeles"
                >
                  <div className="flex items-center gap-2">
                    {sqlCopiado ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{sqlCopiado ? '¡Copiado al portapapeles!' : 'Copiar DDL de Tabla'}</span>
                  </div>
                </button>

                <button
                  onClick={manejarDescargaCsvTabla}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors font-medium text-left"
                  title="Descargar diccionario de datos CSV de esta tabla"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Diccionario CSV</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">.csv</span>
                </button>

                <button
                  onClick={manejarDescargaMdTabla}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors font-medium text-left"
                  title="Descargar documentación Markdown de esta tabla"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Documentación Markdown</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">.md</span>
                </button>

                <button
                  onClick={() => setActiveModal('export')}
                  className="mt-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir Centro de Exportación Completo</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};
