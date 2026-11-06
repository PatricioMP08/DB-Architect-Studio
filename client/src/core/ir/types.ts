/**
 * DB Architect Studio - Intermediate Representation (IR)
 * Modelo Canónico Universal Independiente del Motor Relacional.
 *
 * Define la estructura completa de tablas, columnas, restricciones, índices,
 * relaciones de clave foránea y métricas de diagnóstico de calidad.
 */

/**
 * Motores relacionales soportados por la plataforma
 */
export type SupportedDialect = 'postgres' | 'mysql' | 'sqlite' | 'sqlserver' | 'oracle';

/**
 * Tipos de datos canónicos unificados
 */
export type CanonicalDataType =
  // Enteros
  | 'INT'
  | 'BIGINT'
  | 'SMALLINT'
  | 'TINYINT'
  // Decimales y Punto flotante
  | 'DECIMAL'
  | 'NUMERIC'
  | 'REAL'
  | 'DOUBLE'
  | 'FLOAT'
  // Textuales
  | 'VARCHAR'
  | 'CHAR'
  | 'TEXT'
  // Lógicos
  | 'BOOLEAN'
  // Fechas y Horas
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  // Especiales / Objetos
  | 'UUID'
  | 'JSON'
  | 'JSONB'
  | 'BLOB'
  | 'BYTEA';

/**
 * Representación canónica de una columna de base de datos
 */
export interface ColumnIR {
  id: string;
  tableId: string;
  name: string;
  dataType: CanonicalDataType | string;
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  isAutoIncrement: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  comment?: string;
  order: number;
}

/**
 * Representación canónica de una tabla de base de datos
 */
export interface TableIR {
  id: string;
  schemaId: string;
  name: string;
  physicalName?: string;
  comment?: string;
  position: { x: number; y: number };
  color?: string; // Etiqueta de color HEX para organización visual
  isCollapsed?: boolean;
  estimatedRows?: number;
  columns: ColumnIR[];
  indexes: IndexIR[];
  constraints: TableConstraintIR[];
}

/**
 * Cardinalidad de relación entre tablas
 */
export type Cardinality = '1:1' | '1:N' | 'N:M';

/**
 * Acciones referenciales para eventos ON DELETE y ON UPDATE
 */
export type ReferentialAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

/**
 * Representación canónica de una relación de clave foránea entre dos tablas
 */
export interface RelationshipIR {
  id: string;
  name: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  cardinality: Cardinality;
  isIdentifying: boolean;
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
  junctionTableId?: string; // Para relaciones muchos a muchos (N:M)
}

/**
 * Representación canónica de un índice secundario
 */
export interface IndexIR {
  id: string;
  tableId: string;
  name: string;
  columnIds: string[];
  isUnique: boolean;
  method?: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
  comment?: string;
}

/**
 * Restricciones a nivel de tabla (CHECK, UNIQUE compuesta o EXCLUDE)
 */
export interface TableConstraintIR {
  id: string;
  tableId: string;
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'EXCLUDE';
  expression: string;
}

/**
 * Esquema lógico de base de datos (ej. 'public', 'auth')
 */
export interface SchemaIR {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
}

/**
 * Preferencias de configuración visual del proyecto
 */
export interface ProjectSettings {
  gridSize: number;
  snapToGrid: boolean;
  showMinimap: boolean;
  showCardinalityBadges: boolean;
  theme: 'dark' | 'light';
  autoSave: boolean;
  autoSaveIntervalMs: number;
}

/**
 * Estructura raíz canónica del proyecto de modelado
 */
export interface ProjectIR {
  id: string;
  name: string;
  description?: string;
  dialect: SupportedDialect;
  version: string;
  createdAt: string;
  updatedAt: string;
  schemas: SchemaIR[];
  tables: TableIR[];
  relationships: RelationshipIR[];
  settings: ProjectSettings;
}

/**
 * Severidad de las incidencias del diagnóstico de salud
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Incidencia individual detectada en el esquema relacional
 */
export interface SchemaIssue {
  id: string;
  severity: IssueSeverity;
  code: string;
  message: string;
  suggestion?: string;
  tableId?: string;
  tableName?: string;
  columnId?: string;
  columnName?: string;
  relationshipId?: string;
  autoFixAvailable?: boolean;
}

/**
 * Resultado integral del análisis de salud, métricas y buenas prácticas
 */
export interface HealthScoreResult {
  score: number; // Puntuación de calidad de 0 a 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  issues: SchemaIssue[];
  metrics: {
    totalTables: number;
    totalColumns: number;
    totalRelationships: number;
    tablesWithPK: number;
    tablesWithoutPK: number;
    indexedForeignKeys: number;
    unindexedForeignKeys: number;
  };
}
