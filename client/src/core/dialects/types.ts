import { ProjectIR, TableIR, RelationshipIR } from '../ir/types';

/**
 * Opciones de personalización para la generación de código DDL SQL.
 */
export interface SqlGeneratorOptions {
  includeDropTable?: boolean; // Incluir cláusula DROP TABLE IF EXISTS
  includeComments?: boolean; // Incluir comentarios explicativos de columnas y tablas
  includeForeignKeys?: boolean; // Generar sentencias de claves foráneas
  includeIndexes?: boolean; // Generar instrucciones CREATE INDEX
  includeConstraints?: boolean; // Incluir restricciones adicionales
  selectedTableIds?: string[]; // Filtrar subconjunto específico de tablas a exportar
  useQuotes?: boolean; // Aplicar entrecomillado estricto a identificadores
}

/**
 * Contrato de interfaz para los generadores de sentencias DDL SQL por dialecto.
 */
export interface SqlGenerator {
  /**
   * Genera el script DDL completo para el proyecto especificado.
   */
  generate(project: ProjectIR, options?: SqlGeneratorOptions): string;

  /**
   * Genera el script DDL individual de una tabla específica.
   */
  generateTableDdl(table: TableIR, project: ProjectIR, options?: SqlGeneratorOptions): string;

  /**
   * Genera la sentencia de restricción de clave foránea (ALTER TABLE / FOREIGN KEY).
   */
  generateForeignKeyDdl(relationship: RelationshipIR, project: ProjectIR): string;
}
