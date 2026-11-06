import { ProjectIR, TableIR, RelationshipIR, ColumnIR } from '../ir/types';
import { mapCanonicalToDialect } from '../ir/dialects';
import { SqlGenerator, SqlGeneratorOptions } from './types';
import { sortTablesByDependencies } from './dependency-sorter';

/**
 * Generador de código SQL DDL nativo para SQLite 3.
 * Considera que SQLite no permite ALTER TABLE ADD CONSTRAINT FOREIGN KEY,
 * por lo que todas las claves foráneas deben declararse inline dentro de CREATE TABLE,
 * y activa PRAGMA foreign_keys = ON.
 */
export class SqliteGenerator implements SqlGenerator {
  // Escapa un identificador con comillas dobles estándar
  private escaparIdentificador(identificador: string): string {
    return `"${identificador.replace(/"/g, '""')}"`;
  }

  // Formatea la definición de una columna individual en la sintaxis de SQLite
  private formatearColumna(columna: ColumnIR): string {
    const partes: string[] = [];
    partes.push(`  ${this.escaparIdentificador(columna.name)}`);

    // En SQLite, el autoincremento requiere sintaxis exacta: INTEGER PRIMARY KEY AUTOINCREMENT
    if (columna.isPrimaryKey && columna.isAutoIncrement) {
      partes.push('INTEGER PRIMARY KEY AUTOINCREMENT');
    } else {
      partes.push(mapCanonicalToDialect(columna.dataType, 'sqlite', columna.length, columna.precision, columna.scale));

      if (columna.isPrimaryKey) {
        partes.push('PRIMARY KEY');
      }
    }

    if (!columna.isNullable && !columna.isPrimaryKey) {
      partes.push('NOT NULL');
    }

    if (columna.isUnique && !columna.isPrimaryKey) {
      partes.push('UNIQUE');
    }

    if (columna.defaultValue && columna.defaultValue.trim() !== '') {
      partes.push(`DEFAULT ${columna.defaultValue}`);
    }

    if (columna.checkConstraint && columna.checkConstraint.trim() !== '') {
      partes.push(`CHECK (${columna.checkConstraint})`);
    }

    if (columna.comment && columna.comment.trim() !== '') {
      partes.push(`/* ${columna.comment.replace(/\*\//g, '* /')} */`);
    }

    return partes.join(' ');
  }

  // Genera la instrucción DDL CREATE TABLE para SQLite con claves foráneas inline
  generateTableDdl(table: TableIR, project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const nombreTabla = this.escaparIdentificador(table.name);
    const lineas: string[] = [];

    // Banner de documentación descriptivo para auditoría y registro amplio
    const colsPK = table.columns.filter(c => c.isPrimaryKey).map(c => c.name).join(', ') || 'Ninguna';
    lineas.push(`-- ======================================================`);
    lineas.push(`-- Tabla: ${table.name}`);
    lineas.push(`-- Descripción: ${table.comment && table.comment.trim() !== '' ? table.comment : `Entidad relacional de ${table.name}`}`);
    lineas.push(`-- Columnas: ${table.columns.length} | Clave Primaria: [${colsPK}]`);
    lineas.push(`-- ======================================================`);

    if (options.includeDropTable) {
      lineas.push(`DROP TABLE IF EXISTS ${nombreTabla};`);
    }

    lineas.push(`CREATE TABLE ${nombreTabla} (`);

    const columnasClavePrimaria = table.columns.filter(c => c.isPrimaryKey);
    const esClaveCompuesta = columnasClavePrimaria.length > 1;

    const definicionesColumnas = table.columns.map(col => {
      // Si la PK es compuesta, formatear sin flag inline para colocar restricción al final
      if (esClaveCompuesta && col.isPrimaryKey) {
        const copiaColumna = { ...col, isPrimaryKey: false };
        return this.formatearColumna(copiaColumna);
      }
      return this.formatearColumna(col);
    });

    const definiciones: string[] = [...definicionesColumnas];

    // Clave primaria compuesta para SQLite
    if (esClaveCompuesta) {
      const nombresColsPK = columnasClavePrimaria.map(c => this.escaparIdentificador(c.name)).join(', ');
      definiciones.push(`  PRIMARY KEY (${nombresColsPK})`);
    }

    // Restricciones de tabla
    if (options.includeConstraints !== false && table.constraints) {
      table.constraints.forEach(con => {
        definiciones.push(`  CONSTRAINT ${this.escaparIdentificador(con.name)} ${con.type} (${con.expression})`);
      });
    }

    // Regla crítica de SQLite:
    // Al carecer de ALTER TABLE ADD FOREIGN KEY, las claves foráneas deben ir DENTRO del CREATE TABLE.
    if (options.includeForeignKeys !== false) {
      const relacionesDeTabla = project.relationships.filter(r => r.sourceTableId === table.id);

      relacionesDeTabla.forEach(rel => {
        const tablaDestino = project.tables.find(t => t.id === rel.targetTableId);
        const columnaOrigen = table.columns.find(c => c.id === rel.sourceColumnId);
        const columnaDestino = tablaDestino?.columns.find(c => c.id === rel.targetColumnId);

        if (tablaDestino && columnaOrigen && columnaDestino) {
          const nombreClaveForanea = rel.name ? `CONSTRAINT ${this.escaparIdentificador(rel.name)} ` : '';
          definiciones.push(
            `  ${nombreClaveForanea}FOREIGN KEY (${this.escaparIdentificador(columnaOrigen.name)}) REFERENCES ${this.escaparIdentificador(tablaDestino.name)} (${this.escaparIdentificador(columnaDestino.name)}) ON DELETE ${rel.onDelete} ON UPDATE ${rel.onUpdate}`
          );
        }
      });
    }

    lineas.push(definiciones.join(',\n'));
    lineas.push(');');

    // Índices secundarios en SQLite
    if (options.includeIndexes !== false && table.indexes && table.indexes.length > 0) {
      lineas.push('');
      table.indexes.forEach(idx => {
        const cadenaUnica = idx.isUnique ? 'UNIQUE ' : '';
        const columnasIndice = idx.columnIds
          .map(id => {
            const c = table.columns.find(col => col.id === id);
            return c ? this.escaparIdentificador(c.name) : null;
          })
          .filter(Boolean)
          .join(', ');

        if (columnasIndice.length > 0) {
          lineas.push(
            `CREATE ${cadenaUnica}INDEX IF NOT EXISTS ${this.escaparIdentificador(idx.name)} ON ${nombreTabla} (${columnasIndice});`
          );
        }
      });
    }

    return lineas.join('\n');
  }

  // Notificación de compatibilidad de claves foráneas en SQLite
  generateForeignKeyDdl(relationship: RelationshipIR, project: ProjectIR): string {
    const tablaOrigen = project.tables.find(t => t.id === relationship.sourceTableId);
    const tablaDestino = project.tables.find(t => t.id === relationship.targetTableId);
    return `-- [SQLite] Clave Foránea (${tablaOrigen?.name} -> ${tablaDestino?.name}) integrada directamente en instrucción CREATE TABLE.`;
  }

  // Genera el script DDL completo con activación de claves foráneas mediante PRAGMA
  generate(project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const partes: string[] = [];

    partes.push(`-- ======================================================`);
    partes.push(`-- DB Architect Studio - Script SQL DDL de SQLite`);
    partes.push(`-- Proyecto: ${project.name}`);
    if (project.description) {
      partes.push(`-- Descripción: ${project.description}`);
    }
    partes.push(`-- Generado el: ${new Date().toISOString()}`);
    partes.push(`-- Dialecto: SQLite 3`);
    partes.push(`-- ======================================================\n`);

    partes.push(`PRAGMA foreign_keys = ON;\n`);

    // El orden topológico es indispensable en SQLite debido a que las FKs son creadas inline
    const { sortedTables: tablasOrdenadas } = sortTablesByDependencies(
      project.tables,
      project.relationships,
      options.selectedTableIds
    );

    partes.push(`-- Creación de Tablas con Claves Foráneas Integradas`);
    tablasOrdenadas.forEach(tabla => {
      partes.push(this.generateTableDdl(tabla, project, options));
      partes.push('');
    });

    return partes.join('\n');
  }
}

