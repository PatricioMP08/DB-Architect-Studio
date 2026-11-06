import React, { useState, memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Key,
  Link2,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  Sparkles,
  MoreVertical,
  Download,
  Check,
} from 'lucide-react';
import { TableIR, ColumnIR } from '../../../core/ir/types';
import { useProjectStore } from '../../../stores/projectStore';
import { useUiStore } from '../../../stores/uiStore';
import { SqlGeneratorFactory } from '../../../core/dialects/factory';
import { downloadFile } from '../../../core/exporters/image-exporter';

const COLOR_PRESETS = [
  '#6366F1', // Indigo
  '#38BDF8', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#64748B', // Slate
];

export const TableNode = memo(({ id, data, selected }: NodeProps<{ table: TableIR }>) => {
  const tabla = data.table;

  // Acciones y despacho del estado global
  const {
    updateTable: actualizarTabla,
    removeTable: eliminarTabla,
    duplicateTable: duplicarTabla,
    addColumn: agregarColumna,
    removeColumn: eliminarColumna,
    updateColumn: actualizarColumna,
  } = useProjectStore();

  const {
    selectedTableId,
    selectedColumnId,
    setSelectedTable: establecerTablaSeleccionada,
    setSelectedColumn: establecerColumnaSeleccionada,
  } = useUiStore();

  // Estados locales del nodo
  const [estaColapsada, setEstaColapsada] = useState(tabla.isCollapsed || false);
  const [mostrarPaletaColores, setMostrarPaletaColores] = useState(false);
  const [estaEditandoNombre, setEstaEditandoNombre] = useState(false);
  const [nombreTablaInput, setNombreTablaInput] = useState(tabla.name);
  const [recienDescargado, setRecienDescargado] = useState(false);

  const tablaSeleccionadaActual = selected || selectedTableId === tabla.id;
  const colorTabla = tabla.color || '#6366F1';

  // Descarga directa del DDL SQL exclusivo de esta tabla
  const manejarDescargarSqlTabla = (evento: React.MouseEvent) => {
    evento.stopPropagation();
    try {
      const { project: proyectoActual } = useProjectStore.getState();
      const generador = SqlGeneratorFactory.getGenerator(proyectoActual.dialect);
      const sqlGenerado = generador.generate(proyectoActual, {
        selectedTableIds: [tabla.id],
        includeComments: true,
        includeForeignKeys: true,
        includeIndexes: true,
      });
      const nombreArchivo = `${proyectoActual.name.toLowerCase()}_${tabla.name}_${proyectoActual.dialect}.sql`;
      downloadFile(sqlGenerado, nombreArchivo, 'application/sql');
      setRecienDescargado(true);
      setTimeout(() => setRecienDescargado(false), 2000);
    } catch (error: any) {
      alert(`Error al exportar tabla: ${error?.message}`);
    }
  };

  // Guardar nuevo nombre de la tabla
  const manejarEnvioNombre = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (nombreTablaInput.trim()) {
      actualizarTabla(tabla.id, { name: nombreTablaInput.trim() });
    }
    setEstaEditandoNombre(false);
  };

  // Agregar columna rápida por defecto
  const manejarAgregarColumnaRapida = (evento: React.MouseEvent) => {
    evento.stopPropagation();
    agregarColumna(tabla.id, {
      name: `col_${tabla.columns.length + 1}`,
      dataType: 'VARCHAR',
      length: 255,
      isNullable: true,
    });
  };

  return (
    <div
      onClick={(evento) => {
        evento.stopPropagation();
        establecerTablaSeleccionada(tabla.id);
      }}
      className={`group relative rounded-xl border transition-all duration-200 select-none min-w-[280px] max-w-[340px] shadow-md dark:shadow-panel ${
        tablaSeleccionadaActual
          ? 'ring-2 ring-brand-500 shadow-glow bg-white dark:bg-[#0F172A] border-brand-500 dark:border-brand-400'
          : 'bg-white dark:bg-[#0E1526] hover:border-slate-400 dark:hover:border-slate-600/80 border-slate-300 dark:border-slate-800'
      }`}
      style={{
        boxShadow: tablaSeleccionadaActual ? `0 0 25px -4px ${colorTabla}40` : undefined,
      }}
    >
      {/* Barra de Acento Superior con el Color de Dominio */}
      <div
        className="h-1.5 w-full rounded-t-xl transition-colors duration-200"
        style={{ backgroundColor: colorTabla }}
      />

      {/* Cabecera de la Tabla */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 rounded-t-lg">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={(evento) => {
              evento.stopPropagation();
              setMostrarPaletaColores(!mostrarPaletaColores);
            }}
            className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20 transition-transform hover:scale-125 flex-shrink-0"
            style={{ backgroundColor: colorTabla }}
            title="Cambiar color de etiqueta"
          />

          <TableIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />

          {estaEditandoNombre ? (
            <form onSubmit={manejarEnvioNombre} className="flex-1">
              <input
                autoFocus
                value={nombreTablaInput}
                onChange={(evento) => setNombreTablaInput(evento.target.value)}
                onBlur={manejarEnvioNombre}
                className="w-full bg-slate-100 dark:bg-slate-950 border border-brand-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
              />
            </form>
          ) : (
            <span
              onDoubleClick={(evento) => {
                evento.stopPropagation();
                setEstaEditandoNombre(true);
              }}
              title="Doble clic para renombrar"
              className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono truncate cursor-pointer hover:text-brand-600 dark:hover:text-brand-300"
            >
              {tabla.name}
            </span>
          )}

          {tabla.columns.length > 0 && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-200/80 dark:bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-300/50 dark:border-slate-700/50">
              {tabla.columns.length}
            </span>
          )}
        </div>

        {/* Acciones Rápidas en la Cabecera de la Tabla */}
        <div className="flex items-center gap-1 ml-2">
          {/* Exportación rápida directa de la tabla */}
          <button
            onClick={manejarDescargarSqlTabla}
            className={`p-1 rounded transition-colors ${
              recienDescargado
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                : 'text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
            title={`Descargar script SQL de tabla ${tabla.name}`}
          >
            {recienDescargado ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(evento) => {
              evento.stopPropagation();
              setEstaColapsada(!estaColapsada);
              actualizarTabla(tabla.id, { isCollapsed: !estaColapsada });
            }}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors"
            title={estaColapsada ? 'Expandir tabla' : 'Colapsar tabla'}
          >
            {estaColapsada ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(evento) => {
              evento.stopPropagation();
              duplicarTabla(tabla.id);
            }}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors"
            title="Duplicar tabla"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(evento) => {
              evento.stopPropagation();
              eliminarTabla(tabla.id);
            }}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors"
            title="Eliminar tabla"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selector Desplegable de Paleta de Colores */}
      {mostrarPaletaColores && (
        <div
          onClick={(evento) => evento.stopPropagation()}
          className="absolute z-50 top-10 left-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg shadow-xl flex gap-1.5"
        >
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => {
                actualizarTabla(tabla.id, { color });
                setMostrarPaletaColores(false);
              }}
              className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20 transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {/* Banner descriptivo de la entidad si tiene comentario */}
      {!estaColapsada && tabla.comment && tabla.comment.trim() !== '' && (
        <div
          title={tabla.comment}
          className="px-3.5 py-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/90 dark:bg-slate-900/50 border-b border-slate-200/50 dark:border-slate-800/60 italic truncate max-w-full"
        >
          -- {tabla.comment}
        </div>
      )}

      {/* Lista de Columnas */}
      {!estaColapsada && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#0B101D]">
          {tabla.columns.map((columna) => {
            const columnaSeleccionada = selectedColumnId === columna.id;

            return (
              <div
                key={columna.id}
                onClick={(evento) => {
                  evento.stopPropagation();
                  establecerColumnaSeleccionada(tabla.id, columna.id);
                }}
                className={`relative flex items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                  columnaSeleccionada ? 'bg-brand-500/10 dark:bg-brand-500/20 border-l-2 border-brand-500 dark:border-brand-400' : ''
                }`}
              >
                {/* Manija de Destino (Izquierda: relación entrante) */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`target-${columna.id}`}
                  className="!w-2.5 !h-2.5 !bg-brand-500 dark:!bg-brand-400 !border-2 !border-white dark:!border-slate-950 hover:!bg-brand-400 transition-transform hover:!scale-125 !-left-[5px]"
                />

                {/* Indicadores izquierdos y Nombre de Columna */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                  {columna.isPrimaryKey ? (
                    <Key className="w-3 h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" title="Clave Primaria (PK)" />
                  ) : columna.isForeignKey ? (
                    <Link2 className="w-3 h-3 text-sky-500 dark:text-sky-400 flex-shrink-0" title="Clave Foránea (FK)" />
                  ) : (
                    <span className="w-3 h-3 inline-block" />
                  )}

                  <span
                    className={`font-mono text-xs truncate ${
                      columna.isPrimaryKey
                        ? 'text-amber-700 dark:text-amber-300 font-semibold'
                        : columna.isForeignKey
                        ? 'text-sky-700 dark:text-sky-300'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {columna.name}
                  </span>

                  {columna.isUnique && !columna.isPrimaryKey && (
                    <span className="text-[9px] text-purple-700 dark:text-purple-400 font-mono font-bold bg-purple-100 dark:bg-purple-950/80 px-1 rounded">
                      UQ
                    </span>
                  )}
                </div>

                {/* Tipo de Dato y Nulabilidad */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {columna.dataType}
                    {columna.length ? `(${columna.length})` : ''}
                    {columna.precision ? `(${columna.precision},${columna.scale || 0})` : ''}
                  </span>

                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      columna.isNullable ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-400 font-bold'
                    }`}
                    title={columna.isNullable ? 'Permite nulos (NULL)' : 'Obligatorio (NOT NULL)'}
                  >
                    {columna.isNullable ? '?' : '!'}
                  </span>

                  {/* Eliminar Columna (visible al pasar el ratón) */}
                  <button
                    onClick={(evento) => {
                      evento.stopPropagation();
                      eliminarColumna(tabla.id, columna.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 transition-opacity p-0.5"
                    title="Eliminar columna"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Manija de Origen (Derecha: relación saliente) */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`source-${columna.id}`}
                  className="!w-2.5 !h-2.5 !bg-sky-500 dark:!bg-sky-400 !border-2 !border-white dark:!border-slate-950 hover:!bg-sky-400 transition-transform hover:!scale-125 !-right-[5px]"
                />
              </div>
            );
          })}

          {/* Botón Rápido para Agregar Columna */}
          <button
            onClick={manejarAgregarColumnaRapida}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar columna</span>
          </button>
        </div>
      )}

      {/* Pie de Tabla (Estimación de filas e índices) */}
      {tabla.indexes && tabla.indexes.length > 0 && !estaColapsada && (
        <div className="px-3 py-1 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800/80 rounded-b-xl flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          <span>{tabla.indexes.length} índice{tabla.indexes.length > 1 ? 's' : ''}</span>
          {tabla.estimatedRows && <span>~{tabla.estimatedRows.toLocaleString()} filas</span>}
        </div>
      )}

    </div>
  );
});

TableNode.displayName = 'TableNode';
