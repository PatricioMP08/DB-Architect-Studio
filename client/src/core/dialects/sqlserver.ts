import { ProjectIR, TableIR, ColumnIR, RelationshipIR } from '../ir/types';
import { SqlGenerator, SqlGeneratorOptions } from './types';
import { sortTablesByDependencies } from './dependency-sorter';

/**
 * Generador de DDL para Microsoft SQL Server (T-SQL / Azure SQL).
 * Implementa escape con corchetes [dbo].[tabla], tipos de datos estándar T-SQL (NVARCHAR, BIT, DATETIME2, UNIQUEIDENTIFIER),
 * claves primarias agrupadas (CLUSTERED), propiedades extendidas para comentarios y llaves foráneas con validación CHECK.
 */
export class SqlServerGenerator implements SqlGenerator {
  // Escapa identificadores utilizando corchetes estándar de T-SQL
  private escaparIdentificador(nombre: string): string {
    return `[${nombre.replace(/\]/g, ']]')}]`;
  }

  // Obtiene el nombre calificado con esquema (ej. [dbo].[usuarios])
  private obtenerNombreCompletoTabla(table: TableIR, project: ProjectIR): string {
    let esquema = project.schemas.find(s => s.id === table.schemaId)?.name || 'dbo';
    if (esquema.toLowerCase() === 'public') esquema = 'dbo';
    return `${this.escaparIdentificador(esquema)}.${this.escaparIdentificador(table.name)}`;
  }

  // Mapea y formatea una columna individual a sintaxis T-SQL
  private formatearColumna(columna: ColumnIR): string {
    const partes: string[] = [this.escaparIdentificador(columna.name)];

    let cadenaTipo = columna.dataType.toUpperCase();
    const longitud = columna.length;

    // Normalización de tipos de datos a dialecto Microsoft SQL Server
    switch (cadenaTipo) {
      case 'INT':
      case 'INTEGER':
        cadenaTipo = 'INT';
        break;
      case 'BIGINT':
        cadenaTipo = 'BIGINT';
        break;
      case 'SMALLINT':
        cadenaTipo = 'SMALLINT';
        break;
      case 'TINYINT':
        cadenaTipo = 'TINYINT';
        break;
      case 'VARCHAR':
      case 'CHARACTER VARYING':
        cadenaTipo = longitud && longitud > 0 ? `NVARCHAR(${longitud})` : 'NVARCHAR(255)';
        break;
      case 'CHAR':
        cadenaTipo = longitud && longitud > 0 ? `NCHAR(${longitud})` : 'NCHAR(1)';
        break;
      case 'TEXT':
        cadenaTipo = 'NVARCHAR(MAX)';
        break;
      case 'BOOLEAN':
      case 'BOOL':
        cadenaTipo = 'BIT';
        break;
      case 'UUID':
        cadenaTipo = 'UNIQUEIDENTIFIER';
        break;
      case 'DATE':
        cadenaTipo = 'DATE';
        break;
      case 'TIME':
        cadenaTipo = 'TIME';
        break;
      case 'TIMESTAMP':
      case 'TIMESTAMPTZ':
      case 'DATETIME':
        cadenaTipo = 'DATETIME2';
        break;
      case 'DECIMAL':
      case 'NUMERIC':
        cadenaTipo = `DECIMAL(${columna.precision || 18}, ${columna.scale || 2})`;
        break;
      case 'FLOAT':
      case 'DOUBLE':
      case 'REAL':
        cadenaTipo = 'FLOAT';
        break;
      case 'JSON':
      case 'JSONB':
        cadenaTipo = 'NVARCHAR(MAX)';
        break;
      case 'BLOB':
      case 'BYTEA':
        cadenaTipo = 'VARBINARY(MAX)';
        break;
      default:
        cadenaTipo = longitud && longitud > 0 ? `${cadenaTipo}(${longitud})` : cadenaTipo;
        break;
    }

    partes.push(cadenaTipo);

    // Identidad auto-incremental en SQL Server: IDENTITY(1,1)
    if (columna.isAutoIncrement) {
      partes.push('IDENTITY(1,1)');
    }

    // Restricciones de nulabilidad
    if (!columna.isNullable) {
      partes.push('NOT NULL');
    } else {
      partes.push('NULL');
    }

    // Valores por defecto
    if (columna.defaultValue && columna.defaultValue.trim() !== '') {
      let valorDefecto = columna.defaultValue;
      if (cadenaTipo === 'UNIQUEIDENTIFIER' && (valorDefecto.includes('uuid') || valorDefecto.includes('gen_random_uuid'))) {
        valorDefecto = 'NEWID()';
      } else if (cadenaTipo === 'BIT') {
        valorDefecto = valorDefecto === 'true' || valorDefecto === '1' ? '1' : '0';
      } else if (cadenaTipo === 'DATETIME2' && (valorDefecto.toUpperCase().includes('CURRENT') || valorDefecto.toUpperCase().includes('NOW'))) {
        valorDefecto = 'SYSUTCDATETIME()';
      }
      partes.push(`DEFAULT ${valorDefecto}`);
    }

    // Restricción CHECK
    if (columna.checkConstraint && columna.checkConstraint.trim() !== '') {
      partes.push(`CHECK (${columna.checkConstraint})`);
    }

    return partes.join(' ');
  }

  // Genera la instrucción DDL CREATE TABLE para SQL Server
  generateTableDdl(table: TableIR, project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const nombreCompletoTabla = this.obtenerNombreCompletoTabla(table, project);
    const lineas: string[] = [];
    const esquema = project.schemas.find(s => s.id === table.schemaId)?.name || 'dbo';

    // Comentarios explicativos y encabezado formal de la tabla
    lineas.push(`-- ======================================================`);
    lineas.push(`-- Tabla: ${nombreCompletoTabla}`);
    if (table.comment && table.comment.trim() !== '') {
      lineas.push(`-- Descripción: ${table.comment}`);
    } else {
      lineas.push(`-- Descripción: Entidad relacional del modelo`);
    }
    const colsPK = table.columns.filter(c => c.isPrimaryKey).map(c => c.name);
    lineas.push(`-- Columnas: ${table.columns.length} | Clave Primaria: [${colsPK.join(', ') || 'Ninguna'}]`);
    lineas.push(`-- ======================================================`);

    if (options.includeDropTable) {
      lineas.push(`IF OBJECT_ID(N'${nombreCompletoTabla}', N'U') IS NOT NULL DROP TABLE ${nombreCompletoTabla};`);
    }

    lineas.push(`CREATE TABLE ${nombreCompletoTabla} (`);

    const columnasClavePrimaria = table.columns.filter(c => c.isPrimaryKey);

    // Formatear cada columna con su comentario descriptivo inline si existe
    const definicionesColumnas = table.columns.map(col => {
      let def = `  ${this.formatearColumna(col)}`;
      if (options.includeComments !== false && col.comment && col.comment.trim() !== '') {
        def += ` -- ${col.comment.replace(/\r?\n/g, ' ')}`;
      }
      return def;
    });

    const definiciones: string[] = [...definicionesColumnas];

    // Clave primaria agrupada (CLUSTERED) en SQL Server
    if (columnasClavePrimaria.length > 0) {
      const nombresColsPK = columnasClavePrimaria.map(c => `${this.escaparIdentificador(c.name)} ASC`).join(', ');
      const nombreRestriccionPK = this.escaparIdentificador(`PK_${table.name}`);
      definiciones.push(`  CONSTRAINT ${nombreRestriccionPK} PRIMARY KEY CLUSTERED (${nombresColsPK})`);
    }

    // Restricciones adicionales de tabla (CHECK, UNIQUE, etc.)
    if (options.includeConstraints !== false && table.constraints) {
      table.constraints.forEach(con => {
        definiciones.push(`  CONSTRAINT ${this.escaparIdentificador(con.name)} ${con.type} (${con.expression})`);
      });
    }

    lineas.push(definiciones.join(',\n'));
    lineas.push(');');

    // Registrar propiedades extendidas en el catálogo del sistema para comentarios nativos
    if (options.includeComments !== false) {
      if (table.comment && table.comment.trim() !== '') {
        const comentarioLimpio = table.comment.replace(/'/g, "''");
        lineas.push(
          `EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'${comentarioLimpio}', @level0type=N'SCHEMA', @level0name=N'${esquema}', @level1type=N'TABLE', @level1name=N'${table.name}';`
        );
      }

      table.columns.forEach(col => {
        if (col.comment && col.comment.trim() !== '') {
          const comentarioColLimpio = col.comment.replace(/'/g, "''");
          lineas.push(
            `EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'${comentarioColLimpio}', @level0type=N'SCHEMA', @level0name=N'${esquema}', @level1type=N'TABLE', @level1name=N'${table.name}', @level2type=N'COLUMN', @level2name=N'${col.name}';`
          );
        }
      });
    }

    // Índices secundarios no agrupados (NONCLUSTERED)
    if (options.includeIndexes !== false && table.indexes && table.indexes.length > 0) {
      lineas.push('');
      table.indexes.forEach(idx => {
        const cadenaUnica = idx.isUnique ? 'UNIQUE ' : '';
        const columnasIndice = idx.columnIds
          .map(id => {
            const c = table.columns.find(col => col.id === id);
            return c ? `${this.escaparIdentificador(c.name)} ASC` : null;
          })
          .filter(Boolean)
          .join(', ');

        if (columnasIndice) {
          const nombreIndice = this.escaparIdentificador(idx.name);
          lineas.push(`CREATE ${cadenaUnica}NONCLUSTERED INDEX ${nombreIndice} ON ${nombreCompletoTabla} (${columnasIndice});`);
        }
      });
    }

    return lineas.join('\n');
  }

  // Genera la instrucción ALTER TABLE para añadir una restricción de clave foránea
  generateForeignKeyDdl(relationship: RelationshipIR, project: ProjectIR): string {
    const tablaOrigen = project.tables.find(t => t.id === relationship.sourceTableId);
    const tablaDestino = project.tables.find(t => t.id === relationship.targetTableId);

    if (!tablaOrigen || !tablaDestino) return '';

    const columnaOrigen = tablaOrigen.columns.find(c => c.id === relationship.sourceColumnId);
    const columnaDestino = tablaDestino.columns.find(c => c.id === relationship.targetColumnId);

    if (!columnaOrigen || !columnaDestino) return '';

    const nombreTablaOrigen = this.obtenerNombreCompletoTabla(tablaOrigen, project);
    const nombreTablaDestino = this.obtenerNombreCompletoTabla(tablaDestino, project);
    const nombreClaveForanea = this.escaparIdentificador(
      relationship.name || `FK_${tablaOrigen.name}_${columnaOrigen.name}`
    );

    // En SQL Server RESTRICT se mapea a NO ACTION
    let accionBorrado = relationship.onDelete || 'NO ACTION';
    if (accionBorrado === 'RESTRICT') accionBorrado = 'NO ACTION';

    let accionActualizado = relationship.onUpdate || 'NO ACTION';
    if (accionActualizado === 'RESTRICT') accionActualizado = 'NO ACTION';

    return (
      `ALTER TABLE ${nombreTablaOrigen} WITH CHECK ADD CONSTRAINT ${nombreClaveForanea} ` +
      `FOREIGN KEY(${this.escaparIdentificador(columnaOrigen.name)}) ` +
      `REFERENCES ${nombreTablaDestino} (${this.escaparIdentificador(columnaDestino.name)}) ` +
      `ON DELETE ${accionBorrado} ON UPDATE ${accionActualizado};`
    );
  }

  // Genera el script DDL completo para SQL Server con ordenamiento topológico
  generate(project: ProjectIR, options: SqlGeneratorOptions = {}): string {
    const partes: string[] = [];

    // Encabezado técnico con metadatos del proyecto y fecha de generación
    partes.push(`-- ======================================================`);
    partes.push(`-- DB Architect Studio - Script SQL DDL de Microsoft SQL Server (T-SQL)`);
    partes.push(`-- Proyecto: ${project.name}`);
    if (project.description) {
      partes.push(`-- Descripción: ${project.description}`);
    }
    partes.push(`-- Generado el: ${new Date().toISOString()}`);
    partes.push(`-- Dialecto: Microsoft SQL Server 2019 / 2022 / Azure SQL`);
    partes.push(`-- ======================================================\n`);

    partes.push(`SET ANSI_NULLS ON;\nSET QUOTED_IDENTIFIER ON;\nGO\n`);

    // Creación de esquemas personalizados si existen y difieren de dbo
    const esquemasPersonalizados = project.schemas.filter(s => s.name !== 'dbo' && s.name !== 'public');
    if (esquemasPersonalizados.length > 0) {
      partes.push(`-- Creación de Esquemas`);
      esquemasPersonalizados.forEach(s => {
        partes.push(
          `IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'${s.name}')\nEXEC(N'CREATE SCHEMA ${this.escaparIdentificador(s.name)}');\nGO\n`
        );
      });
    }

    // Ordenamiento topológico de tablas
    const { sortedTables: tablasOrdenadas } = sortTablesByDependencies(
      project.tables,
      project.relationships,
      options.selectedTableIds
    );

    // Creación de Tablas DDL
    partes.push(`-- Creación de Tablas`);
    tablasOrdenadas.forEach(tabla => {
      partes.push(this.generateTableDdl(tabla, project, options));
      partes.push('\nGO\n');
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
            partes.push('GO\n');
          }
        });
      }
    }

    return partes.join('\n');
  }
}
