import { CanonicalDataType, SupportedDialect } from './types';

export interface DialectTypeInfo {
  canonical: CanonicalDataType;
  postgres: string;
  mysql: string;
  sqlite: string;
  sqlserver: string;
  oracle: string;
  category: 'numeric' | 'string' | 'datetime' | 'boolean' | 'special';
  supportsLength?: boolean;
  supportsPrecisionScale?: boolean;
}

export const CANONICAL_TYPES: DialectTypeInfo[] = [
  // Numeric
  { canonical: 'INT', postgres: 'INTEGER', mysql: 'INT', sqlite: 'INTEGER', sqlserver: 'INT', oracle: 'NUMBER(10)', category: 'numeric' },
  { canonical: 'BIGINT', postgres: 'BIGINT', mysql: 'BIGINT', sqlite: 'INTEGER', sqlserver: 'BIGINT', oracle: 'NUMBER(19)', category: 'numeric' },
  { canonical: 'SMALLINT', postgres: 'SMALLINT', mysql: 'SMALLINT', sqlite: 'INTEGER', sqlserver: 'SMALLINT', oracle: 'NUMBER(5)', category: 'numeric' },
  { canonical: 'TINYINT', postgres: 'SMALLINT', mysql: 'TINYINT', sqlite: 'INTEGER', sqlserver: 'TINYINT', oracle: 'NUMBER(3)', category: 'numeric' },
  { canonical: 'DECIMAL', postgres: 'DECIMAL', mysql: 'DECIMAL', sqlite: 'NUMERIC', sqlserver: 'DECIMAL', oracle: 'NUMBER', category: 'numeric', supportsPrecisionScale: true },
  { canonical: 'NUMERIC', postgres: 'NUMERIC', mysql: 'NUMERIC', sqlite: 'NUMERIC', sqlserver: 'NUMERIC', oracle: 'NUMBER', category: 'numeric', supportsPrecisionScale: true },
  { canonical: 'FLOAT', postgres: 'REAL', mysql: 'FLOAT', sqlite: 'REAL', sqlserver: 'FLOAT', oracle: 'FLOAT', category: 'numeric' },
  { canonical: 'DOUBLE', postgres: 'DOUBLE PRECISION', mysql: 'DOUBLE', sqlite: 'REAL', sqlserver: 'FLOAT(53)', oracle: 'DOUBLE PRECISION', category: 'numeric' },

  // String
  { canonical: 'VARCHAR', postgres: 'VARCHAR', mysql: 'VARCHAR', sqlite: 'TEXT', sqlserver: 'NVARCHAR', oracle: 'VARCHAR2', category: 'string', supportsLength: true },
  { canonical: 'CHAR', postgres: 'CHAR', mysql: 'CHAR', sqlite: 'TEXT', sqlserver: 'NCHAR', oracle: 'CHAR', category: 'string', supportsLength: true },
  { canonical: 'TEXT', postgres: 'TEXT', mysql: 'TEXT', sqlite: 'TEXT', sqlserver: 'NVARCHAR(MAX)', oracle: 'CLOB', category: 'string' },

  // Boolean
  { canonical: 'BOOLEAN', postgres: 'BOOLEAN', mysql: 'BOOLEAN', sqlite: 'INTEGER', sqlserver: 'BIT', oracle: 'NUMBER(1)', category: 'boolean' },

  // DateTime
  { canonical: 'DATE', postgres: 'DATE', mysql: 'DATE', sqlite: 'TEXT', sqlserver: 'DATE', oracle: 'DATE', category: 'datetime' },
  { canonical: 'TIME', postgres: 'TIME', mysql: 'TIME', sqlite: 'TEXT', sqlserver: 'TIME', oracle: 'TIMESTAMP', category: 'datetime' },
  { canonical: 'DATETIME', postgres: 'TIMESTAMP', mysql: 'DATETIME', sqlite: 'TEXT', sqlserver: 'DATETIME2', oracle: 'TIMESTAMP', category: 'datetime' },
  { canonical: 'TIMESTAMP', postgres: 'TIMESTAMP', mysql: 'TIMESTAMP', sqlite: 'TEXT', sqlserver: 'DATETIME2', oracle: 'TIMESTAMP', category: 'datetime' },
  { canonical: 'TIMESTAMPTZ', postgres: 'TIMESTAMPTZ', mysql: 'TIMESTAMP', sqlite: 'TEXT', sqlserver: 'DATETIMEOFFSET', oracle: 'TIMESTAMP WITH TIME ZONE', category: 'datetime' },

  // Special
  { canonical: 'UUID', postgres: 'UUID', mysql: 'CHAR(36)', sqlite: 'TEXT', sqlserver: 'UNIQUEIDENTIFIER', oracle: 'RAW(16)', category: 'special' },
  { canonical: 'JSON', postgres: 'JSON', mysql: 'JSON', sqlite: 'TEXT', sqlserver: 'NVARCHAR(MAX)', oracle: 'CLOB', category: 'special' },
  { canonical: 'JSONB', postgres: 'JSONB', mysql: 'JSON', sqlite: 'TEXT', sqlserver: 'NVARCHAR(MAX)', oracle: 'BLOB', category: 'special' },
  { canonical: 'BLOB', postgres: 'BYTEA', mysql: 'BLOB', sqlite: 'BLOB', sqlserver: 'VARBINARY(MAX)', oracle: 'BLOB', category: 'special' },
  { canonical: 'BYTEA', postgres: 'BYTEA', mysql: 'LONGBLOB', sqlite: 'BLOB', sqlserver: 'VARBINARY(MAX)', oracle: 'BLOB', category: 'special' },
];

/**
 * Retorna la representación SQL exacta para un tipo canónico según el dialecto
 */
export function mapCanonicalToDialect(
  canonical: CanonicalDataType | string,
  dialect: SupportedDialect,
  length?: number,
  precision?: number,
  scale?: number
): string {
  const match = CANONICAL_TYPES.find(t => t.canonical === canonical);
  if (!match) {
    // Si es un tipo personalizado (e.g. enum personalizado), devolver tal cual
    return String(canonical);
  }

  const baseType = match[dialect];

  if (match.supportsLength && length) {
    if (dialect === 'sqlite' && baseType === 'TEXT') {
      return 'TEXT';
    }
    if (dialect === 'oracle' && baseType === 'VARCHAR2') {
      return `VARCHAR2(${length} CHAR)`;
    }
    return `${baseType}(${length})`;
  }

  if (match.supportsPrecisionScale && precision !== undefined) {
    if (dialect === 'sqlite') {
      return 'NUMERIC';
    }
    if (scale !== undefined) {
      return `${baseType}(${precision}, ${scale})`;
    }
    return `${baseType}(${precision})`;
  }

  return baseType;
}

/**
 * Obtiene la lista de tipos canónicos agrupados por categoría para selectores de UI
 */
export function getTypesByCategory() {
  const categories: Record<string, DialectTypeInfo[]> = {
    numeric: [],
    string: [],
    datetime: [],
    boolean: [],
    special: [],
  };

  CANONICAL_TYPES.forEach(t => {
    categories[t.category].push(t);
  });

  return categories;
}
