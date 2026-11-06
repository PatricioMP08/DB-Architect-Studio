import { create } from 'zustand';

/**
 * Pestañas disponibles en el panel inferior acoplable
 */
export type BottomPanelTab = 'sql' | 'diagnostics' | 'impact';

/**
 * Modales interactivos globales
 */
export type ModalType =
  | 'newProject'
  | 'importSql'
  | 'export'
  | 'shortcuts'
  | 'templates'
  | 'unsavedChanges'
  | null;

/**
 * Estado de la interfaz de usuario (visibilidad de paneles, selección, modales y tema visual)
 */
interface UiState {
  // Visibilidad de paneles laterales e inferior
  isLeftSidebarOpen: boolean;
  isRightInspectorOpen: boolean;
  isBottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;

  // Elementos activos seleccionados en el diagrama
  selectedTableId: string | null;
  selectedColumnId: string | null;
  selectedRelationshipId: string | null;

  // Modal activo actualmente en pantalla
  activeModal: ModalType;

  // Acción diferida a ejecutar tras confirmar el diálogo de cambios sin guardar
  pendingAction: (() => void) | null;

  // Mensaje de notificación flotante (toast)
  toastMessage: string | null;

  // Consulta de búsqueda y filtrado de tablas en la barra lateral
  searchQuery: string;

  // Tema visual de la plataforma (oscuro o claro)
  theme: 'dark' | 'light';

  // Estado de persistencia y autoguardado del proyecto
  saveStatus: 'saved' | 'saving' | 'unsaved';

  // Acciones de control de paneles
  toggleLeftSidebar: () => void;
  toggleRightInspector: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelOpen: (abierto: boolean) => void;
  setBottomPanelTab: (pestana: BottomPanelTab) => void;

  // Acciones de selección interactiva
  setSelectedTable: (idTabla: string | null) => void;
  setSelectedColumn: (idTabla: string | null, idColumna: string | null) => void;
  setSelectedRelationship: (idRelacion: string | null) => void;
  clearSelection: () => void;

  // Acciones de configuración visual y modales
  setActiveModal: (modal: ModalType) => void;
  setPendingAction: (accion: (() => void) | null) => void;
  showToast: (mensaje: string) => void;
  setSearchQuery: (consulta: string) => void;
  setTheme: (tema: 'dark' | 'light') => void;
  setSaveStatus: (estadoGuardado: 'saved' | 'saving' | 'unsaved') => void;
}

/**
 * Obtiene el tema visual inicial almacenado en LocalStorage o recurre al modo oscuro por defecto
 */
const obtenerTemaInicial = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    const temaGuardado = localStorage.getItem('db_architect_theme');
    if (temaGuardado === 'dark' || temaGuardado === 'light') return temaGuardado;
  }
  return 'dark';
};

export const useUiStore = create<UiState>((set) => ({
  isLeftSidebarOpen: true,
  isRightInspectorOpen: true,
  isBottomPanelOpen: true,
  bottomPanelTab: 'sql',

  selectedTableId: null,
  selectedColumnId: null,
  selectedRelationshipId: null,

  activeModal: null,
  pendingAction: null,
  toastMessage: null,
  searchQuery: '',
  theme: obtenerTemaInicial(),
  saveStatus: 'saved',

  // Alterna la visibilidad de la barra lateral izquierda
  toggleLeftSidebar: () => set(estado => ({ isLeftSidebarOpen: !estado.isLeftSidebarOpen })),

  // Alterna la visibilidad del panel inspector derecho
  toggleRightInspector: () => set(estado => ({ isRightInspectorOpen: !estado.isRightInspectorOpen })),

  // Alterna la visibilidad del panel inferior
  toggleBottomPanel: () => set(estado => ({ isBottomPanelOpen: !estado.isBottomPanelOpen })),

  // Establece explícitamente si el panel inferior está abierto o cerrado
  setBottomPanelOpen: (abierto) => set({ isBottomPanelOpen: abierto }),

  // Cambia la pestaña activa del panel inferior y asegura su apertura
  setBottomPanelTab: (pestana) => set({ bottomPanelTab: pestana, isBottomPanelOpen: true }),

  // Selecciona una tabla en el canvas y abre el inspector si aplica
  setSelectedTable: (idTabla) => set({
    selectedTableId: idTabla,
    selectedColumnId: null,
    selectedRelationshipId: null,
    isRightInspectorOpen: idTabla !== null ? true : false,
  }),

  // Selecciona una columna dentro de una tabla
  setSelectedColumn: (idTabla, idColumna) => set({
    selectedTableId: idTabla,
    selectedColumnId: idColumna,
    selectedRelationshipId: null,
    isRightInspectorOpen: true,
  }),

  // Selecciona una arista de relación entre tablas
  setSelectedRelationship: (idRelacion) => set({
    selectedRelationshipId: idRelacion,
    selectedTableId: null,
    selectedColumnId: null,
    isRightInspectorOpen: idRelacion !== null ? true : false,
  }),

  // Limpia cualquier selección activa en el lienzo
  clearSelection: () => set({
    selectedTableId: null,
    selectedColumnId: null,
    selectedRelationshipId: null,
  }),

  // Muestra o cierra un diálogo modal
  setActiveModal: (modal) => set({ activeModal: modal }),

  // Registra una acción pendiente a ejecutar tras confirmar modal de cambios sin guardar
  setPendingAction: (accion) => set({ pendingAction: accion }),

  // Muestra notificación toast flotante temporal
  showToast: (mensaje) => {
    set({ toastMessage: mensaje });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 3000);
  },

  // Actualiza la cadena de filtrado en el explorador
  setSearchQuery: (consulta) => set({ searchQuery: consulta }),

  // Aplica el tema visual al documento DOM y lo almacena localmente
  setTheme: (tema) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('db_architect_theme', tema);
    }
    if (tema === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme: tema });
  },

  // Actualiza el indicador de sincronización en la barra superior
  setSaveStatus: (estadoGuardado) => set({ saveStatus: estadoGuardado }),
}));
