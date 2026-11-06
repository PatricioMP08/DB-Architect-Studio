import { ProjectIR, HealthScoreResult, SchemaIssue } from '../ir/types';

/**
 * Motor de análisis de salud y calidad de esquemas relacionales.
 * Evalúa el modelo de datos según mejores prácticas de ingeniería, integridad referencial y normalización.
 *
 * @param project Objeto del proyecto con tablas y relaciones
 * @returns HealthScoreResult con puntuación de 0 a 100, calificación (A+, A, B, C, D, F) e incidencias
 */
export function analyzeSchemaHealth(project: ProjectIR): HealthScoreResult {
  const incidencias: SchemaIssue[] = [];
  const { tables, relationships } = project;

  let deduccionPuntaje = 0;

  // Métricas acumulativas del esquema
  const totalTablas = tables.length;
  let totalColumnas = 0;
  let tablasConPK = 0;
  let tablasSinPK = 0;
  let clavesForaneasIndexadas = 0;
  let clavesForaneasNoIndexadas = 0;

  // Mapeos rápidos para búsqueda eficiente O(1)
  const mapaTablas = new Map(tables.map(t => [t.id, t]));
  const idsTablasConectadas = new Set<string>();

  relationships.forEach(rel => {
    idsTablasConectadas.add(rel.sourceTableId);
    idsTablasConectadas.add(rel.targetTableId);
  });

  // 1. Análisis de Tablas y Columnas
  tables.forEach(tabla => {
    totalColumnas += tabla.columns.length;

    // Regla: Detección obligatoria de Clave Primaria (Primary Key)
    const clavesPrimarias = tabla.columns.filter(c => c.isPrimaryKey);
    if (clavesPrimarias.length === 0) {
      tablasSinPK++;
      deduccionPuntaje += 15;
      incidencias.push({
        id: `missing-pk-${tabla.id}`,
        severity: 'error',
        code: 'MISSING_PRIMARY_KEY',
        message: `La tabla "${tabla.name}" no tiene clave primaria (PK) definida.`,
        suggestion: `Agrega una columna "id" de tipo INT/BIGINT con Auto-Increment o UUID para garantizar unicidad y rendimiento en índices clusterizados.`,
        tableId: tabla.id,
        tableName: tabla.name,
        autoFixAvailable: true,
      });
    } else {
      tablasConPK++;
    }

    // Regla: Detección de columnas con nombres duplicados dentro de la misma tabla
    const conteoNombresColumnas = new Map<string, number>();
    tabla.columns.forEach(col => {
      const nombreNormalizado = col.name.trim().toLowerCase();
      conteoNombresColumnas.set(nombreNormalizado, (conteoNombresColumnas.get(nombreNormalizado) || 0) + 1);
    });

    conteoNombresColumnas.forEach((repeticiones, nombreCol) => {
      if (repeticiones > 1) {
        deduccionPuntaje += 20;
        incidencias.push({
          id: `duplicate-col-${tabla.id}-${nombreCol}`,
          severity: 'error',
          code: 'DUPLICATE_COLUMN_NAME',
          message: `La tabla "${tabla.name}" contiene columnas duplicadas con el nombre "${nombreCol}".`,
          suggestion: `Renombra o elimina la columna duplicada para evitar fallos sintácticos en el motor SQL.`,
          tableId: tabla.id,
          tableName: tabla.name,
        });
      }
    });

    // Regla: Tablas vacías (sin ninguna columna definida)
    if (tabla.columns.length === 0) {
      deduccionPuntaje += 10;
      incidencias.push({
        id: `empty-table-${tabla.id}`,
        severity: 'warning',
        code: 'EMPTY_TABLE',
        message: `La tabla "${tabla.name}" no tiene ninguna columna definida.`,
        suggestion: `Agrega al menos una columna de clave primaria y campos descriptivos.`,
        tableId: tabla.id,
        tableName: tabla.name,
      });
    }

    // Regla: Tablas desconectadas o huérfanas en modelos con múltiples entidades
    if (tables.length > 2 && !idsTablasConectadas.has(tabla.id)) {
      deduccionPuntaje += 5;
      incidencias.push({
        id: `orphan-table-${tabla.id}`,
        severity: 'info',
        code: 'DISCONNECTED_TABLE',
        message: `La tabla "${tabla.name}" está aislada y no tiene ninguna relación con el resto del modelo.`,
        suggestion: `Verifica si debería relacionarse mediante Foreign Key con alguna otra entidad del dominio.`,
        tableId: tabla.id,
        tableName: tabla.name,
      });
    }
  });

  // 2. Análisis de Relaciones y Claves Foráneas
  relationships.forEach(relacion => {
    const tablaOrigen = mapaTablas.get(relacion.sourceTableId);
    const tablaDestino = mapaTablas.get(relacion.targetTableId);

    // Relaciones rotas donde la tabla origen o destino fue eliminada
    if (!tablaOrigen || !tablaDestino) {
      deduccionPuntaje += 25;
      incidencias.push({
        id: `broken-rel-${relacion.id}`,
        severity: 'error',
        code: 'BROKEN_RELATIONSHIP',
        message: `La relación "${relacion.name || 'FK'}" hace referencia a una tabla eliminada o inexistente.`,
        suggestion: `Elimina la relación huérfana.`,
        relationshipId: relacion.id,
      });
      return;
    }

    const columnaOrigen = tablaOrigen.columns.find(c => c.id === relacion.sourceColumnId);
    const columnaDestino = tablaDestino.columns.find(c => c.id === relacion.targetColumnId);

    // Relaciones incompletas donde las columnas no se encuentran en las tablas
    if (!columnaOrigen || !columnaDestino) {
      deduccionPuntaje += 20;
      incidencias.push({
        id: `incomplete-fk-${relacion.id}`,
        severity: 'error',
        code: 'INCOMPLETE_RELATIONSHIP',
        message: `La relación entre "${tablaOrigen.name}" y "${tablaDestino.name}" referencia columnas no encontradas.`,
        suggestion: `Asocia la relación a columnas válidas o redefínela.`,
        relationshipId: relacion.id,
      });
      return;
    }

    // Incompatibilidad de tipos de datos en la clave foránea
    if (columnaOrigen.dataType !== columnaDestino.dataType) {
      deduccionPuntaje += 15;
      incidencias.push({
        id: `type-mismatch-${relacion.id}`,
        severity: 'error',
        code: 'FOREIGN_KEY_TYPE_MISMATCH',
        message: `Incompatibilidad de tipos en relación: "${tablaOrigen.name}.${columnaOrigen.name}" (${columnaOrigen.dataType}) no coincide con "${tablaDestino.name}.${columnaDestino.name}" (${columnaDestino.dataType}).`,
        suggestion: `Cambia el tipo de dato de "${columnaOrigen.name}" a "${columnaDestino.dataType}" para permitir la integridad referencial sin degradación de rendimiento.`,
        tableId: tablaOrigen.id,
        tableName: tablaOrigen.name,
        columnId: columnaOrigen.id,
        columnName: columnaOrigen.name,
        relationshipId: relacion.id,
      });
    }

    // Regla de rendimiento: Índices ausentes en columnas que actúan como Clave Foránea
    const estaIndexada = tablaOrigen.indexes?.some(idx =>
      idx.columnIds.includes(columnaOrigen.id)
    );

    if (estaIndexada || columnaOrigen.isPrimaryKey || columnaOrigen.isUnique) {
      clavesForaneasIndexadas++;
    } else {
      clavesForaneasNoIndexadas++;
      deduccionPuntaje += 4;
      incidencias.push({
        id: `missing-fk-idx-${tablaOrigen.id}-${columnaOrigen.id}`,
        severity: 'warning',
        code: 'MISSING_FK_INDEX',
        message: `La clave foránea "${tablaOrigen.name}.${columnaOrigen.name}" no tiene un índice explícito creado.`,
        suggestion: `Crea un índice en "${tablaOrigen.name}.${columnaOrigen.name}" para evitar Table Scans durante JOINs y operaciones de borrado en cascada.`,
        tableId: tablaOrigen.id,
        tableName: tablaOrigen.name,
        columnId: columnaOrigen.id,
        columnName: columnaOrigen.name,
        autoFixAvailable: true,
      });
    }
  });

  // Cálculo final de la puntuación en rango cerrado de 0 a 100
  const puntuacionFinal = Math.max(0, Math.min(100, Math.round(100 - deduccionPuntaje)));

  let calificacion: HealthScoreResult['grade'] = 'F';
  if (puntuacionFinal >= 95) calificacion = 'A+';
  else if (puntuacionFinal >= 85) calificacion = 'A';
  else if (puntuacionFinal >= 70) calificacion = 'B';
  else if (puntuacionFinal >= 55) calificacion = 'C';
  else if (puntuacionFinal >= 40) calificacion = 'D';
  else calificacion = 'F';

  return {
    score: puntuacionFinal,
    grade: calificacion,
    issues: incidencias,
    metrics: {
      totalTables: totalTablas,
      totalColumns: totalColumnas,
      totalRelationships: relationships.length,
      tablesWithPK: tablasConPK,
      tablesWithoutPK: tablasSinPK,
      indexedForeignKeys: clavesForaneasIndexadas,
      unindexedForeignKeys: clavesForaneasNoIndexadas,
    },
  };
}

/**
 * Reporte de análisis de impacto relacional.
 */
export interface ImpactReport {
  target: 'table' | 'column';
  affectedTables: { id: string; name: string }[];
  affectedRelationships: { id: string; name: string; description: string }[];
  affectedIndexes: { id: string; name: string; tableName: string }[];
}

/**
 * Calcula en tiempo real qué entidades, relaciones e índices se verán afectados
 * al modificar o eliminar una tabla o columna.
 */
export function calculateImpact(
  project: ProjectIR,
  targetType: 'table' | 'column',
  tableId: string,
  columnId?: string
): ImpactReport {
  const tabla = project.tables.find(t => t.id === tableId);
  const mapaTablasAfectadas = new Map<string, string>();
  const relacionesAfectadas: { id: string; name: string; description: string }[] = [];
  const indicesAfectados: { id: string; name: string; tableName: string }[] = [];

  if (!tabla) {
    return {
      target: targetType,
      affectedTables: [],
      affectedRelationships: [],
      affectedIndexes: [],
    };
  }

  if (targetType === 'table') {
    // Si se borra la tabla, todas las relaciones que la conectan se ven impactadas
    project.relationships.forEach(rel => {
      if (rel.sourceTableId === tableId || rel.targetTableId === tableId) {
        const otroId = rel.sourceTableId === tableId ? rel.targetTableId : rel.sourceTableId;
        const otraTabla = project.tables.find(t => t.id === otroId);
        if (otraTabla) {
          mapaTablasAfectadas.set(otraTabla.id, otraTabla.name);
        }
        relacionesAfectadas.push({
          id: rel.id,
          name: rel.name || 'FK',
          description: `Relación entre "${tabla.name}" y "${otraTabla?.name || 'Desconocida'}"`,
        });
      }
    });
  } else if (targetType === 'column' && columnId) {
    const columna = tabla.columns.find(c => c.id === columnId);
    // Relaciones que usan esta columna como origen o destino
    project.relationships.forEach(rel => {
      if (
        (rel.sourceTableId === tableId && rel.sourceColumnId === columnId) ||
        (rel.targetTableId === tableId && rel.targetColumnId === columnId)
      ) {
        const otroId = rel.sourceTableId === tableId ? rel.targetTableId : rel.sourceTableId;
        const otraTabla = project.tables.find(t => t.id === otroId);
        if (otraTabla) {
          mapaTablasAfectadas.set(otraTabla.id, otraTabla.name);
        }
        relacionesAfectadas.push({
          id: rel.id,
          name: rel.name || 'FK',
          description: `Clave foránea conectada a la columna "${columna?.name || columnId}"`,
        });
      }
    });

    // Índices que incluyen esta columna
    tabla.indexes?.forEach(idx => {
      if (idx.columnIds.includes(columnId)) {
        indicesAfectados.push({
          id: idx.id,
          name: idx.name,
          tableName: tabla.name,
        });
      }
    });
  }

  return {
    target: targetType,
    affectedTables: Array.from(mapaTablasAfectadas.entries()).map(([id, name]) => ({ id, name })),
    affectedRelationships: relacionesAfectadas,
    affectedIndexes: indicesAfectados,
  };
}

