import { ProjectIR, TableIR, ColumnIR, RelationshipIR, CanonicalDataType, SupportedDialect, IndexIR } from '../ir/types';

/**
 * Normaliza nombres identificadores quitando comillas dobles, comillas simples, backticks o corchetes.
 * Ejemplo: `"usuarios"` o `\`usuarios\`` -> `usuarios`.
 */
function limpiarIdentificador(identificador: string): string {
  return identificador.replace(/^["'`[]+|["'`\]]+$/g, '').trim();
}

/**
 * Mapea tipos de datos SQL brutos a tipos canónicos del modelo intermedio IR.
 * Extrae parámetros de longitud, precisión y escala (ej: VARCHAR(100) -> { type: 'VARCHAR', length: 100 }).
 */
function mapearTipoBrutoACanonico(tipoBruto: string): { type: CanonicalDataType | string; length?: number; precision?: number; scale?: number } {
  const tipoEnMayusculas = tipoBruto.toUpperCase().trim();

  // Expresión regular para separar el tipo base de sus modificadores numéricos: VARCHAR(255) o DECIMAL(10, 2)
  const coincidencia = tipoEnMayusculas.match(/^([A-Z\s]+)(?:\((\d+)(?:\s*,\s*(\d+))?\))?/);
  const tipoBase = coincidencia ? coincidencia[1].trim() : tipoEnMayusculas;
  const paramNumero1 = coincidencia && coincidencia[2] ? parseInt(coincidencia[2], 10) : undefined;
  const paramNumero2 = coincidencia && coincidencia[3] ? parseInt(coincidencia[3], 10) : undefined;

  switch (tipoBase) {
    case 'INT':
    case 'INTEGER':
    case 'INT4':
    case 'MEDIUMINT':
      return { type: 'INT' };
    case 'BIGINT':
    case 'INT8':
      return { type: 'BIGINT' };
    case 'SMALLINT':
    case 'INT2':
      return { type: 'SMALLINT' };
    case 'TINYINT':
      return { type: 'TINYINT' };
    case 'DECIMAL':
    case 'NUMERIC':
      return { type: 'DECIMAL', precision: paramNumero1, scale: paramNumero2 };
    case 'FLOAT':
    case 'REAL':
      return { type: 'FLOAT' };
    case 'DOUBLE':
    case 'DOUBLE PRECISION':
      return { type: 'DOUBLE' };
    case 'VARCHAR':
    case 'CHARACTER VARYING':
    case 'NVARCHAR':
      return { type: 'VARCHAR', length: paramNumero1 || 255 };
    case 'CHAR':
    case 'CHARACTER':
    case 'NCHAR':
      return { type: 'CHAR', length: paramNumero1 || 1 };
    case 'TEXT':
    case 'LONGTEXT':
    case 'MEDIUMTEXT':
    case 'TINYTEXT':
      return { type: 'TEXT' };
    case 'BOOLEAN':
    case 'BOOL':
      return { type: 'BOOLEAN' };
    case 'DATE':
      return { type: 'DATE' };
    case 'TIME':
      return { type: 'TIME' };
    case 'DATETIME':
      return { type: 'DATETIME' };
    case 'TIMESTAMP':
      return { type: 'TIMESTAMP' };
    case 'TIMESTAMPTZ':
      return { type: 'TIMESTAMPTZ' };
    case 'UUID':
      return { type: 'UUID' };
    case 'JSON':
      return { type: 'JSON' };
    case 'JSONB':
      return { type: 'JSONB' };
    case 'BLOB':
    case 'BYTEA':
    case 'LONGBLOB':
      return { type: 'BLOB' };
    default:
      return { type: tipoBase, length: paramNumero1, precision: paramNumero1, scale: paramNumero2 };
  }
}

/**
 * Analizador sintáctico (Parser) de scripts SQL para ingeniería inversa.
 * Extrae tablas, columnas, tipos de datos, restricciones y relaciones relacionales.
 *
 * @param sql Código SQL crudo de entrada
 * @param targetDialect Motor destino (postgres, mysql, sqlite)
 */
export function parseSqlDdl(sql: string, targetDialect: SupportedDialect = 'postgres'): {
  tables: TableIR[];
  relationships: RelationshipIR[];
} {
  const tablas: TableIR[] = [];
  const relaciones: RelationshipIR[] = [];

  // Remover comentarios de bloque /* ... */ y comentarios de una línea -- ...
  const sqlLimpio = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim();

  // Dividir por declaraciones delimitadas por punto y coma ';'
  const instrucciones = sqlLimpio
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Parámetros de cuadrícula para posicionar visualmente los nodos generados
  let indiceColumna = 0;
  let indiceFila = 0;
  const anchoColumna = 340;
  const altoFila = 320;
  const maximoPorFila = 3;

  const mapaTablasPorNombre = new Map<string, TableIR>();

  // Cola de claves foráneas pendientes de enlazar una vez que todas las tablas existan
  const clavesForaneasPendientes: {
    sourceTableId: string;
    sourceTableName: string;
    sourceColName: string;
    targetTableName: string;
    targetColName: string;
    fkName: string;
    onDelete: any;
    onUpdate: any;
  }[] = [];

  // Paso 1: Parsear todas las instrucciones CREATE TABLE
  for (const instruccion of instrucciones) {
    const coincidenciaCreateTable = instruccion.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([`"'\w]+)\.)?([`"'\w]+)\s*\(([\s\S]*)\)(?:\s*ENGINE\s*=\s*\w+)?(?:\s*DEFAULT\s+CHARSET\s*=\s*\w+)?/i);

    if (coincidenciaCreateTable) {
      const esquemaCrudo = coincidenciaCreateTable[1];
      const nombreTablaCrudo = coincidenciaCreateTable[2];
      const cuerpoTabla = coincidenciaCreateTable[3];

      const nombreTabla = limpiarIdentificador(nombreTablaCrudo);
      const nombreEsquema = esquemaCrudo ? limpiarIdentificador(esquemaCrudo) : 'public';
      const idTabla = `table_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const posX = 80 + indiceColumna * anchoColumna;
      const posY = 80 + indiceFila * altoFila;
      indiceColumna++;
      if (indiceColumna >= maximoPorFila) {
        indiceColumna = 0;
        indiceFila++;
      }

      const nuevaTabla: TableIR = {
        id: idTabla,
        schemaId: nombreEsquema === 'public' ? 'default-schema' : `schema_${nombreEsquema}`,
        name: nombreTabla,
        position: { x: posX, y: posY },
        columns: [],
        indexes: [],
        constraints: [],
      };

      // Separar elementos del cuerpo por comas pero ignorando comas internas en paréntesis (ej: DECIMAL(10, 2))
      const elementosCuerpo: string[] = [];
      let fragmentoActual = '';
      let profundidadParentesis = 0;

      for (let i = 0; i < cuerpoTabla.length; i++) {
        const caracter = cuerpoTabla[i];
        if (caracter === '(') profundidadParentesis++;
        else if (caracter === ')') profundidadParentesis--;

        if (caracter === ',' && profundidadParentesis === 0) {
          elementosCuerpo.push(fragmentoActual.trim());
          fragmentoActual = '';
        } else {
          fragmentoActual += caracter;
        }
      }
      if (fragmentoActual.trim().length > 0) {
        elementosCuerpo.push(fragmentoActual.trim());
      }

      // Procesar cada elemento del cuerpo (definición de columna o constraint a nivel de tabla)
      let ordenColumna = 0;
      elementosCuerpo.forEach(elemento => {
        const linea = elemento.trim();
        if (!linea) return;

        // Restricción PRIMARY KEY a nivel de tabla: PRIMARY KEY (col1, col2)
        const coincidenciaPK = linea.match(/(?:CONSTRAINT\s+[`"'\w]+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (coincidenciaPK) {
          const columnasPK = coincidenciaPK[1].split(',').map(c => limpiarIdentificador(c));
          nuevaTabla.columns.forEach(c => {
            if (columnasPK.includes(c.name)) {
              c.isPrimaryKey = true;
            }
          });
          return;
        }

        // Restricción FOREIGN KEY a nivel de tabla: FOREIGN KEY (col) REFERENCES tabla (id)
        const coincidenciaFK = linea.match(
          /(?:CONSTRAINT\s+([`"'\w]+)\s+)?FOREIGN\s+KEY\s*\(([`"'\w]+)\)\s+REFERENCES\s+(?:([`"'\w]+)\.)?([`"'\w]+)\s*\(([`"'\w]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
        );
        if (coincidenciaFK) {
          const nombreFK = coincidenciaFK[1] ? limpiarIdentificador(coincidenciaFK[1]) : '';
          const nombreColOrigen = limpiarIdentificador(coincidenciaFK[2]);
          const nombreTablaDestino = limpiarIdentificador(coincidenciaFK[4]);
          const nombreColDestino = limpiarIdentificador(coincidenciaFK[5]);
          const accionBorrado = (coincidenciaFK[6]?.toUpperCase().replace(/\s+/, ' ') || 'NO ACTION') as any;
          const accionActualizado = (coincidenciaFK[7]?.toUpperCase().replace(/\s+/, ' ') || 'NO ACTION') as any;

          clavesForaneasPendientes.push({
            sourceTableId: idTabla,
            sourceTableName: nombreTabla,
            sourceColName: nombreColOrigen,
            targetTableName: nombreTablaDestino,
            targetColName: nombreColDestino,
            fkName: nombreFK,
            onDelete: accionBorrado,
            onUpdate: accionActualizado,
          });
          return;
        }

        // Restricción UNIQUE a nivel de tabla: UNIQUE (email)
        const coincidenciaUnique = linea.match(/(?:CONSTRAINT\s+[`"'\w]+\s+)?UNIQUE\s*(?:KEY|INDEX)?\s*\(([^)]+)\)/i);
        if (coincidenciaUnique) {
          const columnasUnicas = coincidenciaUnique[1].split(',').map(c => limpiarIdentificador(c));
          nuevaTabla.columns.forEach(c => {
            if (columnasUnicas.includes(c.name)) {
              c.isUnique = true;
            }
          });
          return;
        }

        // Es la definición de una columna individual
        const coincidenciaColumna = linea.match(/^([`"'\w]+)\s+((?:DOUBLE\s+PRECISION|CHARACTER\s+VARYING|[A-Za-z0-9_]+(?:\([^)]*\))?))([\s\S]*)$/i);
        if (coincidenciaColumna) {
          const nombreCol = limpiarIdentificador(coincidenciaColumna[1]);
          const tipoCrudo = coincidenciaColumna[2];
          const restoDefinicion = coincidenciaColumna[3] || '';

          const { type, length, precision, scale } = mapearTipoBrutoACanonico(tipoCrudo);

          const esClavePrimaria = /PRIMARY\s+KEY/i.test(restoDefinicion);
          const esAutoIncremental = /AUTO_INCREMENT|AUTOINCREMENT|SERIAL|BIGSERIAL/i.test(restoDefinicion) || /SERIAL/i.test(tipoCrudo);
          const esNullable = !/NOT\s+NULL/i.test(restoDefinicion) && !esClavePrimaria;
          const esUnica = /UNIQUE/i.test(restoDefinicion);

          const coincidenciaDefault = restoDefinicion.match(/DEFAULT\s+([^,;()\s]+(?:\([^)]*\))?)/i);
          const valorPorDefecto = coincidenciaDefault ? coincidenciaDefault[1].replace(/^'|'$/g, '') : undefined;

          // Claves foráneas declaradas inline: REFERENCES tabla(col)
          const coincidenciaRefInline = restoDefinicion.match(/REFERENCES\s+(?:([`"'\w]+)\.)?([`"'\w]+)\s*\(([`"'\w]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
          if (coincidenciaRefInline) {
            clavesForaneasPendientes.push({
              sourceTableId: idTabla,
              sourceTableName: nombreTabla,
              sourceColName: nombreCol,
              targetTableName: limpiarIdentificador(coincidenciaRefInline[2]),
              targetColName: limpiarIdentificador(coincidenciaRefInline[3]),
              fkName: `fk_${nombreTabla}_${nombreCol}`,
              onDelete: (coincidenciaRefInline[4]?.toUpperCase().replace(/\s+/, ' ') || 'NO ACTION') as any,
              onUpdate: 'NO ACTION',
            });
          }

          const columna: ColumnIR = {
            id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            tableId: idTabla,
            name: nombreCol,
            dataType: type,
            length,
            precision,
            scale,
            isPrimaryKey: esClavePrimaria,
            isForeignKey: false,
            isUnique: esUnica,
            isNullable: esNullable,
            isAutoIncrement: esAutoIncremental,
            defaultValue: valorPorDefecto,
            order: ordenColumna++,
          };

          nuevaTabla.columns.push(columna);
        }
      });

      tablas.push(nuevaTabla);
      mapaTablasPorNombre.set(nombreTabla.toLowerCase(), nuevaTabla);
    }
  }

  // Paso 2: Parsear instrucciones independientes ALTER TABLE ADD CONSTRAINT FOREIGN KEY
  for (const instruccion of instrucciones) {
    const coincidenciaAlterFK = instruccion.match(
      /ALTER\s+TABLE\s+(?:([`"'\w]+)\.)?([`"'\w]+)\s+ADD\s+(?:CONSTRAINT\s+([`"'\w]+)\s+)?FOREIGN\s+KEY\s*\(([`"'\w]+)\)\s+REFERENCES\s+(?:([`"'\w]+)\.)?([`"'\w]+)\s*\(([`"'\w]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
    );

    if (coincidenciaAlterFK) {
      const nombreTablaOrigen = limpiarIdentificador(coincidenciaAlterFK[2]);
      const nombreFK = coincidenciaAlterFK[3] ? limpiarIdentificador(coincidenciaAlterFK[3]) : '';
      const nombreColOrigen = limpiarIdentificador(coincidenciaAlterFK[4]);
      const nombreTablaDestino = limpiarIdentificador(coincidenciaAlterFK[6]);
      const nombreColDestino = limpiarIdentificador(coincidenciaAlterFK[7]);
      const accionBorrado = (coincidenciaAlterFK[8]?.toUpperCase().replace(/\s+/, ' ') || 'NO ACTION') as any;
      const accionActualizado = (coincidenciaAlterFK[9]?.toUpperCase().replace(/\s+/, ' ') || 'NO ACTION') as any;

      const tablaOrigen = mapaTablasPorNombre.get(nombreTablaOrigen.toLowerCase());
      if (tablaOrigen) {
        clavesForaneasPendientes.push({
          sourceTableId: tablaOrigen.id,
          sourceTableName: nombreTablaOrigen,
          sourceColName: nombreColOrigen,
          targetTableName: nombreTablaDestino,
          targetColName: nombreColDestino,
          fkName: nombreFK,
          onDelete: accionBorrado,
          onUpdate: accionActualizado,
        });
      }
    }
  }

  // Paso 3: Resolver y enlazar formalmente las Claves Foráneas dentro del grafo IR
  clavesForaneasPendientes.forEach(pendiente => {
    const tablaOrigen = mapaTablasPorNombre.get(pendiente.sourceTableName.toLowerCase());
    const tablaDestino = mapaTablasPorNombre.get(pendiente.targetTableName.toLowerCase());

    if (tablaOrigen && tablaDestino) {
      const columnaOrigen = tablaOrigen.columns.find(c => c.name.toLowerCase() === pendiente.sourceColName.toLowerCase());
      const columnaDestino = tablaDestino.columns.find(c => c.name.toLowerCase() === pendiente.targetColName.toLowerCase());

      if (columnaOrigen && columnaDestino) {
        columnaOrigen.isForeignKey = true;

        const idRelacion = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        relaciones.push({
          id: idRelacion,
          name: pendiente.fkName || `fk_${tablaOrigen.name}_${columnaOrigen.name}`,
          sourceTableId: tablaOrigen.id,
          sourceColumnId: columnaOrigen.id,
          targetTableId: tablaDestino.id,
          targetColumnId: columnaDestino.id,
          cardinality: columnaOrigen.isUnique ? '1:1' : '1:N',
          isIdentifying: columnaOrigen.isPrimaryKey,
          onDelete: pendiente.onDelete,
          onUpdate: pendiente.onUpdate,
        });
      }
    }
  });

  return {
    tables: tablas,
    relationships: relaciones,
  };
}

