import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MarkerType,
  OnConnect,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TableNode } from './nodes/TableNode';
import { RelationshipEdge } from './edges/RelationshipEdge';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Maximize2,
  Sparkles,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  AlignLeft,
  AlignStartVertical,
} from 'lucide-react';

// Registro de tipos de nodos personalizados para React Flow
const tiposDeNodo = {
  tableNode: TableNode,
};

// Registro de tipos de aristas personalizadas para relaciones relacionales
const tiposDeArista = {
  relationshipEdge: RelationshipEdge,
};

const CanvasInner: React.FC = () => {
  const {
    project,
    updateTablePosition,
    addTable,
    addRelationship,
    autoLayout,
    alignTables,
    undo,
    redo,
    removeTable,
    removeRelationship,
  } = useProjectStore();

  const {
    theme,
    clearSelection,
    selectedTableId,
    selectedRelationshipId,
    setSaveStatus,
  } = useUiStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const haEnfocadoIdRef = useRef<string | null>(null);

  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  // Mapear tablas del Modelo Intermedio (IR) a Nodos visuales de React Flow
  const nodosLienzo: Node[] = useMemo(() => {
    return project.tables.map((tabla) => ({
      id: tabla.id,
      type: 'tableNode',
      position: tabla.position,
      data: { table: tabla },
      selected: selectedTableId === tabla.id,
    }));
  }, [project.tables, selectedTableId]);

  // Mapear relaciones del IR a Aristas visuales con marcadores de cardinalidad
  const aristasLienzo: Edge[] = useMemo(() => {
    return project.relationships.map((relacion) => ({
      id: relacion.id,
      source: relacion.sourceTableId,
      target: relacion.targetTableId,
      sourceHandle: `source-${relacion.sourceColumnId}`,
      targetHandle: `target-${relacion.targetColumnId}`,
      type: 'relationshipEdge',
      data: { relationship: relacion },
      selected: selectedRelationshipId === relacion.id,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: selectedRelationshipId === relacion.id ? '#38BDF8' : '#6366F1',
      },
    }));
  }, [project.relationships, selectedRelationshipId]);

  const [nodos, establecerNodos, alCambiarNodos] = useNodesState(nodosLienzo);
  const [aristas, establecerAristas, alCambiarAristas] = useEdgesState(aristasLienzo);

  // Sincronizar estado cuando cambie el proyecto en el almacén de datos
  useEffect(() => {
    establecerNodos(nodosLienzo);
  }, [nodosLienzo, establecerNodos]);

  useEffect(() => {
    establecerAristas(aristasLienzo);
  }, [aristasLienzo, establecerAristas]);

  // Función para enfocar el diagrama con zoom nítido y legible
  const enfocarTablas = useCallback((duracion = 400) => {
    fitView({
      padding: 0.2,
      minZoom: 0.85,
      maxZoom: 1.0,
      duration: duracion,
    });
  }, [fitView]);

  // Al iniciar o al cambiar el proyecto/tablas, enfocar automáticamente las tablas con zoom nítido y legible
  useEffect(() => {
    if (nodesInitialized && nodos.length > 0) {
      const claveActual = `${project.id}_${nodos.length}`;
      if (haEnfocadoIdRef.current !== claveActual) {
        haEnfocadoIdRef.current = claveActual;
        // Enfocar de inmediato
        enfocarTablas(0);
        // Y tras estabilización del layout de paneles
        const temporizador = setTimeout(() => {
          enfocarTablas(350);
        }, 150);
        return () => clearTimeout(temporizador);
      }
    }
  }, [nodesInitialized, nodos.length, project.id, enfocarTablas]);

  // Auto layout con re-enfoque automático
  const manejarAutoLayout = useCallback(() => {
    autoLayout();
    setTimeout(() => {
      enfocarTablas(400);
    }, 60);
  }, [autoLayout, enfocarTablas]);

  // Manejador de fin de arrastre de nodo para persistir posición en el store
  const alTerminarArrastreNodo = useCallback(
    (_: any, nodo: Node) => {
      updateTablePosition(nodo.id, nodo.position);
    },
    [updateTablePosition]
  );

  // Conexión interactiva entre columnas mediante drag & drop
  const alConectar: OnConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || !params.sourceHandle || !params.targetHandle) {
        return;
      }

      // Extraer IDs de columna desde los handles: "source-col_123" -> "col_123"
      const idColumnaOrigen = params.sourceHandle.replace(/^source-/, '');
      const idColumnaDestino = params.targetHandle.replace(/^target-/, '');

      const tablaOrigen = project.tables.find((t) => t.id === params.source);
      const tablaDestino = project.tables.find((t) => t.id === params.target);
      const columnaOrigen = tablaOrigen?.columns.find((c) => c.id === idColumnaOrigen);

      if (!tablaOrigen || !tablaDestino || !columnaOrigen) return;

      addRelationship({
        name: `fk_${tablaOrigen.name}_${columnaOrigen.name}`,
        sourceTableId: params.source,
        sourceColumnId: idColumnaOrigen,
        targetTableId: params.target,
        targetColumnId: idColumnaDestino,
        cardinality: columnaOrigen.isUnique ? '1:1' : '1:N',
        isIdentifying: columnaOrigen.isPrimaryKey,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      setSaveStatus('saved');
    },
    [project.tables, addRelationship, setSaveStatus]
  );

  // Doble clic en el lienzo crea una nueva tabla en la posición del puntero
  const alHacerDobleClic = useCallback(
    (evento: React.MouseEvent) => {
      const objetivo = evento.target as HTMLElement;
      // Solo disparar si se hace doble clic sobre el fondo del lienzo
      if (
        objetivo.classList.contains('react-flow__pane') ||
        objetivo.classList.contains('react-flow__background')
      ) {
        const limites = reactFlowWrapper.current?.getBoundingClientRect();
        if (limites) {
          const posX = evento.clientX - limites.left - 100;
          const posY = evento.clientY - limites.top - 50;
          addTable({ x: Math.max(20, posX), y: Math.max(20, posY) });
          setSaveStatus('saved');
        }
      }
    },
    [addTable, setSaveStatus]
  );

  // Atajos de teclado para modelado
  useEffect(() => {
    const alPresionarTecla = (e: KeyboardEvent) => {
      // Ignorar si se escribe dentro de un input, textarea o Monaco
      const etiquetaActiva = document.activeElement?.tagName.toLowerCase();
      if (etiquetaActiva === 'input' || etiquetaActiva === 'textarea') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTableId) {
          removeTable(selectedTableId);
          clearSelection();
        } else if (selectedRelationshipId) {
          removeRelationship(selectedRelationshipId);
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [selectedTableId, selectedRelationshipId, undo, redo, removeTable, removeRelationship, clearSelection]);

  return (
    <div
      ref={reactFlowWrapper}
      className="relative w-full h-full bg-[#F1F5F9] dark:bg-[#080C14] overflow-hidden transition-colors duration-200"
      onDoubleClick={alHacerDobleClic}
      onClick={() => clearSelection()}
    >
      <ReactFlow
        key={project.id}
        nodes={nodos}
        edges={aristas}
        onNodesChange={alCambiarNodos}
        onEdgesChange={alCambiarAristas}
        onNodeDragStop={alTerminarArrastreNodo}
        onConnect={alConectar}
        nodeTypes={tiposDeNodo}
        edgeTypes={tiposDeArista}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.85,
          maxZoom: 1.0,
        }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color={theme === 'dark' ? '#1E293B' : '#CBD5E1'}
        />

        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!bg-white/95 dark:!bg-slate-900/95 !border !border-slate-200 dark:!border-slate-800 !shadow-lg !rounded-xl !overflow-hidden [&>button]:!border-b [&>button]:!border-slate-200 dark:[&>button]:!border-slate-800 [&>button]:!bg-transparent hover:[&>button]:!bg-slate-100 dark:hover:[&>button]:!bg-slate-800 [&>button]:!text-slate-600 dark:[&>button]:!text-slate-300 [&>button>svg]:!fill-current"
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.85,
            maxZoom: 1.0,
            duration: 400,
          }}
        />

        {project.settings?.showMinimap && (
          <MiniMap
            nodeStrokeColor={theme === 'dark' ? '#6366F1' : '#4F46E5'}
            nodeColor={theme === 'dark' ? '#1E293B' : '#E2E8F0'}
            nodeBorderRadius={4}
            maskColor={theme === 'dark' ? 'rgba(8, 12, 20, 0.75)' : 'rgba(241, 245, 249, 0.75)'}
            position="bottom-right"
            style={{
              width: 150,
              height: 100,
              bottom: 16,
              right: 16,
            }}
          />
        )}
      </ReactFlow>

      {/* Estado Vacío cuando el Lienzo está en Blanco (0 tablas) */}
      {project.tables.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="pointer-events-auto max-w-sm text-center p-6 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in space-y-3 mx-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Lienzo en Blanco Listo
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Empieza a modelar tu arquitectura. Haz doble clic en el lienzo o pulsa el botón a continuación para agregar tu primera tabla.
              </p>
            </div>
            <button
              onClick={() => addTable({ x: 300, y: 180 }, 'usuarios')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-glow transition-all"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Crear Primera Tabla</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Canvas Quick Bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-md dark:shadow-xl transition-colors">
        <button
          onClick={manejarAutoLayout}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Organizar nodos automáticamente"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>Auto Layout</span>
        </button>

        <button
          onClick={() => enfocarTablas(400)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Enfocar y centrar todas las tablas con zoom óptimo"
        >
          <Maximize2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>Enfocar Tablas</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />

        <button
          onClick={() => zoomIn({ duration: 300 })}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Acercar (Zoom +)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => zoomOut({ duration: 300 })}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Alejar (Zoom -)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />

        <button
          onClick={() => alignTables('left')}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Alinear tablas a la izquierda"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => alignTables('top')}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Alinear tablas arriba"
        >
          <AlignStartVertical className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />

        <button
          onClick={() => addTable()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors shadow-glow"
        >
          <span>+ Nueva Tabla</span>
        </button>
      </div>

      {/* Subtle Hint on Canvas */}
      <div className="absolute bottom-4 left-16 z-10 text-[11px] text-slate-400 dark:text-slate-500 font-mono select-none pointer-events-none">
        Tip: Doble clic en el lienzo para crear tabla | Arrastra conectores entre columnas para crear FKs
      </div>
    </div>
  );
};

export const Canvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};
