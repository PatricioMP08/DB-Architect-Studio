import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  Layers,
  Link2,
  FolderTree,
  Plus,
  Trash2,
  Hash,
  Database,
  Code,
  FileCode,
  Eye,
  Download,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { SqlGeneratorFactory } from '../../core/dialects/factory';
import { downloadFile } from '../../core/exporters/image-exporter';

export const Sidebar: React.FC = () => {
  const { project, addTable, removeTable } = useProjectStore();
  const {
    selectedTableId,
    selectedRelationshipId,
    setSelectedTable,
    setSelectedRelationship,
    searchQuery,
  } = useUiStore();

  // Estado de apertura o colapso de cada sección del árbol explorador
  const [seccionesExpandidas, establecerSeccionesExpandidas] = useState<Record<string, boolean>>({
    tables: true,
    relationships: true,
    views: false,
    routines: false,
  });

  // Alternar el estado expandido/colapsado de una sección
  const alternarSeccion = (seccion: string) => {
    establecerSeccionesExpandidas(prev => ({ ...prev, [seccion]: !prev[seccion] }));
  };

  // Filtrado reactivo de tablas según el término de búsqueda global
  const tablasFiltradas = project.tables.filter(tabla => {
    if (!searchQuery) return true;
    const coincideNombreTabla = tabla.name.toLowerCase().includes(searchQuery.toLowerCase());
    const coincideNombreColumna = tabla.columns.some(col =>
      col.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return coincideNombreTabla || coincideNombreColumna;
  });

  return (
    <aside className="w-64 h-full bg-white dark:bg-[#0B0F17] border-r border-slate-200 dark:border-slate-800/80 flex flex-col select-none text-xs transition-colors duration-200">
      {/* Cabecera del Panel Lateral Explorador */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Explorador</span>
        </div>
        <button
          onClick={() => addTable()}
          className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
          title="Crear nueva tabla"
        >
          <Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
        </button>
      </div>

      {/* Contenido en Árbol de Objetos del Esquema */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Información del Motor y Nombre de Base de Datos */}
        <div className="px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Database className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="font-mono font-medium truncate">{project.name}</span>
          </div>
          <span className="text-[10px] font-mono uppercase text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/30 px-1.5 py-0.5 rounded">
            {project.dialect}
          </span>
        </div>

        {/* Sección de Tablas */}
        <div>
          <button
            onClick={() => alternarSeccion('tables')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded transition-colors"
          >
            <div className="flex items-center gap-1.5 font-medium">
              {seccionesExpandidas.tables ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <TableIcon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Tablas</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 rounded">
              {tablasFiltradas.length}
            </span>
          </button>

          {seccionesExpandidas.tables && (
            <div className="mt-0.5 pl-4 space-y-0.5">
              {tablasFiltradas.map(tabla => {
                const estaSeleccionada = selectedTableId === tabla.id;
                return (
                  <div
                    key={tabla.id}
                    onClick={() => setSelectedTable(tabla.id)}
                    className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                      estaSeleccionada
                        ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold shadow-sm ring-1 ring-brand-500/20'
                        : 'border border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tabla.color || '#6366F1' }}
                      />
                      <span className="font-mono truncate">{tabla.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-slate-400 group-hover:hidden">
                        {tabla.columns.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const generador = SqlGeneratorFactory.getGenerator(project.dialect);
                          const sql = generador.generate(project, {
                            selectedTableIds: [tabla.id],
                            includeComments: true,
                            includeForeignKeys: true,
                            includeIndexes: true,
                          });
                          const nombreArchivo = `${project.name.toLowerCase()}_${tabla.name}_${project.dialect}.sql`;
                          downloadFile(sql, nombreArchivo, 'application/sql');
                        }}
                        className="hidden group-hover:block text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 p-0.5 transition-colors"
                        title={`Descargar SQL de ${tabla.name}`}
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTable(tabla.id);
                        }}
                        className="hidden group-hover:block text-slate-400 hover:text-rose-500 p-0.5"
                        title="Eliminar tabla"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección de Relaciones */}
        <div>
          <button
            onClick={() => alternarSeccion('relationships')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded transition-colors"
          >
            <div className="flex items-center gap-1.5 font-medium">
              {seccionesExpandidas.relationships ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Relaciones</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 rounded">
              {project.relationships.length}
            </span>
          </button>

          {seccionesExpandidas.relationships && (
            <div className="mt-0.5 pl-4 space-y-0.5">
              {project.relationships.map(rel => {
                const estaSeleccionada = selectedRelationshipId === rel.id;
                const tablaOrigen = project.tables.find(t => t.id === rel.sourceTableId);
                const tablaDestino = project.tables.find(t => t.id === rel.targetTableId);

                return (
                  <div
                    key={rel.id}
                    onClick={() => setSelectedRelationship(rel.id)}
                    className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                      estaSeleccionada
                        ? 'border-2 border-sky-500 dark:border-sky-400 bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold shadow-sm ring-1 ring-sky-500/20'
                        : 'border border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-[11px] truncate">
                      {tablaOrigen?.name} → {tablaDestino?.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {rel.cardinality}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección de Vistas */}
        <div>
          <button
            onClick={() => alternarSeccion('views')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded transition-colors"
          >
            <div className="flex items-center gap-1.5 font-medium">
              {seccionesExpandidas.views ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Vistas</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 rounded">0</span>
          </button>
        </div>

        {/* Procedimientos y Funciones */}
        <div>
          <button
            onClick={() => alternarSeccion('routines')}
            className="w-full flex items-center justify-between px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded transition-colors"
          >
            <div className="flex items-center gap-1.5 font-medium">
              {seccionesExpandidas.routines ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <Code className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Rutinas & Triggers</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 rounded">0</span>
          </button>
        </div>
      </div>

      {/* Footer System Info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/30 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-mono">
        <span>v{project.version}</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">● Motor Listo</span>
      </div>
    </aside>
  );
};
