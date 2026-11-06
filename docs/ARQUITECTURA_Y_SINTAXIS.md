# Arquitectura Técnica y Especificación de Sintaxis

Este documento detalla la arquitectura de software interna, las estructuras de datos, los algoritmos y la sintaxis SQL soportada por el motor de **DB Architect Studio**.

---

## 🏛️ 1. Arquitectura General del Sistema

DB Architect Studio está construido siguiendo principios de **Clean Architecture** y separación estricta de responsabilidades:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE PRESENTACIÓN (UI)                       │
│      React 18 + @xyflow/react + Monaco Editor + Tailwind CSS           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Despacha acciones (CRUD)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CAPA DE ESTADO GLOBAL (ZUSTAND)                      │
│        useProjectStore  │  useHistoryStore  │  useUiStore              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Mantiene y actualiza
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               REPRESENTACIÓN INTERMEDIA CANÓNICA (IR)                  │
│       ProjectIR, TableIR, ColumnIR, RelationshipIR, IndexIR            │
└──────────┬────────────────────────┬────────────────────────┬───────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
│  COMPILADORES DDL   │  │  ANALIZADOR SALUD   │  │  PARSER INVERSO SQL  │
│ Postgres/MySQL/SQLI │  │ Health Score 0-100  │  │   Lexer & Ast IR     │
└─────────────────────┘  └─────────────────────┘  └──────────────────────┘
```

### Ventajas del Desacoplamiento
1. **Independencia del Lienzo:** El motor de base de datos no sabe nada de coordenadas `x, y`, nodos o canvas. Trabaja exclusivamente con el grafo relacional.
2. **Multi-Dialecto Nativo:** La misma estructura lógica en memoria puede compilarse en cualquier momento a PostgreSQL, MySQL o SQLite sin pérdida de datos.
3. **Auditabilidad y Pruebas Unitarias:** Toda la lógica de negocio se ejecuta en funciones puras testeables sin necesidad de levantar el navegador.

---

## 📦 2. Modelo Canónico: Intermediate Representation (IR)

El modelo en memoria se define mediante tipos TypeScript estrictos en [`client/src/core/ir/types.ts`](file:///c:/Users/Lenovo/Desktop/Pruebas%20de%20proyectos/db-architect-studio/client/src/core/ir/types.ts):

### `ProjectIR`
Representa el esquema global de la base de datos:
```typescript
interface ProjectIR {
  id: string;
  name: string;
  description?: string;
  dialect: 'postgres' | 'mysql' | 'sqlite';
  version: string;
  schemas: SchemaIR[];
  tables: TableIR[];
  relationships: RelationshipIR[];
  settings: ProjectSettings;
}
```

### `TableIR`
Representa una entidad o tabla:
```typescript
interface TableIR {
  id: string;
  schemaId: string;
  name: string;
  comment?: string;
  color?: string;
  position: { x: number; y: number };
  columns: ColumnIR[];
  indexes?: IndexIR[];
  constraints?: ConstraintIR[];
  estimatedRows?: number;
}
```

### `ColumnIR`
Representa un atributo o columna:
```typescript
interface ColumnIR {
  id: string;
  tableId: string;
  name: string;
  dataType: CanonicalDataType;
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  isAutoIncrement: boolean;
  defaultValue?: string;
  comment?: string;
  checkConstraint?: string;
  order: number;
}
```

### `RelationshipIR`
Representa una restricción de clave foránea entre dos entidades:
```typescript
interface RelationshipIR {
  id: string;
  name?: string;
  sourceTableId: string;      // Tabla que contiene la Foreign Key (hija)
  sourceColumnId: string;     // Columna origen
  targetTableId: string;      // Tabla referenciada (padre)
  targetColumnId: string;     // Columna referenciada (PK)
  cardinality: '1:1' | '1:N' | 'N:M';
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  isIdentifying: boolean;
}
```

---

## 🗄️ 3. Sistema de Tipos Canónicos y Mapeo por Dialecto

DB Architect Studio utiliza un conjunto de tipos universales que se traducen en tiempo de compilación a los tipos específicos del motor seleccionado:

| Tipo Canónico | Categoría | PostgreSQL 14+ | MySQL 8.0+ | SQLite 3 |
| :--- | :--- | :--- | :--- | :--- |
| `INT` | Numérico | `INTEGER` | `INT` | `INTEGER` |
| `BIGINT` | Numérico | `BIGINT` | `BIGINT` | `INTEGER` |
| `DECIMAL` | Numérico | `NUMERIC(p, s)` | `DECIMAL(p, s)` | `NUMERIC` |
| `FLOAT` | Numérico | `REAL` | `FLOAT` | `REAL` |
| `DOUBLE` | Numérico | `DOUBLE PRECISION` | `DOUBLE` | `REAL` |
| `VARCHAR` | Texto | `VARCHAR(n)` | `VARCHAR(n)` | `TEXT` |
| `CHAR` | Texto | `CHAR(n)` | `CHAR(n)` | `TEXT` |
| `TEXT` | Texto | `TEXT` | `TEXT` | `TEXT` |
| `BOOLEAN` | Lógico | `BOOLEAN` | `TINYINT(1)` | `INTEGER` |
| `DATE` | Fecha/Hora | `DATE` | `DATE` | `TEXT` |
| `TIME` | Fecha/Hora | `TIME` | `TIME` | `TEXT` |
| `TIMESTAMP` | Fecha/Hora | `TIMESTAMP` | `DATETIME` | `TEXT` |
| `TIMESTAMPTZ`| Fecha/Hora | `TIMESTAMPTZ` | `TIMESTAMP` | `TEXT` |
| `UUID` | Identificador | `UUID` | `CHAR(36)` | `TEXT` |
| `JSON` | Semi-estructurado | `JSON` | `JSON` | `TEXT` |
| `JSONB` | Semi-estructurado | `JSONB` | `JSON` | `TEXT` |
| `BLOB` | Binario | `BYTEA` | `LONGBLOB` | `BLOB` |

---

## ⚙️ 4. Compiladores DDL y Sintaxis Generada

### A. PostgreSQL
- **Identificadores delimitados:** Se utiliza comillas dobles (`"nombre"`).
- **Auto-Incremento:** Las columnas enteras marcadas con auto-incremento se compilan como `SERIAL` o `BIGSERIAL`.
- **Comentarios:** Se generan sentencias estándar `COMMENT ON TABLE "public"."tabla" IS '...';` y `COMMENT ON COLUMN ...`.
- **Claves Foráneas:** Se declaran mediante sentencias separadas `ALTER TABLE "tabla" ADD CONSTRAINT "fk_..." FOREIGN KEY (...) REFERENCES ... ON DELETE ... ON UPDATE ...;`.

```sql
-- Ejemplo PostgreSQL generado
CREATE TABLE "public"."orders" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "total_amount" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "fk_orders_user_id"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."users" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
```

---

### B. MySQL
- **Identificadores delimitados:** Se utiliza backticks (`` `nombre` ``).
- **Auto-Incremento:** Se añade la cláusula en línea `AUTO_INCREMENT`.
- **Motor y Conjunto de Caracteres:** Cada tabla incluye `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.
- **Protección de Claves Foráneas:** Se envuelve la creación con `SET FOREIGN_KEY_CHECKS = 0;` y `SET FOREIGN_KEY_CHECKS = 1;` para permitir cargas masivas sin bloqueos de ordenamiento transitorio.

```sql
-- Ejemplo MySQL generado
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `orders` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_user_id`
  FOREIGN KEY (`user_id`)
  REFERENCES `users` (`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
```

---

### C. SQLite
- **Claves Foráneas en Línea:** SQLite no soporta `ALTER TABLE ADD CONSTRAINT FOREIGN KEY`. Todas las claves foráneas **deben ser declaradas obligatoriamente dentro del bloque `CREATE TABLE`**.
- **Auto-Incremento:** Se compila como `INTEGER PRIMARY KEY AUTOINCREMENT`.
- **Habilitación de Integridad:** Se antepone la directiva de motor `PRAGMA foreign_keys = ON;`.

```sql
-- Ejemplo SQLite generado
PRAGMA foreign_keys = ON;

CREATE TABLE "orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" TEXT NOT NULL,
  "total_amount" NUMERIC NOT NULL DEFAULT 0.00,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
```

---

## 🔀 5. Algoritmo de Ordenamiento Topológico (Kahn)

Para garantizar que un script SQL se ejecute sin errores de *"table does not exist"*, las tablas maestras (padres) deben crearse antes que las tablas dependientes (hijos).

El módulo [`dependency-sorter.ts`](file:///c:/Users/Lenovo/Desktop/Pruebas%20de%20proyectos/db-architect-studio/client/src/core/dialects/dependency-sorter.ts) implementa el **Algoritmo de Kahn**:

1. **Construcción del Grafo:** Cada tabla es un nodo. Si `orders` tiene una FK hacia `users`, existe una arista dirigida `users -> orders`.
2. **Cálculo de Grado de Entrada (In-Degree):** Número de dependencias pendientes para cada tabla.
3. **Cola de Procesamiento:** Se encolan los nodos con `in-degree == 0` (tablas maestras sin dependencias).
4. **Reducción de Grados:** Al procesar un nodo, se decrementa el in-degree de sus vecinos y se agregan a la cola cuando llegan a 0.
5. **Detección de Ciclos:** Si el número de nodos ordenados es menor que el total de tablas, se detectan relaciones circulares y se aíslan para que su resolución se efectúe mediante `ALTER TABLE` posterior.

---

## 🩺 6. Motor de Evaluación de Salud (Schema Analyzer)

El motor evalúa el esquema con una puntuación de **0 a 100 puntos**:

$$\text{Puntuación} = \max(0, 100 - \sum \text{Penalizaciones})$$

### Reglas de Deducción:
| Regla | Severidad | Deducción | Descripción |
| :--- | :--- | :--- | :--- |
| `MISSING_PRIMARY_KEY` | `error` | -15 pts | Tabla sin clave primaria definida. |
| `MISSING_FK_INDEX` | `warning` | -5 pts | Clave foránea sin índice secundario explícito. |
| `FK_TYPE_MISMATCH` | `warning` | -8 pts | Tipos de datos incompatibles entre origen y destino. |
| `DUPLICATE_COLUMN_NAME` | `error` | -10 pts | Nombre de columna duplicado en la misma entidad. |
| `TABLE_WITHOUT_COLUMNS` | `error` | -10 pts | Tabla vacía sin atributos. |

### Calificación Cualitativa:
- **90 - 100:** Grado **A+** (Esquema optimizado para producción).
- **80 - 89:** Grado **A** (Esquema saludable con advertencias menores).
- **70 - 79:** Grado **B** (Esquema funcional pero con problemas de indexación).
- **60 - 69:** Grado **C** (Riesgos de integridad referencial).
- **< 60:** Grado **F** (Requiere reestructuración crítica).
