import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Undo2,
  Redo2,
  Download,
  Upload,
  BookOpen,
  Keyboard,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  Search,
  Share2,
  ChevronDown,
  FilePlus,
  Save,
  HardDrive,
  FolderOpen,
  FileCode,
  ExternalLink,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { useHistoryStore } from '../../stores/historyStore';
import { SupportedDialect } from '../../core/ir/types';

export const Header: React.FC = () => {
  const {
    project,
    setProject,
    setDialect,
    updateProjectMeta,
    undo,
    redo,
    healthResult,
    hasUnsavedChanges,
    saveProject,
    saveProjectToDisk,
  } = useProjectStore();

  const {
    canUndo,
    canRedo,
  } = useHistoryStore();

  const {
    theme,
    setTheme,
    setActiveModal,
    setPendingAction,
    searchQuery,
    setSearchQuery,
    saveStatus,
    setBottomPanelTab,
    showToast,
  } = useUiStore();

  // Función para ejecutar acciones potencialmente destructivas previa confirmación de cambios
  const ejecutarConConfirmacion = (accion: () => void) => {
    if (hasUnsavedChanges || saveStatus === 'unsaved') {
      setPendingAction(accion);
      setActiveModal('unsavedChanges');
    } else {
      accion();
    }
  };

  // Estado para el modo de edición del nombre del proyecto
  const [estaEditandoNombre, establecerEstaEditandoNombre] = useState(false);
  // Texto temporal para el nombre mientras se edita
  const [textoNombre, establecerTextoNombre] = useState(project.name);

  // Manejador para guardar el nuevo nombre del proyecto
  const manejarEnvioNombre = (e: React.FormEvent) => {
    e.preventDefault();
    if (textoNombre.trim()) {
      updateProjectMeta(textoNombre.trim());
    }
    establecerEstaEditandoNombre(false);
  };

  // Estados y referencias para el menú desplegable de Guardar y Respaldo
  const [menuGuardarAbierto, setMenuGuardarAbierto] = useState(false);
  const contenedorGuardarRef = useRef<HTMLDivElement>(null);
  const inputCargarDiscoRef = useRef<HTMLInputElement>(null);

  // Cerrar el menú de guardado al hacer clic fuera
  useEffect(() => {
    const manejarClicFuera = (e: MouseEvent) => {
      if (contenedorGuardarRef.current && !contenedorGuardarRef.current.contains(e.target as Node)) {
        setMenuGuardarAbierto(false);
      }
    };

    if (menuGuardarAbierto) {
      document.addEventListener('mousedown', manejarClicFuera);
    }
    return () => document.removeEventListener('mousedown', manejarClicFuera);
  }, [menuGuardarAbierto]);

  // Manejador para cargar un proyecto desde un archivo JSON local
  const manejarCargaArchivoDisco = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (evento) => {
      try {
        const contenido = evento.target?.result as string;
        const proyectoCargado = JSON.parse(contenido);
        if (!proyectoCargado || !Array.isArray(proyectoCargado.tables)) {
          showToast('El archivo seleccionado no tiene la estructura de un proyecto válido');
          return;
        }

        ejecutarConConfirmacion(() => {
          setProject(proyectoCargado);
          saveProject();
          showToast(`¡Proyecto "${proyectoCargado.name}" restaurado con éxito desde disco!`);
        });
      } catch (err) {
        console.error(err);
        showToast('Error al leer el archivo JSON');
      }
    };
    lector.readAsText(archivo);
    e.target.value = '';
    setMenuGuardarAbierto(false);
  };

  // Obtener estilos y etiquetas visuales según el dialecto SQL seleccionado
  const obtenerInsigniaDialecto = (dialecto: SupportedDialect) => {
    switch (dialecto) {
      case 'postgres':
        return { label: 'PostgreSQL', bg: 'bg-[#336791]/15 dark:bg-[#336791]/20', border: 'border-[#336791]/40 dark:border-[#336791]/60', text: 'text-[#2b587e] dark:text-[#6495ED]' };
      case 'mysql':
        return { label: 'MySQL', bg: 'bg-[#00758F]/15 dark:bg-[#00758F]/20', border: 'border-[#00758F]/40 dark:border-[#00758F]/60', text: 'text-[#006075] dark:text-[#00A8CC]' };
      case 'sqlite':
        return { label: 'SQLite', bg: 'bg-[#003B57]/15 dark:bg-[#003B57]/20', border: 'border-[#003B57]/40 dark:border-[#003B57]/60', text: 'text-[#003B57] dark:text-[#38BDF8]' };
      case 'sqlserver':
        return { label: 'SQL Server', bg: 'bg-[#0078D4]/15 dark:bg-[#0078D4]/20', border: 'border-[#0078D4]/40 dark:border-[#0078D4]/60', text: 'text-[#005a9e] dark:text-[#60A5FA]' };
      case 'oracle':
        return { label: 'Oracle DB', bg: 'bg-[#F80000]/15 dark:bg-[#F80000]/20', border: 'border-[#F80000]/40 dark:border-[#F80000]/60', text: 'text-[#b91c1c] dark:text-[#F87171]' };
    }
  };

  const infoDialecto = obtenerInsigniaDialecto(project.dialect);

  // Obtener clase de color para el indicador de salud del esquema según su puntuación
  const obtenerColorPuntuacion = (puntuacion: number) => {
    if (puntuacion >= 90) return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30';
    if (puntuacion >= 70) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30';
    return 'text-rose-700 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30';
  };

  return (
    <header className="h-14 bg-white dark:bg-[#0B0F17] border-b border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between select-none z-30 transition-colors duration-200">
      {/* Sección Izquierda: Identidad de Marca y Nombre de Proyecto */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="DB Architect Studio" className="w-7 h-7 drop-shadow-md" />
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white hidden md:inline">
            DB Architect <span className="text-brand-600 dark:text-brand-400 font-mono text-xs font-normal">STUDIO</span>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Nombre de Proyecto con Edición Inline */}
        {estaEditandoNombre ? (
          <form onSubmit={manejarEnvioNombre}>
            <input
              autoFocus
              value={textoNombre}
              onChange={(e) => establecerTextoNombre(e.target.value)}
              onBlur={manejarEnvioNombre}
              className="bg-slate-100 dark:bg-slate-900 border border-brand-500 rounded px-2 py-0.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
            />
          </form>
        ) : (
          <span
            onDoubleClick={() => establecerEstaEditandoNombre(true)}
            title="Doble clic para renombrar proyecto"
            className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-brand-600 dark:hover:text-brand-300 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60"
          >
            {project.name}
          </span>
        )}

        {/* Selector de Dialecto SQL */}
        <div className="relative group ml-1">
          <select
            value={project.dialect}
            onChange={(e) => setDialect(e.target.value as SupportedDialect)}
            aria-label="Motor SQL del proyecto"
            className={`appearance-none text-xs font-mono font-medium px-2.5 py-1 pr-6 rounded-lg border ${infoDialecto.bg} ${infoDialecto.border} ${infoDialecto.text} cursor-pointer focus:outline-none`}
          >
            <option value="postgres" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">PostgreSQL</option>
            <option value="mysql" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">MySQL</option>
            <option value="sqlite" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">SQLite</option>
            <option value="sqlserver" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">SQL Server</option>
            <option value="oracle" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Oracle DB</option>
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 top-2 pointer-events-none text-slate-400" />
        </div>

        {/* Botón interactivo de Guardar con Menú Desplegable de Respaldo */}
        <div ref={contenedorGuardarRef} className="relative">
          {/* Input oculto para cargar archivos de proyecto desde disco */}
          <input
            ref={inputCargarDiscoRef}
            type="file"
            accept=".json,.dbmodel"
            onChange={manejarCargaArchivoDisco}
            className="hidden"
          />

          <div
            className={`inline-flex items-center rounded-lg border text-xs font-medium transition-all shadow-sm ${
              hasUnsavedChanges
                ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60'
            }`}
          >
            {/* Botón principal de guardado rápido local */}
            <button
              onClick={() => saveProject()}
              title={
                hasUnsavedChanges
                  ? 'Tienes cambios sin guardar. Haz clic para guardar en el navegador (Ctrl + S)'
                  : 'Proyecto guardado en el navegador (Ctrl + S)'
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-l-lg transition-colors ${
                hasUnsavedChanges
                  ? 'hover:bg-amber-500/25 animate-pulse'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {hasUnsavedChanges ? (
                <>
                  <Save className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">Guardar</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Guardado</span>
                </>
              )}
            </button>

            {/* Separador vertical sutil */}
            <div
              className={`w-[1px] h-4 ${
                hasUnsavedChanges ? 'bg-amber-500/40' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />

            {/* Botón selector de opciones desplegable */}
            <button
              onClick={() => setMenuGuardarAbierto(!menuGuardarAbierto)}
              title="Más opciones de guardado y respaldo en disco"
              className={`px-1.5 py-1 rounded-r-lg transition-colors ${
                hasUnsavedChanges
                  ? 'hover:bg-amber-500/25 text-amber-700 dark:text-amber-300'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  menuGuardarAbierto ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Menú Flotante de Opciones de Guardado */}
          {menuGuardarAbierto && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 z-50 animate-fade-in text-xs select-none">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Opciones de Guardado y Respaldo
              </div>

              {/* Opción 1: Guardar en el Navegador */}
              <button
                onClick={() => {
                  saveProject();
                  setMenuGuardarAbierto(false);
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
              >
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <Save className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Guardar en Navegador
                    </span>
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 font-mono">
                      Ctrl+S
                    </kbd>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Almacenamiento local rápido para continuar tu sesión.
                  </p>
                </div>
              </button>

              {/* Opción 2: Guardar Copia en Disco */}
              <button
                onClick={() => {
                  saveProjectToDisk();
                  setMenuGuardarAbierto(false);
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
              >
                <div className="p-1.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 mt-0.5">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Guardar Copia en Disco
                    </span>
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 font-mono">
                      Ctrl+Shift+S
                    </kbd>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Descarga un archivo .dbmodel.json para evitar perder tu avance.
                  </p>
                </div>
              </button>

              {/* Opción 3: Cargar Proyecto desde Disco */}
              <button
                onClick={() => {
                  inputCargarDiscoRef.current?.click();
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
              >
                <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 mt-0.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Abrir Proyecto desde Disco
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Restaura un archivo .json o .dbmodel guardado previamente.
                  </p>
                </div>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

              {/* Opción 4: Centro de Exportación */}
              <button
                onClick={() => {
                  setActiveModal('export');
                  setMenuGuardarAbierto(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-brand-500/10 text-brand-600 dark:text-brand-400 transition-colors font-medium"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Ir al Centro de Exportación</span>
                </div>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Search & Health Score */}
      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tabla o columna..."
            className="w-48 lg:w-64 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono transition-all"
          />
        </div>

        {/* Indicador de Salud del Esquema (Health Score) */}
        <button
          onClick={() => setBottomPanelTab('diagnostics')}
          title="Ver análisis de salud y diagnóstico del esquema"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-transform hover:scale-105 shadow-sm ${obtenerColorPuntuacion(
            healthResult.score
          )}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Salud: {healthResult.score}/100 ({healthResult.grade})</span>
        </button>
      </div>

      {/* Right: Actions, Undo/Redo & Modals */}
      <div className="flex items-center gap-1.5">
        {/* Undo / Redo */}
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Deshacer (Ctrl + Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => redo()}
          disabled={!canRedo}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Rehacer (Ctrl + Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Nuevo Proyecto */}
        <button
          onClick={() => ejecutarConConfirmacion(() => setActiveModal('newProject'))}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium border border-slate-200/80 dark:border-slate-700/60 shadow-sm"
          title="Crear un nuevo proyecto desde cero"
        >
          <FilePlus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span className="hidden sm:inline">Nuevo</span>
        </button>

        {/* Templates */}
        <button
          onClick={() => ejecutarConConfirmacion(() => setActiveModal('templates'))}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Cargar esquema de ejemplo"
        >
          <BookOpen className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span className="hidden sm:inline">Plantillas</span>
        </button>

        {/* Import SQL */}
        <button
          onClick={() => ejecutarConConfirmacion(() => setActiveModal('importSql'))}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Ingeniería inversa desde script SQL"
        >
          <Upload className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="hidden sm:inline">Importar</span>
        </button>

        {/* Export */}
        <button
          onClick={() => setActiveModal('export')}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-all shadow-glow"
          title="Exportar SQL, PNG, SVG o Markdown"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Shortcuts */}
        <button
          onClick={() => setActiveModal('shortcuts')}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Atajos de teclado"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
