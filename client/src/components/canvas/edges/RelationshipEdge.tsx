import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { Trash2, Link } from 'lucide-react';
import { RelationshipIR } from '../../../core/ir/types';
import { useProjectStore } from '../../../stores/projectStore';
import { useUiStore } from '../../../stores/uiStore';

/**
 * Componente de arista de conexión visual para relaciones relacionales (Foreign Keys).
 * Representa la cardinalidad (1:1, 1:N, N:M), el estilo de línea identificadora y botón interactivo de eliminación.
 */
export const RelationshipEdge = memo((props: EdgeProps<{ relationship: RelationshipIR }>) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    data,
  } = props;

  const relacion = data?.relationship;
  const { removeRelationship } = useProjectStore();
  const { selectedRelationshipId, setSelectedRelationship } = useUiStore();

  // Cálculo de la curva Bezier suave entre los puertos de origen y destino
  const [rutaArista, etiquetaX, etiquetaY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const estaSeleccionada = selected || selectedRelationshipId === relacion?.id;

  // Estilos visuales dinámicos según estado de selección y si es relación identificadora
  const estiloArista: React.CSSProperties = {
    ...style,
    strokeWidth: estaSeleccionada ? 2.5 : 1.8,
    stroke: estaSeleccionada ? '#38BDF8' : '#6366F1',
    strokeDasharray: relacion?.isIdentifying ? undefined : '5,5', // Punteada para relaciones no identificadoras
    filter: estaSeleccionada ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))' : undefined,
  };

  return (
    <>
      <BaseEdge path={rutaArista} markerEnd={markerEnd} style={estiloArista} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${etiquetaX}px,${etiquetaY}px)`,
            pointerEvents: 'all',
          }}
          className="group flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-full px-2 py-0.5 shadow-lg text-[10px] font-mono select-none transition-all hover:scale-110 cursor-pointer"
          onClick={(evento) => {
            evento.stopPropagation();
            if (relacion) {
              setSelectedRelationship(relacion.id);
            }
          }}
        >
          <Link className="w-2.5 h-2.5 text-brand-400" />
          <span className="font-semibold text-slate-200">
            {relacion?.cardinality || '1:N'}
          </span>

          <button
            onClick={(evento) => {
              evento.stopPropagation();
              if (relacion) {
                removeRelationship(relacion.id);
              }
            }}
            className="hidden group-hover:block ml-0.5 text-slate-400 hover:text-rose-400 transition-colors"
            title="Eliminar relación"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

RelationshipEdge.displayName = 'RelationshipEdge';
