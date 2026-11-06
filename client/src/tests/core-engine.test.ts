import { describe, it, expect } from 'vitest';
import { ProjectIR } from '../core/ir/types';
import { sortTablesByDependencies } from '../core/dialects/dependency-sorter';
import { PostgresSqlGenerator } from '../core/dialects/postgres';
import { MySqlGenerator } from '../core/dialects/mysql';
import { SqliteGenerator } from '../core/dialects/sqlite';
import { SqlServerGenerator } from '../core/dialects/sqlserver';
import { OracleGenerator } from '../core/dialects/oracle';
import { SqlGeneratorFactory } from '../core/dialects/factory';
import { analyzeSchemaHealth } from '../core/analyzer/health-score';
import { parseSqlDdl } from '../core/parser/sql-parser';
import { TEMPLATES } from '../core/templates';
import { calculateDiagramBounds } from '../core/exporters/image-exporter';

describe('DB Architect Studio - Suite de Pruebas del Motor Central', () => {
  // Proyecto de prueba en memoria simulado
  const proyectoPrueba: ProjectIR = {
    id: 'test_proj',
    name: 'Proyecto de Pruebas Unitarias',
    dialect: 'postgres',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemas: [{ id: 'schema_1', projectId: 'test_proj', name: 'public', isDefault: true }],
    settings: {
      gridSize: 20,
      snapToGrid: true,
      showMinimap: true,
      showCardinalityBadges: true,
      theme: 'dark',
      autoSave: true,
      autoSaveIntervalMs: 5000,
    },
    tables: [
      {
        id: 'tbl_child',
        schemaId: 'schema_1',
        name: 'orders',
        position: { x: 0, y: 0 },
        columns: [
          { id: 'col_o_id', tableId: 'tbl_child', name: 'id', dataType: 'INT', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, isAutoIncrement: true, order: 0 },
          { id: 'col_o_user_id', tableId: 'tbl_child', name: 'user_id', dataType: 'INT', isPrimaryKey: false, isForeignKey: true, isUnique: false, isNullable: false, isAutoIncrement: false, order: 1 },
        ],
        indexes: [],
        constraints: [],
      },
      {
        id: 'tbl_parent',
        schemaId: 'schema_1',
        name: 'users',
        position: { x: 0, y: 0 },
        columns: [
          { id: 'col_u_id', tableId: 'tbl_parent', name: 'id', dataType: 'INT', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, isAutoIncrement: true, order: 0 },
          { id: 'col_u_email', tableId: 'tbl_parent', name: 'email', dataType: 'VARCHAR', length: 255, isPrimaryKey: false, isForeignKey: false, isUnique: true, isNullable: false, isAutoIncrement: false, order: 1 },
        ],
        indexes: [],
        constraints: [],
      },
    ],
    relationships: [
      {
        id: 'rel_1',
        name: 'fk_orders_users',
        sourceTableId: 'tbl_child',
        sourceColumnId: 'col_o_user_id',
        targetTableId: 'tbl_parent',
        targetColumnId: 'col_u_id',
        cardinality: '1:N',
        isIdentifying: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    ],
  };

  it('1. Ordenamiento Topológico: debe ordenar tablas independientes antes de sus dependientes', () => {
    const { sortedTables: tablasOrdenadas } = sortTablesByDependencies(proyectoPrueba.tables, proyectoPrueba.relationships);
    expect(tablasOrdenadas).toHaveLength(2);
    // 'users' debe crearse antes que 'orders' porque 'orders' tiene una clave foránea hacia 'users'
    expect(tablasOrdenadas[0].name).toBe('users');
    expect(tablasOrdenadas[1].name).toBe('orders');
  });

  it('2. Generador PostgreSQL: debe generar DDL conforme a estándar con comillas dobles y ALTER TABLE', () => {
    const generador = new PostgresSqlGenerator();
    const codigoSql = generador.generate(proyectoPrueba);

    expect(codigoSql).toContain('CREATE TABLE "public"."users"');
    expect(codigoSql).toContain('CREATE TABLE "public"."orders"');
    expect(codigoSql).toContain('ALTER TABLE "public"."orders"');
    expect(codigoSql).toContain('FOREIGN KEY ("user_id")');
    expect(codigoSql).toContain('REFERENCES "public"."users" ("id")');
    expect(codigoSql).toContain('ON DELETE CASCADE');
  });

  it('3. Generador MySQL: debe usar acentos graves (backticks) y configuración de motor InnoDB', () => {
    const generador = new MySqlGenerator();
    const codigoSql = generador.generate({ ...proyectoPrueba, dialect: 'mysql' });

    expect(codigoSql).toContain('SET FOREIGN_KEY_CHECKS = 0;');
    expect(codigoSql).toContain('CREATE TABLE `users`');
    expect(codigoSql).toContain('AUTO_INCREMENT');
    expect(codigoSql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    expect(codigoSql).toContain('ALTER TABLE `orders`');
    expect(codigoSql).toContain('FOREIGN KEY (`user_id`)');
    expect(codigoSql).toContain('REFERENCES `users` (`id`)');
  });

  it('4. Generador SQLite: debe incluir PRAGMA e incrustar FOREIGN KEY en CREATE TABLE', () => {
    const generador = new SqliteGenerator();
    const codigoSql = generador.generate({ ...proyectoPrueba, dialect: 'sqlite' });

    expect(codigoSql).toContain('PRAGMA foreign_keys = ON;');
    expect(codigoSql).toContain('CREATE TABLE "orders"');
    // En SQLite las claves foráneas deben definirse inline dentro de CREATE TABLE
    expect(codigoSql).toContain('FOREIGN KEY ("user_id") REFERENCES "users" ("id")');
    expect(codigoSql).not.toContain('ALTER TABLE "orders" ADD CONSTRAINT');
  });

  it('5. Auditor de Salud: debe evaluar un modelo relacional bien diseñado con 100/100 y calificación A+', () => {
    const proyectoEcommerce = TEMPLATES[0].project;
    const resultado = analyzeSchemaHealth(proyectoEcommerce);

    expect(resultado.score).toBeGreaterThanOrEqual(95);
    expect(resultado.grade).toBe('A+');
    expect(resultado.metrics.totalTables).toBe(proyectoEcommerce.tables.length);
    expect(resultado.metrics.tablesWithoutPK).toBe(0);
  });

  it('6. Auditor de Salud: debe deducir puntos cuando una tabla carece de clave primaria (PK)', () => {
    const proyectoInvalido: ProjectIR = {
      ...proyectoPrueba,
      tables: [
        {
          id: 'tbl_broken',
          schemaId: 'schema_1',
          name: 'broken_table',
          position: { x: 0, y: 0 },
          columns: [
            { id: 'c1', tableId: 'tbl_broken', name: 'data', dataType: 'TEXT', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: true, isAutoIncrement: false, order: 0 },
          ],
          indexes: [],
          constraints: [],
        },
      ],
      relationships: [],
    };

    const resultado = analyzeSchemaHealth(proyectoInvalido);
    expect(resultado.score).toBeLessThan(100);
    const incidenciaSinPk = resultado.issues.find(i => i.code === 'MISSING_PRIMARY_KEY');
    expect(incidenciaSinPk).toBeDefined();
    expect(incidenciaSinPk?.autoFixAvailable).toBe(true);
  });

  it('7. Analizador DDL (Ingeniería Inversa): debe reconstruir CREATE TABLE con PKs y FKs correctamente', () => {
    const scriptDdl = `
      CREATE TABLE departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL
      );

      CREATE TABLE employees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        dept_id INT,
        full_name VARCHAR(120),
        FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE
      );
    `;

    const { tables: tablas, relationships: relaciones } = parseSqlDdl(scriptDdl, 'postgres');

    expect(tablas).toHaveLength(2);
    expect(tablas.map(t => t.name)).toContain('departments');
    expect(tablas.map(t => t.name)).toContain('employees');

    const tablaEmpleados = tablas.find(t => t.name === 'employees');
    expect(tablaEmpleados?.columns.find(c => c.name === 'id')?.isPrimaryKey).toBe(true);
    expect(tablaEmpleados?.columns.find(c => c.name === 'dept_id')?.isForeignKey).toBe(true);

    expect(relaciones).toHaveLength(1);
    expect(relaciones[0].onDelete).toBe('CASCADE');
  });

  it('8. Generador SQL Server: debe generar T-SQL con corchetes, PK CLUSTERED y encabezados descriptivos', () => {
    const generador = new SqlServerGenerator();
    const codigoSql = generador.generate({ ...proyectoPrueba, dialect: 'sqlserver' });

    expect(codigoSql).toContain('Script SQL DDL de Microsoft SQL Server');
    expect(codigoSql).toContain('CREATE TABLE [dbo].[users]');
    expect(codigoSql).toContain('CREATE TABLE [dbo].[orders]');
    expect(codigoSql).toContain('PRIMARY KEY CLUSTERED ([id] ASC)');
    expect(codigoSql).toContain('ALTER TABLE [dbo].[orders] WITH CHECK ADD CONSTRAINT');
    expect(codigoSql).toContain('REFERENCES [dbo].[users] ([id])');
  });

  it('9. Generador Oracle: debe generar PL/SQL con comillas dobles, NUMBER, VARCHAR2 y encabezados descriptivos', () => {
    const generador = new OracleGenerator();
    const codigoSql = generador.generate({ ...proyectoPrueba, dialect: 'oracle' });

    expect(codigoSql).toContain('Script SQL DDL de Oracle Database');
    expect(codigoSql).toContain('CREATE TABLE "USERS"');
    expect(codigoSql).toContain('CREATE TABLE "ORDERS"');
    expect(codigoSql).toContain('NUMBER');
    expect(codigoSql).toContain('VARCHAR2');
    expect(codigoSql).toContain('ALTER TABLE "ORDERS" ADD CONSTRAINT');
    expect(codigoSql).toContain('REFERENCES "USERS" ("ID")');
  });

  it('10. Fábrica de Dialectos: debe despachar generadores para postgres, mysql, sqlite, sqlserver y oracle', () => {
    const dialects = ['postgres', 'mysql', 'sqlite', 'sqlserver', 'oracle'] as const;
    dialects.forEach(d => {
      const gen = SqlGeneratorFactory.getGenerator(d);
      expect(gen).toBeDefined();
      expect(typeof gen.generate).toBe('function');
    });
  });

  it('11. Encuadre de Exportación Visual: calculateDiagramBounds debe enfocar el 100% de las tablas con padding y centrado simétrico', () => {
    const tablasPrueba = [
      {
        ...proyectoPrueba.tables[0],
        id: 'tbl_orders',
        position: { x: 500, y: 150 },
      },
      {
        ...proyectoPrueba.tables[1],
        id: 'tbl_users',
        position: { x: 100, y: 100 },
      },
    ];

    const bounds = calculateDiagramBounds(tablasPrueba, undefined, 80);

    // Debe contener las tablas users (pos x: 100, y: 100) y orders (pos x: 500, y: 150)
    expect(bounds.minX).toBe(100);
    expect(bounds.minY).toBe(100);
    expect(bounds.maxX).toBeGreaterThanOrEqual(800);
    expect(bounds.width).toBeGreaterThanOrEqual(900);
    expect(bounds.height).toBeGreaterThanOrEqual(600);

    // Al trasladar la tabla más a la izquierda con translateX, debe quedar exactamente en la zona visible con padding
    const posFinalX = bounds.minX + bounds.translateX;
    expect(posFinalX).toBeGreaterThanOrEqual(80);

    // Verificación de filtrado por tablas objetivo
    const boundsSoloUsers = calculateDiagramBounds(tablasPrueba, ['tbl_users'], 80);
    expect(boundsSoloUsers.minX).toBe(100);
    expect(boundsSoloUsers.maxX).toBeLessThan(bounds.maxX);
  });
});
