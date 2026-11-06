import React, { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { CheckCircle2 } from 'lucide-react';
import { Header } from './components/header/Header';
import { Sidebar } from './components/sidebar/Sidebar';
import { Canvas } from './components/canvas/Canvas';
import { Inspector } from './components/inspector/Inspector';
import { BottomPanel } from './components/bottom-panel/BottomPanel';
import { ExportModal } from './components/modals/ExportModal';
import { ImportSqlModal } from './components/modals/ImportSqlModal';
import { TemplatesModal } from './components/modals/TemplatesModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal';
import { useUiStore } from './stores/uiStore';
import { useProjectStore } from './stores/projectStore';

/**
 * Componente Principal de la Plataforma DB Architect Studio.
 * Ensambla el diseño visual multipanel (Explorador Izquierdo, Lienzo Central con Panel Inferior
 * e Inspector Lateral Derecho) y gestiona la prevención de pérdida de cambios, atajos de guardado
 * (Ctrl + S) y la sincronización con el proceso nativo de Electron o navegador web.
 */
export const App: React.FC = () => {
  const {
    isLeftSidebarOpen,
    isRightInspectorOpen,
    isBottomPanelOpen,
    theme,
    toastMessage,
    setActiveModal,
    setPendingAction,
  } = useUiStore();

  const {
    project,
    setProject,
    hasUnsavedChanges,
    saveProject,
    saveProjectToDisk,
    markAsSaved,
    markAsUnsaved,
  } = useProjectStore();

  // Sincronizar clase 'dark' en el elemento raíz <html> para TailwindCSS
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Cargar el proyecto previamente almacenado en localStorage al iniciar la sesión
  useEffect(() => {
    try {
      const proyectoGuardado = localStorage.getItem('db_architect_current_project');
      if (proyectoGuardado) {
        const proyectoParseado = JSON.parse(proyectoGuardado);
        if (proyectoParseado && proyectoParseado.tables) {
          setProject(proyectoParseado);
          markAsSaved();
          return;
        }
      }
      // Si no existe proyecto guardado previamente, marcar como pendiente de guardado
      markAsUnsaved();
    } catch (errorCarga) {
      console.warn('No se pudo cargar el proyecto desde almacenamiento local', errorCarga);
      markAsUnsaved();
    }
  }, [setProject, markAsSaved, markAsUnsaved]);

  // Protección ante cierre del navegador o pestaña con cambios sin guardar (beforeunload)
  useEffect(() => {
    const manejarAntesDeCerrar = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', manejarAntesDeCerrar);
    return () => window.removeEventListener('beforeunload', manejarAntesDeCerrar);
  }, [hasUnsavedChanges]);

  // Atajo de teclado global Ctrl + S (guardar local) y Ctrl + Shift + S (guardar en disco)
  useEffect(() => {
    const manejarAtajosTeclado = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          saveProjectToDisk();
        } else {
          saveProject();
        }
      }
    };

    window.addEventListener('keydown', manejarAtajosTeclado);
    return () => window.removeEventListener('keydown', manejarAtajosTeclado);
  }, [saveProject, saveProjectToDisk]);

  // Integración IPC para aplicación de escritorio Electron
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return;

    const electron = (window as any).electronAPI;

    // Guardar y salir cuando Electron lo solicita desde el diálogo nativo de cierre
    const desuscribirGuardarYSalir = electron.onGuardarYSalir?.(() => {
      saveProject();
      electron.cerrarVentanaForzada?.();
    });

    // Menús nativos de Electron con confirmación previa si hay cambios pendientes
    const desuscribirNuevo = electron.onNuevoProyectoMenu?.(() => {
      if (hasUnsavedChanges) {
        setPendingAction(() => setActiveModal('newProject'));
        setActiveModal('unsavedChanges');
      } else {
        setActiveModal('newProject');
      }
    });

    const desuscribirImportar = electron.onImportarSqlMenu?.(() => {
      if (hasUnsavedChanges) {
        setPendingAction(() => setActiveModal('importSql'));
        setActiveModal('unsavedChanges');
      } else {
        setActiveModal('importSql');
      }
    });

    const desuscribirExportar = electron.onExportarMenu?.(() => {
      setActiveModal('export');
    });

    const desuscribirAtajos = electron.onMostrarAtajosMenu?.(() => {
      setActiveModal('shortcuts');
    });

    const desuscribirPlantillas = electron.onMostrarPlantillasMenu?.(() => {
      if (hasUnsavedChanges) {
        setPendingAction(() => setActiveModal('templates'));
        setActiveModal('unsavedChanges');
      } else {
        setActiveModal('templates');
      }
    });

    return () => {
      desuscribirGuardarYSalir?.();
      desuscribirNuevo?.();
      desuscribirImportar?.();
      desuscribirExportar?.();
      desuscribirAtajos?.();
      desuscribirPlantillas?.();
    };
  }, [hasUnsavedChanges, saveProject, setActiveModal, setPendingAction]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-100 dark:bg-background text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Barra de Navegación Superior */}
      <Header />

      {/* Área de Trabajo Redimensionable */}
      <div className="flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden relative">
        <PanelGroup direction="horizontal">
          {/* Panel Izquierdo: Explorador de Esquema */}
          {isLeftSidebarOpen && (
            <>
              <Panel defaultSize={18} minSize={14} maxSize={28} className="h-full z-10">
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-1 bg-slate-300 dark:bg-slate-800/80 hover:bg-brand-500 transition-colors cursor-col-resize z-20" />
            </>
          )}

          {/* Lienzo Central + Panel Inferior Acoplable */}
          <Panel className="h-full flex flex-col relative">
            <PanelGroup direction="vertical">
              {/* Lienzo Interactivo con React Flow */}
              <Panel defaultSize={isBottomPanelOpen ? 72 : 96} minSize={40} className="w-full h-full relative">
                <Canvas />
              </Panel>

              {/* Panel Inferior: Consola SQL, Auditoría de Salud y Análisis de Impacto */}
              <PanelResizeHandle className="h-1 bg-slate-300 dark:bg-slate-800/80 hover:bg-brand-500 transition-colors cursor-row-resize z-20" />
              <Panel
                defaultSize={isBottomPanelOpen ? 28 : 4}
                minSize={isBottomPanelOpen ? 16 : 4}
                maxSize={55}
                className="w-full z-10"
              >
                <BottomPanel />
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Panel Derecho: Inspector de Propiedades */}
          {isRightInspectorOpen && (
            <>
              <PanelResizeHandle className="w-1 bg-slate-300 dark:bg-slate-800/80 hover:bg-brand-500 transition-colors cursor-col-resize z-20" />
              <Panel defaultSize={22} minSize={18} maxSize={32} className="h-full z-10">
                <Inspector />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Diálogos Modales */}
      <NewProjectModal />
      <ExportModal />
      <ImportSqlModal />
      <TemplatesModal />
      <ShortcutsModal />
      <UnsavedChangesModal />

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700/60 backdrop-blur-md animate-fade-in transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
