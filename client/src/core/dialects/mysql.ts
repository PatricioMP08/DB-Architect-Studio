import { ProjectIR, TableIR, RelationshipIR, ColumnIR } from '../ir/types';
import { mapCanonicalToDialect } from '../ir/dialects';
import { SqlGenerator, SqlGeneratorOptions } from './types';
import { sortTablesByDependencies } from './dependency-sorter';

/**
 * Generador de código SQL DDL nativo para el motor MySQL 8.0+ y MariaDB 10+.
 * Aplica identificadores entre comillas invertidas (backticks), motor InnoDB y juego de caracteres utf8mb4.
 */
export class MySqlGenerator implements SqlGenerator {
  // Escapa un identificador (tabla, columna o índice) con comillas invertidas (backticks)
  private escaparIdentificador(identificador: string): string {
    return `\`${identificador.replace(/`/g, '``')}\``;
  }

  // Formatea la definición de una columna individual en la sintaxis CREATE TABLE de MySQL
  private formatearColumna(columna: ColumnIR): string {
    const partes: string[] = [];
    partes.push(`  ${this.escaparIdentificador(columna.name)}`);

    const cadenaTipo = mapCanonicalToDialect(columna.dataType, 'mysql', columna.length, columna.precision, columna.scale);
    partes.push(cadenaTipo);

    if (columna.isPrimaryKey) {
      partes.push('PRIMARY KEY');
    }

    if (columna.isAutoIncrement) {
      partes.push('AUTO_INCREMENT');
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
      partes.push(`COMMENT '${columna.comment.replace(/'/g, "''")}'`);
    }

    return partes.join(' ');
  }

  // Genera la instrucción DDL CREATE TABLE para una tabla específica
  generateTableDdl(table: TableIR, _project: ProjectIR, options: SqlGeneratorOptions = {}): string {
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
      if (esClaveCompuesta && col.isPrimaryKey) {
        const copiaColumna = { ...col, isPrimaryKey: false };
        return this.formatearColumna(copiaColumna);
      }
      return this.formatearColumna(col);
    });

    const definiciones: string[] = [...definicionesColumnas];

    // Clave primaria compuesta para MySQL
    if (esClaveCompuesta) {
      const nombresColsPK = columnasClavePrimaria.map(c => this.escaparIdentificador(c.name)).join(', ');
      definiciones.push(`  PRIMARY KEY (${nombresColsPK})`);
    }

    if (options.includeConstraints !== false && table.constraints) {
      table.constraints.forEach(con => {
        definiciones.push(`  CONSTRAINT ${this.escaparIdentificador(con.name)} ${con.type} (${con.expression})`);
      });
    }

    lineas.push(definiciones.join(',\n'));

    // Configuración de motor de almacenamiento InnoDB y codificación UTF-8 multibyte
    let cierreTabla = `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
    if (options.includeComments !== false && table.comment && table.comment.trim() !== '') {
      cierreTabla += ` COMMENT='${table.comment.replace(/'/g, "''")}'`;
    }
    cierreTabla += ';';
    lineas.push(cierreTabla);

    // Índices secundarios
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
            `CREATE ${cadenaUnica}INDEX ${this.escaparIdentificador(idx.name)} ON ${nombreTabla} (${columnasIndice});`
          );
        }
      });
    }

    return lineas.join('\n');
  }

  // Genera la instrucción ALTER TABLE para añadir restricciones de clave foránea en MySQL
  generateForeignKeyDdl(relationship: RelationshipIR, project: ProjectIR): string {
    const tablaOrigen = project.tables.find(t => t.id === relationship.sourceTableId);
    const tablaDestino = project.tables.find(t => t.id === relationship.targetTableId);
    if (!tablaOrigen || !tablaDestino) return '';

    const columnaOrigen = tablaOrigen.columns.find(c => c.id === relationship.sourceColumnId);
    const columnaDestino = tablaDestino.columns.find(c => c.id === relationship.targetColumnId);
    if (!columnaOrigen || !columnaDestino) return '';

    const nombreTablaOrigen = this.escaparIdentificador(tablaOrigen.name);
    const nombreTablaDestino = this.escaparIdentificador(tablaDestino.name);
    const nombreClaveForanea = relationship.name || `fk_${tablaOrigen.name}_${columnaOrigen.name}`;

    return [
      `ALTER TABLE ${nombreTablaOrigen}`,
      `  ADD CONSTRAINT ${this.escaparIdentificador(nombreClaveForanea)}`,
      `  FOREIGN KEY (${this.escaparIdentificador(columnaOrigen.name)})`,
      `  REFERENCES ${nombreTablaDestino} (${this.escaparIdentificador(columnaDestino.name)})`,
      `  ON DELETE ${relationship.onDelete}`,
      `  ON UPDATE ${relationship.onUpdate};`,
    ].join('\n');
  }

  // Genera el script DDL completo para MySQL desactivando temporalmente verificación de FKs
  generate(project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const partes: string[] = [];

    partes.push(`-- ======================================================`);
    partes.push(`-- DB Architect Studio - Script SQL DDL de MySQL`);
    partes.push(`-- Proyecto: ${project.name}`);
    if (project.description) {
      partes.push(`-- Descripción: ${project.description}`);
    }
    partes.push(`-- Generado el: ${new Date().toISOString()}`);
    partes.push(`-- Dialecto: MySQL 8.0+ / MariaDB 10+`);
    partes.push(`-- ======================================================\n`);

    partes.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

    const { sortedTables: tablasOrdenadas } = sortTablesByDependencies(
      project.tables,
      project.relationships,
      options.selectedTableIds
    );

    partes.push(`-- Creación de Tablas`);
    tablasOrdenadas.forEach(tabla => {
      partes.push(this.generateTableDdl(tabla, project, options));
      partes.push('');
    });

    if (options.includeForeignKeys !== false) {
      const idsTablasActivas = new Set(tablasOrdenadas.map(t => t.id));
      const relacionesRelevantes = project.relationships.filter(
        r => idsTablasActivas.has(r.sourceTableId) && idsTablasActivas.has(r.targetTableId)
      );

      if (relacionesRelevantes.length > 0) {
        partes.push(`-- Restricciones de Claves Foráneas (Foreign Keys)`);
        relacionesRelevantes.forEach(relacion => {
          const fkDdl = this.generateForeignKeyDdl(relacion, project);
          if (fkDdl) {
            partes.push(fkDdl);
            partes.push('');
          }
        });
      }
    }

    partes.push(`SET FOREIGN_KEY_CHECKS = 1;`);

    return partes.join('\n');
  }
}

