import { ProjectIR, TableIR, RelationshipIR, ColumnIR } from '../ir/types';
import { mapCanonicalToDialect } from '../ir/dialects';
import { SqlGenerator, SqlGeneratorOptions } from './types';
import { sortTablesByDependencies } from './dependency-sorter';

/**
 * Generador de código SQL DDL nativo para el motor PostgreSQL (versiones 14, 15 y 16+).
 * Aplica identificadores entre comillas dobles, tipos serial/bigserial y soporte de esquemas.
 */
export class PostgresSqlGenerator implements SqlGenerator {
  // Escapa un identificador (tabla, columna o restricción) con comillas dobles estándar ANSI/PostgreSQL
  private escaparIdentificador(identificador: string): string {
    return `"${identificador.replace(/"/g, '""')}"`;
  }

  // Obtiene el nombre calificado completo de la tabla incluyendo su esquema (ej: "public"."usuarios")
  private obtenerNombreCompletoTabla(tabla: TableIR, proyecto: ProjectIR): string {
    const esquema = proyecto.schemas.find(s => s.id === tabla.schemaId);
    const nombreEsquema = esquema && esquema.name !== 'public' ? esquema.name : 'public';
    return `${this.escaparIdentificador(nombreEsquema)}.${this.escaparIdentificador(tabla.name)}`;
  }

  // Formatea la definición de una columna individual en la sintaxis CREATE TABLE
  private formatearColumna(columna: ColumnIR): string {
    const partes: string[] = [];
    partes.push(`  ${this.escaparIdentificador(columna.name)}`);

    // Manejo de secuencias automáticas AutoIncrement / Serial en Postgres
    if (columna.isAutoIncrement) {
      if (columna.dataType === 'BIGINT') {
        partes.push('BIGSERIAL');
      } else {
        partes.push('SERIAL');
      }
    } else {
      partes.push(mapCanonicalToDialect(columna.dataType, 'postgres', columna.length, columna.precision, columna.scale));
    }

    if (columna.isPrimaryKey) {
      partes.push('PRIMARY KEY');
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

    return partes.join(' ');
  }

  // Genera la instrucción DDL CREATE TABLE para una tabla específica
  generateTableDdl(table: TableIR, project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const nombreTabla = this.obtenerNombreCompletoTabla(table, project);
    const lineas: string[] = [];

    // Banner de documentación descriptivo para auditoría y registro amplio
    const colsPK = table.columns.filter(c => c.isPrimaryKey).map(c => c.name).join(', ') || 'Ninguna';
    lineas.push(`-- ======================================================`);
    lineas.push(`-- Tabla: ${table.name}`);
    lineas.push(`-- Descripción: ${table.comment && table.comment.trim() !== '' ? table.comment : `Entidad relacional de ${table.name}`}`);
    lineas.push(`-- Columnas: ${table.columns.length} | Clave Primaria: [${colsPK}]`);
    lineas.push(`-- ======================================================`);

    if (options.includeDropTable) {
      lineas.push(`DROP TABLE IF EXISTS ${nombreTabla} CASCADE;`);
      lineas.push('');
    }

    lineas.push(`CREATE TABLE ${nombreTabla} (`);

    // Mapear columnas determinando si la clave primaria es compuesta
    const columnasClavePrimaria = table.columns.filter(c => c.isPrimaryKey);
    const esClaveCompuesta = columnasClavePrimaria.length > 1;

    const definicionesColumnas = table.columns.map(col => {
      // Si la PK es compuesta, no colocar 'PRIMARY KEY' inline en cada columna
      if (esClaveCompuesta && col.isPrimaryKey) {
        const copiaColumna = { ...col, isPrimaryKey: false };
        return this.formatearColumna(copiaColumna);
      }
      return this.formatearColumna(col);
    });

    const definiciones: string[] = [...definicionesColumnas];

    // Clave primaria compuesta como restricción de tabla
    if (esClaveCompuesta) {
      const nombresColsPK = columnasClavePrimaria.map(c => this.escaparIdentificador(c.name)).join(', ');
      definiciones.push(`  CONSTRAINT ${this.escaparIdentificador(`pk_${table.name}`)} PRIMARY KEY (${nombresColsPK})`);
    }

    // Restricciones adicionales de tabla (CHECK, UNIQUE multivariable, etc.)
    if (options.includeConstraints !== false && table.constraints) {
      table.constraints.forEach(con => {
        definiciones.push(`  CONSTRAINT ${this.escaparIdentificador(con.name)} ${con.type} (${con.expression})`);
      });
    }

    lineas.push(definiciones.join(',\n'));
    lineas.push(');');

    // Comentarios explicativos en PostgreSQL (COMMENT ON TABLE / COLUMN)
    if (options.includeComments !== false) {
      if (table.comment && table.comment.trim() !== '') {
        lineas.push(`COMMENT ON TABLE ${nombreTabla} IS '${table.comment.replace(/'/g, "''")}';`);
      }

      table.columns.forEach(col => {
        if (col.comment && col.comment.trim() !== '') {
          lineas.push(
            `COMMENT ON COLUMN ${nombreTabla}.${this.escaparIdentificador(col.name)} IS '${col.comment.replace(/'/g, "''")}';`
          );
        }
      });
    }

    // Índices secundarios personalizados
    if (options.includeIndexes !== false && table.indexes && table.indexes.length > 0) {
      lineas.push('');
      table.indexes.forEach(idx => {
        const cadenaUnica = idx.isUnique ? 'UNIQUE ' : '';
        const cadenaMetodo = idx.method ? ` USING ${idx.method}` : '';
        const columnasIndice = idx.columnIds
          .map(id => {
            const c = table.columns.find(col => col.id === id);
            return c ? this.escaparIdentificador(c.name) : null;
          })
          .filter(Boolean)
          .join(', ');

        if (columnasIndice.length > 0) {
          lineas.push(
            `CREATE ${cadenaUnica}INDEX IF NOT EXISTS ${this.escaparIdentificador(idx.name)} ON ${nombreTabla}${cadenaMetodo} (${columnasIndice});`
          );
        }
      });
    }

    return lineas.join('\n');
  }

  // Genera la instrucción ALTER TABLE para añadir restricciones de clave foránea
  generateForeignKeyDdl(relationship: RelationshipIR, project: ProjectIR): string {
    const tablaOrigen = project.tables.find(t => t.id === relationship.sourceTableId);
    const tablaDestino = project.tables.find(t => t.id === relationship.targetTableId);
    if (!tablaOrigen || !tablaDestino) return '';

    const columnaOrigen = tablaOrigen.columns.find(c => c.id === relationship.sourceColumnId);
    const columnaDestino = tablaDestino.columns.find(c => c.id === relationship.targetColumnId);
    if (!columnaOrigen || !columnaDestino) return '';

    const nombreTablaOrigen = this.obtenerNombreCompletoTabla(tablaOrigen, project);
    const nombreTablaDestino = this.obtenerNombreCompletoTabla(tablaDestino, project);
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

  // Genera el script SQL DDL completo respetando el orden topológico de dependencias
  generate(project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const partes: string[] = [];

    // Cabecera informativa del script generado
    partes.push(`-- ======================================================`);
    partes.push(`-- DB Architect Studio - Script SQL DDL de PostgreSQL`);
    partes.push(`-- Proyecto: ${project.name}`);
    if (project.description) {
      partes.push(`-- Descripción: ${project.description}`);
    }
    partes.push(`-- Generado el: ${new Date().toISOString()}`);
    partes.push(`-- Dialecto: PostgreSQL 14+ / 16+`);
    partes.push(`-- ======================================================\n`);

    // Creación de esquemas personalizados si existen
    const esquemasPersonalizados = project.schemas.filter(s => s.name !== 'public');
    if (esquemasPersonalizados.length > 0) {
      partes.push(`-- Creación de Esquemas`);
      esquemasPersonalizados.forEach(s => {
        partes.push(`CREATE SCHEMA IF NOT EXISTS ${this.escaparIdentificador(s.name)};`);
      });
      partes.push('');
    }

    // Ordenamiento topológico de tablas para evitar errores de referencias circulares
    const { sortedTables: tablasOrdenadas } = sortTablesByDependencies(
      project.tables,
      project.relationships,
      options.selectedTableIds
    );

    // Creación de Tablas DDL
    partes.push(`-- Creación de Tablas`);
    tablasOrdenadas.forEach(tabla => {
      partes.push(this.generateTableDdl(tabla, project, options));
      partes.push('');
    });

    // Añadir restricciones de Claves Foráneas (Foreign Keys)
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

    return partes.join('\n');
  }
}

