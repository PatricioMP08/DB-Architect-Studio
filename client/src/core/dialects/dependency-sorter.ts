import { TableIR, RelationshipIR } from '../ir/types';

/**
 * Resultado del ordenamiento topológico de tablas y relaciones dependientes.
 */
export interface SortedTablesResult {
  sortedTables: TableIR[];
  circularRelations: RelationshipIR[];
}

/**
 * Ordena topológicamente las tablas de una base de datos utilizando el algoritmo de Kahn (O(V + E)).
 * Garantiza que las tablas maestras (padres) se creen antes que las tablas dependientes (hijos).
 * Detecta dependencias circulares y las aísla para permitir su resolución diferida vía ALTER TABLE.
 *
 * @param tables Lista de tablas del esquema
 * @param relationships Lista de relaciones entre tablas
 * @param selectedTableIds Filtro opcional de IDs de tablas a considerar
 */
export function sortTablesByDependencies(
  tables: TableIR[],
  relationships: RelationshipIR[],
  selectedTableIds?: string[]
): SortedTablesResult {
  // Filtrar si el usuario especificó una selección particular de tablas
  const tablasActivas = selectedTableIds && selectedTableIds.length > 0
    ? tables.filter(t => selectedTableIds.includes(t.id))
    : [...tables];

  const conjuntoIdsTablas = new Set(tablasActivas.map(t => t.id));

  // Filtrar exclusivamente relaciones que conectan tablas activas dentro del conjunto
  const relacionesActivas = relationships.filter(
    r => conjuntoIdsTablas.has(r.sourceTableId) && conjuntoIdsTablas.has(r.targetTableId)
  );

  // Construir el grafo dirigido de dependencias:
  // En el modelo relacional, sourceTableId contiene la Clave Foránea y apunta a targetTableId (maestra).
  // Por lo tanto, la tabla origen (hijo) DEPENDE de la tabla destino (padre).
  // La tabla padre debe crearse antes que la hija.
  const gradoEntrada: Map<string, number> = new Map();
  const listaAdyacencia: Map<string, string[]> = new Map();

  tablasActivas.forEach(tabla => {
    gradoEntrada.set(tabla.id, 0);
    listaAdyacencia.set(tabla.id, []);
  });

  const relacionesValidas: RelationshipIR[] = [];
  const relacionesCirculares: RelationshipIR[] = [];

  relacionesActivas.forEach(relacion => {
    // Evitar auto-referencias recursivas en el ordenamiento topológico directo
    if (relacion.sourceTableId === relacion.targetTableId) {
      return;
    }

    const idPadre = relacion.targetTableId;
    const idHijo = relacion.sourceTableId;

    // Verificar si ya existe una relación en sentido inverso (ciclo directo A -> B y B -> A)
    const existeRelacionInversa = relacionesValidas.some(
      r => r.sourceTableId === idPadre && r.targetTableId === idHijo
    );

    if (existeRelacionInversa) {
      relacionesCirculares.push(relacion);
    } else {
      relacionesValidas.push(relacion);
      listaAdyacencia.get(idPadre)?.push(idHijo);
      gradoEntrada.set(idHijo, (gradoEntrada.get(idHijo) || 0) + 1);
    }
  });

  // Inicializar la cola de Kahn con nodos sin dependencias pendientes (grado de entrada = 0)
  const cola: string[] = [];
  gradoEntrada.forEach((grado, idTabla) => {
    if (grado === 0) {
      cola.push(idTabla);
    }
  });

  const idsOrdenados: string[] = [];

  while (cola.length > 0) {
    const idActual = cola.shift()!;
    idsOrdenados.push(idActual);

    const vecinos = listaAdyacencia.get(idActual) || [];
    for (const idVecino of vecinos) {
      const nuevoGrado = (gradoEntrada.get(idVecino) || 1) - 1;
      gradoEntrada.set(idVecino, nuevoGrado);
      if (nuevoGrado === 0) {
        cola.push(idVecino);
      }
    }
  }

  // Si quedan nodos con grado > 0 al vaciar la cola, existen ciclos en el grafo
  if (idsOrdenados.length < tablasActivas.length) {
    const tablasRestantes = tablasActivas.filter(t => !idsOrdenados.includes(t.id));
    tablasRestantes.forEach(tabla => {
      idsOrdenados.push(tabla.id);
      // Las relaciones que apuntan a estas tablas se catalogan como circulares
      const relacionesHijas = relacionesActivas.filter(r => r.sourceTableId === tabla.id);
      relacionesHijas.forEach(rel => {
        if (!relacionesCirculares.includes(rel)) {
          relacionesCirculares.push(rel);
        }
      });
    });
  }

  const mapaTablas = new Map(tablasActivas.map(t => [t.id, t]));
  const tablasOrdenadas = idsOrdenados
    .map(id => mapaTablas.get(id))
    .filter((t): t is TableIR => t !== undefined);

  return {
    sortedTables: tablasOrdenadas,
    circularRelations: relacionesCirculares,
  };
}

