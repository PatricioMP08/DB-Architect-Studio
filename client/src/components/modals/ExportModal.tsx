import React, { useState, useMemo } from 'react';
import {
  X,
  FileCode,
  FileText,
  FileSpreadsheet,
  Image,
  Download,
  Check,
  Sparkles,
  Layers,
  Table as TableIcon,
  CheckSquare,
  Square,
  CheckCircle2,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { SqlGeneratorFactory } from '../../core/dialects/factory';
import { generateMarkdownDocumentation } from '../../core/exporters/markdown-doc';
import { generateCsvDataDictionary } from '../../core/exporters/csv-exporter';
import {
  downloadFile,
  exportDiagramAsPng,
  exportDiagramAsSvg,
  exportDiagramAsPdf,
} from '../../core/exporters/image-exporter';
import { SupportedDialect } from '../../core/ir/types';

// Tipo para definir el ámbito o alcance de la exportación (todo, una sola tabla, selección personalizada)
type AmbitoExportacion = 'all' | 'single' | 'custom';

export const ExportModal: React.FC = () => {
  const { project } = useProjectStore();
  const { activeModal, setActiveModal, selectedTableId, theme } = useUiStore();

  // Dialecto objetivo para la exportación de scripts SQL DDL
  const [dialectoExportacion, setDialectoExportacion] = useState<SupportedDialect>(project.dialect);
  // Ámbito de exportación actual
  const [ambitoExportacion, establecerAmbitoExportacion] = useState<AmbitoExportacion>('all');
  // ID de la tabla seleccionada cuando el ámbito es 'single'
  const [idTablaIndividual, establecerIdTablaIndividual] = useState<string>(
    selectedTableId || (project.tables[0]?.id ?? '')
  );
  // Lista de IDs seleccionados cuando el ámbito es 'custom'
  const [idsTablasPersonalizadas, establecerIdsTablasPersonalizadas] = useState<string[]>(
    project.tables.map(t => t.id)
  );

  // Formato actualmente en proceso de exportación (ej: 'png', 'pdf' o null)
  const [exportandoEnProgreso, establecerExportandoEnProgreso] = useState<string | null>(null);
  // Mensaje temporal de notificación toast para el usuario
  const [notificacion, establecerNotificacion] = useState<string | null>(null);

  const esModoOscuro = theme === 'dark';

  // Determinar los IDs de tablas objetivo según el ámbito seleccionado
  const idsTablasObjetivo = useMemo(() => {
    if (ambitoExportacion === 'all') {
      return undefined; // Todas las tablas del esquema
    } else if (ambitoExportacion === 'single') {
      return idTablaIndividual ? [idTablaIndividual] : undefined;
    } else {
      return idsTablasPersonalizadas;
    }
  }, [ambitoExportacion, idTablaIndividual, idsTablasPersonalizadas]);

  // Nombre representativo para nombrar los archivos descargados
  const nombresTablasObjetivo = useMemo(() => {
    if (!idsTablasObjetivo) return 'base_de_datos_completa';
    if (idsTablasObjetivo.length === 1) {
      const tabla = project.tables.find(t => t.id === idsTablasObjetivo[0]);
      return tabla ? tabla.name : 'tabla';
    }
    return `${idsTablasObjetivo.length}_tablas`;
  }, [idsTablasObjetivo, project.tables]);

  if (activeModal !== 'export') return null;

  // Mostrar mensaje de éxito temporal en la parte superior del modal
  const mostrarNotificacion = (mensaje: string) => {
    establecerNotificacion(mensaje);
    setTimeout(() => establecerNotificacion(null), 3000);
  };

  // Exportar script DDL nativo en SQL
  const manejarExportarSql = () => {
    try {
      const generador = SqlGeneratorFactory.getGenerator(dialectoExportacion);
      const sql = generador.generate(project, {
        includeComments: true,
        includeForeignKeys: true,
        includeIndexes: true,
        selectedTableIds: idsTablasObjetivo,
      });

      const nombreArchivo = `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_${dialectoExportacion}.sql`;
      downloadFile(sql, nombreArchivo, 'application/sql');
      mostrarNotificacion(`¡Descarga iniciada: ${nombreArchivo}!`);
    } catch (error: any) {
      alert(`Error al generar SQL: ${error?.message}`);
    }
  };

  // Exportar documentación formal en formato Markdown
  const manejarExportarMarkdown = () => {
    try {
      const markdown = generateMarkdownDocumentation(project, idsTablasObjetivo);
      const nombreArchivo = `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_docs.md`;
      downloadFile(markdown, nombreArchivo, 'text/markdown');
      mostrarNotificacion(`¡Descarga iniciada: ${nombreArchivo}!`);
    } catch (error: any) {
      alert(`Error al generar Markdown: ${error?.message}`);
    }
  };

  // Exportar diccionario de datos estructurado en archivo CSV
  const manejarExportarCsv = () => {
    try {
      const csv = generateCsvDataDictionary(project, idsTablasObjetivo);
      const nombreArchivo = `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_dictionary.csv`;
      downloadFile(csv, nombreArchivo, 'text/csv');
      mostrarNotificacion(`¡Descarga iniciada: ${nombreArchivo}!`);
    } catch (error: any) {
      alert(`Error al generar CSV: ${error?.message}`);
    }
  };

  // Exportar esquema canónico en JSON
  const manejarExportarJson = () => {
    try {
      const tablasFiltradas = idsTablasObjetivo
        ? project.tables.filter(t => idsTablasObjetivo.includes(t.id))
        : project.tables;

      const conjuntoIdsTablas = new Set(tablasFiltradas.map(t => t.id));
      const relacionesFiltradas = project.relationships.filter(
        rel => conjuntoIdsTablas.has(rel.sourceTableId) && conjuntoIdsTablas.has(rel.targetTableId)
      );

      const proyectoParcial = {
        ...project,
        tables: tablasFiltradas,
        relationships: relacionesFiltradas,
      };

      const contenidoJson = JSON.stringify(proyectoParcial, null, 2);
      const nombreArchivo = `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_model.json`;
      downloadFile(contenidoJson, nombreArchivo, 'application/json');
      mostrarNotificacion(`¡Descarga iniciada: ${nombreArchivo}!`);
    } catch (error: any) {
      alert(`Error al exportar JSON: ${error?.message}`);
    }
  };

  // Exportar imagen gráfica en alta definición PNG
  const manejarExportarPng = async () => {
    const elementoLienzo = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (elementoLienzo) {
      establecerExportandoEnProgreso('png');
      // Breve pausa para permitir que React renderice inmediatamente el estado de carga visual en el botón
      await new Promise((resolve) => setTimeout(resolve, 60));
      try {
        await exportDiagramAsPng(
          elementoLienzo,
          project,
          idsTablasObjetivo,
          `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_diagram.png`,
          esModoOscuro
        );
        mostrarNotificacion('¡Imagen PNG generada y descargada!');
      } catch (error: any) {
        alert('Error al generar PNG: ' + error?.message);
      } finally {
        establecerExportandoEnProgreso(null);
      }
    }
  };

  // Exportar vector SVG
  const manejarExportarSvg = async () => {
    const elementoLienzo = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (elementoLienzo) {
      establecerExportandoEnProgreso('svg');
      await new Promise((resolve) => setTimeout(resolve, 60));
      try {
        await exportDiagramAsSvg(
          elementoLienzo,
          project,
          idsTablasObjetivo,
          `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_diagram.svg`,
          esModoOscuro
        );
        mostrarNotificacion('¡Vector SVG generado y descargado!');
      } catch (error: any) {
        alert('Error al generar SVG: ' + error?.message);
      } finally {
        establecerExportandoEnProgreso(null);
      }
    }
  };

  // Exportar documento PDF apaisado
  const manejarExportarPdf = async () => {
    const elementoLienzo = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (elementoLienzo) {
      establecerExportandoEnProgreso('pdf');
      await new Promise((resolve) => setTimeout(resolve, 60));
      try {
        await exportDiagramAsPdf(
          elementoLienzo,
          project,
          idsTablasObjetivo,
          `${project.name.toLowerCase().replace(/\s+/g, '_')}_${nombresTablasObjetivo}_diagram.pdf`,
          esModoOscuro
        );
        mostrarNotificacion('¡Documento PDF generado y descargado!');
      } catch (error: any) {
        alert('Error al generar PDF: ' + error?.message);
      } finally {
        establecerExportandoEnProgreso(null);
      }
    }
  };

  // Alternar selección de una tabla individual en el modo personalizado
  const alternarTablaPersonalizada = (idTabla: string) => {
    establecerIdsTablasPersonalizadas(prev =>
      prev.includes(idTabla) ? prev.filter(id => id !== idTabla) : [...prev, idTabla]
    );
  };

  // Seleccionar todas las tablas
  const seleccionarTodasPersonalizadas = () => {
    establecerIdsTablasPersonalizadas(project.tables.map(t => t.id));
  };

  // Deseleccionar todas las tablas
  const deseleccionarTodasPersonalizadas = () => {
    establecerIdsTablasPersonalizadas([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in text-xs transition-colors flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Centro de Exportación y Descarga Dinámica
            </span>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Banner de Notificación */}
          {notificacion && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-xl text-emerald-800 dark:text-emerald-300 animate-fade-in font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{notificacion}</span>
            </div>
          )}

          {/* 1. Selector de Ámbito de Exportación (Granularidad) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>¿Qué deseas exportar? (Ámbito Dinámico)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Motor: {project.dialect.toUpperCase()}
              </span>
            </div>

            {/* Selector de Ámbito mediante Botones de Radio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => establecerAmbitoExportacion('all')}
                className={`p-3 rounded-xl text-left transition-all relative ${
                  ambitoExportacion === 'all'
                    ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold shadow-sm ring-1 ring-brand-500/20'
                    : 'border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Base de Datos Completa</span>
                  {ambitoExportacion === 'all' && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Todas las tablas ({project.tables.length}) y relaciones
                </div>
              </button>

              <button
                onClick={() => establecerAmbitoExportacion('single')}
                className={`p-3 rounded-xl text-left transition-all relative ${
                  ambitoExportacion === 'single'
                    ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold shadow-sm ring-1 ring-brand-500/20'
                    : 'border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Una Sola Tabla</span>
                  {ambitoExportacion === 'single' && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Exportar únicamente 1 entidad
                </div>
              </button>

              <button
                onClick={() => establecerAmbitoExportacion('custom')}
                className={`p-3 rounded-xl text-left transition-all relative ${
                  ambitoExportacion === 'custom'
                    ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold shadow-sm ring-1 ring-brand-500/20'
                    : 'border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Selección Múltiple</span>
                  {ambitoExportacion === 'custom' && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {idsTablasPersonalizadas.length} de {project.tables.length} seleccionadas
                </div>
              </button>
            </div>

            {/* Ámbito: Selección de Tabla Única */}
            {ambitoExportacion === 'single' && (
              <div className="pt-2 animate-fade-in">
                <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                  Selecciona la tabla a exportar:
                </label>
                <select
                  value={idTablaIndividual}
                  onChange={(e) => establecerIdTablaIndividual(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                >
                  {project.tables.map(tbl => (
                    <option key={tbl.id} value={tbl.id}>
                      {tbl.name} ({tbl.columns.length} columnas)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Ámbito: Lista de Selección de Múltiples Tablas */}
            {ambitoExportacion === 'custom' && (
              <div className="pt-2 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Marca las tablas deseadas:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={seleccionarTodasPersonalizadas}
                      className="text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Seleccionar todas
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      onClick={deseleccionarTodasPersonalizadas}
                      className="text-slate-500 hover:underline"
                    >
                      Deseleccionar todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {project.tables.map(tbl => {
                    const estaMarcada = idsTablasPersonalizadas.includes(tbl.id);
                    return (
                      <label
                        key={tbl.id}
                        onClick={() => alternarTablaPersonalizada(tbl.id)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                          estaMarcada
                            ? 'bg-brand-500/15 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/50 font-medium'
                            : 'border border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        {estaMarcada ? (
                          <CheckSquare className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="font-mono text-xs truncate">{tbl.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Opciones de Formato de Descarga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Script SQL con Selector de Dialecto */}
            <div className="flex flex-col p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500 transition-all shadow-sm">
              <div
                onClick={manejarExportarSql}
                className="flex items-start gap-3 cursor-pointer group flex-1"
              >
                <FileCode className="w-5 h-5 text-brand-600 dark:text-brand-400 mt-0.5 group-hover:scale-110 transition-transform flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                    <span>Descargar Script SQL (.sql)</span>
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-mono bg-brand-500/10 dark:bg-brand-500/20 px-2 py-0.5 rounded-md border border-brand-500/30">
                      {dialectoExportacion.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    DDL estructurado con encabezado de auditoría para {nombresTablasObjetivo}.
                  </p>
                </div>
              </div>

              {/* Selector interactivo de dialecto SQL */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Dialecto de Salida:
                </span>
                <select
                  value={dialectoExportacion}
                  onChange={(e) => setDialectoExportacion(e.target.value as SupportedDialect)}
                  aria-label="Dialecto de exportación SQL"
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL / MariaDB</option>
                  <option value="sqlite">SQLite 3</option>
                  <option value="sqlserver">Microsoft SQL Server</option>
                  <option value="oracle">Oracle Database</option>
                </select>
              </div>
            </div>

            {/* Documentación Markdown */}
            <button
              onClick={manejarExportarMarkdown}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-all group shadow-sm"
            >
              <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Descargar Documentación (.md)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Diccionario en Markdown para {nombresTablasObjetivo}.
                </p>
              </div>
            </button>

            {/* Diccionario de Datos CSV */}
            <button
              onClick={manejarExportarCsv}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-all group shadow-sm"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Diccionario de Datos (.csv)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tabla de columnas compatible con Excel / Sheets con codificación UTF-8.
                </p>
              </div>
            </button>

            {/* Modelo Canónico JSON */}
            <button
              onClick={manejarExportarJson}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-all group shadow-sm"
            >
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Modelo Canónico IR (.json)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  JSON de la arquitectura para respaldos o compartir esquemas.
                </p>
              </div>
            </button>

            {/* Diagrama PNG */}
            <button
              onClick={manejarExportarPng}
              disabled={exportandoEnProgreso !== null}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-all group shadow-sm"
            >
              <Image className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {exportandoEnProgreso === 'png' ? 'Generando PNG...' : 'Diagrama PNG HD (2x Retina)'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Captura gráfica del diagrama adaptada al tema actual.
                </p>
              </div>
            </button>

            {/* Diagrama PDF */}
            <button
              onClick={manejarExportarPdf}
              disabled={exportandoEnProgreso !== null}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-all group shadow-sm"
            >
              <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {exportandoEnProgreso === 'pdf' ? 'Generando PDF...' : 'Esquema en PDF Apaisado'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Documento formal A3 con diagrama arquitectónico.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
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
