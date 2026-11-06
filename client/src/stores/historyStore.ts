import { create } from 'zustand';
import { ProjectIR } from '../core/ir/types';

/**
 * Interfaz de la máquina de estados de historial para operaciones Deshacer/Rehacer.
 */
interface HistoryState {
  past: ProjectIR[];
  future: ProjectIR[];
  canUndo: boolean;
  canRedo: boolean;
  pushState: (proyectoActual: ProjectIR) => void;
  undo: (proyectoActual: ProjectIR) => ProjectIR | null;
  redo: (proyectoActual: ProjectIR) => ProjectIR | null;
  clearHistory: () => void;
}

// Límite máximo de instantáneas retenidas en la pila de memoria para preservar rendimiento
const MAXIMO_HISTORIAL = 40;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  // Registra el estado actual antes de aplicar una nueva mutación
  pushState: (proyectoActual: ProjectIR) => {
    // Clonación profunda e inmutable del estado
    const instantanea = JSON.parse(JSON.stringify(proyectoActual));
    set(estado => {
      const nuevoPasado = [...estado.past, instantanea].slice(-MAXIMO_HISTORIAL);
      return {
        past: nuevoPasado,
        future: [], // Cualquier nueva acción de edición invalida la rama de rehacer
        canUndo: true,
        canRedo: false,
      };
    });
  },

  // Deshace la última acción y restaura la instantánea previa
  undo: (proyectoActual: ProjectIR) => {
    const { past, future } = get();
    if (past.length === 0) return null;

    const estadoAnterior = past[past.length - 1];
    const nuevoPasado = past.slice(0, past.length - 1);
    const instantaneaActual = JSON.parse(JSON.stringify(proyectoActual));

    set({
      past: nuevoPasado,
      future: [instantaneaActual, ...future],
      canUndo: nuevoPasado.length > 0,
      canRedo: true,
    });

    return JSON.parse(JSON.stringify(estadoAnterior));
  },

  // Rehace la acción previamente deshecha
  redo: (proyectoActual: ProjectIR) => {
    const { past, future } = get();
    if (future.length === 0) return null;

    const estadoSiguiente = future[0];
    const nuevoFuturo = future.slice(1);
    const instantaneaActual = JSON.parse(JSON.stringify(proyectoActual));

    set({
      past: [...past, instantaneaActual],
      future: nuevoFuturo,
      canUndo: true,
      canRedo: nuevoFuturo.length > 0,
    });

    return JSON.parse(JSON.stringify(estadoSiguiente));
  },

  // Restablece por completo las pilas de deshacer y rehacer
  clearHistory: () => {
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));
