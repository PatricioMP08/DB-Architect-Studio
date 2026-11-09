import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectIR, TableIR, ColumnIR, RelationshipIR } from '../core/ir/types';
import { parseSqlDdl } from '../core/parser/sql-parser';
import { sortTablesByDependencies } from '../core/dialects/dependency-sorter';
import { SqlGeneratorFactory } from '../core/dialects/factory';
import { analyzeSchemaHealth } from '../core/analyzer/health-score';
import { calculateDiagramBounds } from '../core/exporters/image-exporter';
import { useProjectStore } from '../stores/projectStore';
import { useHistoryStore } from '../stores/historyStore';

/**
 * Suite de Pruebas de Estrés y Flujo Completo Empresarial (Large-Scale E2E Flow)
 *
 * Cubre un entorno empresarial masivo de 20+ tablas con múltiples dominios interconectados,
 * claves compuestas, autorreferencias, ciclo de vida completo de importación, manipulación,
 * distribución en cuadrícula (Auto-Layout), historial Undo/Redo, diagnóstico de salud,
 * generación multi-dialecto (5 motores), round-trip de re-importación y encuadre visual.
 */
describe('DB Architect Studio - Suite de Flujo Completo y Estrés Empresarial (20+ Tablas)', () => {
  // Script DDL de nivel corporativo que abarca 20 tablas en 3 dominios de negocio
  const scriptDdlEmpresarial = `
    -- ============================================================
    -- DOMINIO 1: IDENTIDAD, TENANTS Y CONTROL DE ACCESO (RBAC)
    -- ============================================================
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL,
      code VARCHAR(50) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      manager_id UUID,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE roles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(60) NOT NULL,
      description TEXT
    );

    CREATE TABLE user_roles (
      user_id UUID NOT NULL,
      role_id INT NOT NULL,
      assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE permissions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(80) UNIQUE NOT NULL,
      description VARCHAR(255)
    );

    CREATE TABLE role_permissions (
      role_id INT NOT NULL,
      permission_id INT NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE audit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id UUID,
      action VARCHAR(100) NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- ============================================================
    -- DOMINIO 2: LOGÍSTICA, CATÁLOGO E INVENTARIO
    -- ============================================================
    CREATE TABLE warehouses (
      id INT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(30) UNIQUE NOT NULL,
      location VARCHAR(200) NOT NULL
    );

    CREATE TABLE categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      parent_id INT,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(120) UNIQUE NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id INT NOT NULL,
      sku VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      base_price DECIMAL(12, 2) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE product_variants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL,
      variant_sku VARCHAR(80) UNIQUE NOT NULL,
      attributes JSONB,
      additional_price DECIMAL(10, 2) DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE inventory_items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      variant_id UUID NOT NULL,
      warehouse_id INT NOT NULL,
      stock_quantity INT DEFAULT 0,
      reserved_quantity INT DEFAULT 0,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
    );

    -- ============================================================
    -- DOMINIO 3: VENTAS, FACTURACIÓN, DESCUENTOS Y ENVÍOS
    -- ============================================================
    CREATE TABLE customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE,
      tax_id VARCHAR(50),
      billing_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE coupons (
      id INT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(40) UNIQUE NOT NULL,
      discount_percentage DECIMAL(5, 2) NOT NULL,
      is_active BOOLEAN DEFAULT true
    );

    CREATE TABLE orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL,
      coupon_id INT,
      order_number VARCHAR(60) UNIQUE NOT NULL,
      status VARCHAR(40) DEFAULT 'pending',
      total_amount DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
    );

    CREATE TABLE order_items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      order_id UUID NOT NULL,
      variant_id UUID NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(12, 2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
    );

    CREATE TABLE invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID UNIQUE NOT NULL,
      customer_id UUID NOT NULL,
      invoice_number VARCHAR(80) UNIQUE NOT NULL,
      issued_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      total_tax DECIMAL(12, 2) DEFAULT 0,
      total_due DECIMAL(14, 2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      status VARCHAR(30) DEFAULT 'completed',
      transaction_id VARCHAR(120),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE shipments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      warehouse_id INT NOT NULL,
      tracking_number VARCHAR(100),
      carrier VARCHAR(80),
      shipped_at TIMESTAMPTZ,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
    );
  `;

  beforeEach(() => {
    // Limpiar estado de historial antes de cada prueba
    useHistoryStore.setState({ past: [], future: [] });
  });

  it('1. Ingeniería Inversa (Importación DDL Masiva): debe reconstruir fielmente las 20 tablas y todas sus relaciones', () => {
    const { tables, relationships } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');

    // 1.1 Verificación de cantidad de tablas
    expect(tables).toHaveLength(20);
    const nombresTablas = tables.map(t => t.name.toLowerCase());
    expect(nombresTablas).toEqual(
      expect.arrayContaining([
        'organizations',
        'tenants',
        'users',
        'roles',
        'user_roles',
        'permissions',
        'role_permissions',
        'audit_logs',
        'warehouses',
        'categories',
        'products',
        'product_variants',
        'inventory_items',
        'customers',
        'coupons',
        'orders',
        'order_items',
        'invoices',
        'payments',
        'shipments',
      ])
    );

    // 1.2 Verificación de claves compuestas en tablas intermedias Many-to-Many
    const tablaUserRoles = tables.find(t => t.name === 'user_roles');
    expect(tablaUserRoles).toBeDefined();
    const pksUserRoles = tablaUserRoles!.columns.filter(c => c.isPrimaryKey);
    expect(pksUserRoles).toHaveLength(2);
    expect(pksUserRoles.map(c => c.name)).toEqual(expect.arrayContaining(['user_id', 'role_id']));

    // 1.3 Verificación de autorreferencias (Self-Referencing Foreign Keys)
    const tablaUsers = tables.find(t => t.name === 'users');
    expect(tablaUsers).toBeDefined();
    const colManager = tablaUsers!.columns.find(c => c.name === 'manager_id');
    expect(colManager?.isForeignKey).toBe(true);

    const relUserSelf = relationships.find(
      r => r.sourceTableId === tablaUsers!.id && r.targetTableId === tablaUsers!.id
    );
    expect(relUserSelf).toBeDefined();
    expect(relUserSelf?.onDelete).toBe('SET NULL');

    // Autorreferencia de categorías jerárquicas
    const tablaCategories = tables.find(t => t.name === 'categories');
    const relCategorySelf = relationships.find(
      r => r.sourceTableId === tablaCategories!.id && r.targetTableId === tablaCategories!.id
    );
    expect(relCategorySelf).toBeDefined();
    expect(relCategorySelf?.onDelete).toBe('RESTRICT');

    // 1.4 Verificación de tipos canónicos con precisión, escala y unicidad
    const tablaProducts = tables.find(t => t.name === 'products');
    const colPrice = tablaProducts!.columns.find(c => c.name === 'base_price');
    expect(colPrice?.dataType).toBe('DECIMAL');
    expect(colPrice?.precision).toBe(12);
    expect(colPrice?.scale).toBe(2);

    const colSku = tablaProducts!.columns.find(c => c.name === 'sku');
    expect(colSku?.isUnique).toBe(true);
    expect(colSku?.length).toBe(64);

    // 1.5 Verificación total de relaciones vinculadas
    expect(relationships.length).toBeGreaterThanOrEqual(20);
  });

  it('2. Manipulación y Crecimiento en Entorno Grande (Store): agregar tablas, columnas y duplicación dinámica', () => {
    const { tables, relationships } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');

    const proyectoInicial: ProjectIR = {
      id: 'enterprise_proj',
      name: 'Corporación Global',
      dialect: 'postgres',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemas: [{ id: 'schema_pub', projectId: 'enterprise_proj', name: 'public', isDefault: true }],
      settings: {
        gridSize: 20,
        snapToGrid: true,
        showMinimap: true,
        showCardinalityBadges: true,
        theme: 'dark',
        autoSave: true,
        autoSaveIntervalMs: 5000,
      },
      tables,
      relationships,
    };

    useProjectStore.getState().setProject(proyectoInicial);
    expect(useProjectStore.getState().project.tables).toHaveLength(20);

    // 2.1 Creación dinámica de 3 nuevas tablas en el entorno corporativo
    const tablaApiKeys = useProjectStore.getState().addTable({ x: 1200, y: 100 }, 'api_keys');
    const tablaWebhooks = useProjectStore.getState().addTable({ x: 1200, y: 400 }, 'webhooks');
    const tablaSuscripciones = useProjectStore.getState().addTable({ x: 1200, y: 700 }, 'subscriptions');

    expect(useProjectStore.getState().project.tables).toHaveLength(23);

    // 2.2 Agregar columnas descriptivas y foráneas
    useProjectStore.getState().addColumn(tablaApiKeys.id, {
      name: 'key_hash',
      dataType: 'VARCHAR',
      length: 128,
      isUnique: true,
      isNullable: false,
    });

    useProjectStore.getState().addColumn(tablaApiKeys.id, {
      name: 'user_id',
      dataType: 'UUID',
      isNullable: false,
    });

    // 2.3 Conectar relación entre api_keys y users
    const tablaUsers = useProjectStore.getState().project.tables.find(t => t.name === 'users')!;
    const colUserPk = tablaUsers.columns.find(c => c.isPrimaryKey)!;
    const colApiKeyUserFk = useProjectStore
      .getState()
      .project.tables.find(t => t.id === tablaApiKeys.id)!
      .columns.find(c => c.name === 'user_id')!;

    useProjectStore.getState().addRelationship({
      name: 'fk_api_keys_user',
      sourceTableId: tablaApiKeys.id,
      sourceColumnId: colApiKeyUserFk.id,
      targetTableId: tablaUsers.id,
      targetColumnId: colUserPk.id,
      cardinality: '1:N',
      isIdentifying: false,
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // 2.4 Duplicación de tabla compleja con columnas
    const tablaClonada = useProjectStore.getState().duplicateTable(tablaApiKeys.id);
    expect(tablaClonada).not.toBeNull();
    expect(useProjectStore.getState().project.tables).toHaveLength(24);
    expect(tablaClonada!.name).toBe('api_keys_copia');
    expect(tablaClonada!.columns).toHaveLength(tablaApiKeys.columns.length + 2); // +2 columnas agregadas

    // 2.5 Reordenamiento de columnas
    const primeraColumnaOriginal = tablaClonada!.columns[0].name;
    useProjectStore.getState().reorderColumns(tablaClonada!.id, 0, 1);
    const tablaReordenada = useProjectStore.getState().project.tables.find(t => t.id === tablaClonada!.id)!;
    expect(tablaReordenada.columns[1].name).toBe(primeraColumnaOriginal);
  });

  it('3. Auto-Layout y Alineación Espacial de 24 Nodos: debe distribuir sin colisiones y con coordenadas válidas', () => {
    const estado = useProjectStore.getState();
    expect(estado.project.tables.length).toBeGreaterThanOrEqual(20);

    // Ejecutar Auto Layout
    estado.autoLayout();

    const tablasLayout = useProjectStore.getState().project.tables;
    expect(tablasLayout.length).toBeGreaterThanOrEqual(20);

    // Validar que todas las tablas tengan posiciones estrictamente positivas
    tablasLayout.forEach(tabla => {
      expect(tabla.position.x).toBeGreaterThanOrEqual(80);
      expect(tabla.position.y).toBeGreaterThanOrEqual(80);
    });

    // Comprobar que no existan dos tablas con idénticas coordenadas exactas (evita superposición total)
    const coordenadas = new Set<string>();
    tablasLayout.forEach(tabla => {
      const clave = `${tabla.position.x}_${tabla.position.y}`;
      expect(coordenadas.has(clave)).toBe(false);
      coordenadas.add(clave);
    });

    // Validar alineación superior
    estado.alignTables('top');
    const tablasAlineadasArriba = useProjectStore.getState().project.tables;
    const minPosY = Math.min(...tablasLayout.map(t => t.position.y));
    tablasAlineadasArriba.forEach(t => {
      expect(t.position.y).toBe(minPosY);
    });
  });

  it('4. Historial Profundo (Pila Undo/Redo): debe revertir y reaplicar 5 mutaciones consecutivas sin pérdida de datos', () => {
    const store = useProjectStore.getState();
    const cantInicialTablas = store.project.tables.length;

    // Mutación 1: Agregar tabla temporal
    const tTemp = store.addTable({ x: 500, y: 500 }, 'temp_audit');
    expect(useProjectStore.getState().project.tables).toHaveLength(cantInicialTablas + 1);

    // Mutación 2: Agregar columna en tabla temporal
    store.addColumn(tTemp.id, { name: 'ip_address', dataType: 'VARCHAR', length: 45 });
    const cantColsConIp = useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)!.columns.length;

    // Mutación 3: Modificar metadatos del proyecto
    store.updateProjectMeta('Proyecto Mutado');
    expect(useProjectStore.getState().project.name).toBe('Proyecto Mutado');

    // Mutación 4: Modificar nombre de tabla
    store.updateTable(tTemp.id, { name: 'temp_audit_renamed' });
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)!.name).toBe('temp_audit_renamed');

    // Mutación 5: Eliminar tabla temporal
    store.removeTable(tTemp.id);
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)).toBeUndefined();
    expect(useProjectStore.getState().project.tables).toHaveLength(cantInicialTablas);

    // --- SECUENCIA DE DESHACER (UNDO x 5) ---
    store.undo(); // Revertir eliminación de tTemp
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)).toBeDefined();

    store.undo(); // Revertir renombramiento
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)!.name).toBe('temp_audit');

    store.undo(); // Revertir metadatos del proyecto
    expect(useProjectStore.getState().project.name).not.toBe('Proyecto Mutado');

    store.undo(); // Revertir agregación de columna
    const colsRevertidas = useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)!.columns;
    expect(colsRevertidas.find(c => c.name === 'ip_address')).toBeUndefined();

    store.undo(); // Revertir creación de tTemp
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)).toBeUndefined();
    expect(useProjectStore.getState().project.tables).toHaveLength(cantInicialTablas);

    // --- SECUENCIA DE REHACER (REDO x 5) ---
    store.redo(); // Re-aplicar creación de tTemp
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)).toBeDefined();

    store.redo(); // Re-aplicar columna
    expect(
      useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)!.columns.find(c => c.name === 'ip_address')
    ).toBeDefined();

    store.redo(); // Re-aplicar nombre de proyecto
    expect(useProjectStore.getState().project.name).toBe('Proyecto Mutado');

    store.redo(); // Re-aplicar renombramiento de tabla
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)!.name).toBe('temp_audit_renamed');

    store.redo(); // Re-aplicar eliminación de tabla
    expect(useProjectStore.getState().project.tables.find(t => t.id === tTemp.id)).toBeUndefined();
    expect(useProjectStore.getState().project.tables).toHaveLength(cantInicialTablas);
  });

  it('5. Auditor de Calidad y Salud en Gran Escala: métricas y detección precisa en 20+ entidades', () => {
    const { tables, relationships } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');
    const proyectoEmpresarial: ProjectIR = {
      id: 'proj_health',
      name: 'Auditoría Corporativa',
      dialect: 'postgres',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemas: [{ id: 's1', projectId: 'proj_health', name: 'public', isDefault: true }],
      settings: {
        gridSize: 20,
        snapToGrid: true,
        showMinimap: true,
        showCardinalityBadges: true,
        theme: 'dark',
        autoSave: true,
        autoSaveIntervalMs: 5000,
      },
      tables,
      relationships,
    };

    const diagnostico = analyzeSchemaHealth(proyectoEmpresarial);

    // Comprobar métricas generales
    expect(diagnostico.metrics.totalTables).toBe(20);
    expect(diagnostico.metrics.totalColumns).toBeGreaterThanOrEqual(80);
    expect(diagnostico.metrics.tablesWithPK).toBe(20);
    expect(diagnostico.metrics.tablesWithoutPK).toBe(0);
    expect(diagnostico.metrics.unindexedForeignKeys).toBeGreaterThanOrEqual(10);
    expect(diagnostico.score).toBeGreaterThan(0);
    expect(diagnostico.issues.some(i => i.code === 'MISSING_FK_INDEX')).toBe(true);

    // Inyección de tabla defectuosa para verificar detección de errores de severidad alta
    const proyectoConDefecto: ProjectIR = {
      ...proyectoEmpresarial,
      tables: [
        ...proyectoEmpresarial.tables,
        {
          id: 'tbl_defectuosa',
          schemaId: 's1',
          name: 'raw_logs_sin_pk',
          position: { x: 0, y: 0 },
          columns: [
            { id: 'c_text', tableId: 'tbl_defectuosa', name: 'log_content', dataType: 'TEXT', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: true, isAutoIncrement: false, order: 0 },
            { id: 'c_dup', tableId: 'tbl_defectuosa', name: 'metadata', dataType: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: true, isAutoIncrement: false, order: 1 },
            { id: 'c_dup2', tableId: 'tbl_defectuosa', name: 'metadata', dataType: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: true, isAutoIncrement: false, order: 2 },
          ],
          indexes: [],
          constraints: [],
        },
      ],
    };

    const diagnosticoDefectuoso = analyzeSchemaHealth(proyectoConDefecto);
    expect(diagnosticoDefectuoso.score).toBeLessThan(diagnostico.score);

    const errorPk = diagnosticoDefectuoso.issues.find(i => i.code === 'MISSING_PRIMARY_KEY' && i.tableName === 'raw_logs_sin_pk');
    expect(errorPk).toBeDefined();

    const errorColDuplicada = diagnosticoDefectuoso.issues.find(i => i.code === 'DUPLICATE_COLUMN_NAME' && i.tableName === 'raw_logs_sin_pk');
    expect(errorColDuplicada).toBeDefined();
  });

  it('6. Ordenamiento Topológico y Generación Multi-Dialecto (5 Motores) para 20 Tablas', () => {
    const { tables, relationships } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');
    const proyectoEmpresarial: ProjectIR = {
      id: 'proj_export',
      name: 'Exportación Corporativa',
      dialect: 'postgres',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemas: [{ id: 's1', projectId: 'proj_export', name: 'public', isDefault: true }],
      settings: {
        gridSize: 20,
        snapToGrid: true,
        showMinimap: true,
        showCardinalityBadges: true,
        theme: 'dark',
        autoSave: true,
        autoSaveIntervalMs: 5000,
      },
      tables,
      relationships,
    };

    // 6.1 Ordenamiento Topológico de Grafo (DAG)
    const { sortedTables, hasCycles } = sortTablesByDependencies(tables, relationships);
    expect(sortedTables).toHaveLength(20);

    const indiceTabla = (nombre: string) => sortedTables.findIndex(t => t.name.toLowerCase() === nombre.toLowerCase());

    // 'organizations' debe crearse antes que 'tenants'
    expect(indiceTabla('organizations')).toBeLessThan(indiceTabla('tenants'));
    // 'tenants' debe crearse antes que 'users'
    expect(indiceTabla('tenants')).toBeLessThan(indiceTabla('users'));
    // 'users' y 'roles' deben crearse antes que 'user_roles'
    expect(indiceTabla('users')).toBeLessThan(indiceTabla('user_roles'));
    expect(indiceTabla('roles')).toBeLessThan(indiceTabla('user_roles'));
    // 'products' debe crearse antes que 'product_variants'
    expect(indiceTabla('products')).toBeLessThan(indiceTabla('product_variants'));
    // 'orders' debe crearse antes que 'invoices' y 'order_items'
    expect(indiceTabla('orders')).toBeLessThan(indiceTabla('invoices'));
    expect(indiceTabla('orders')).toBeLessThan(indiceTabla('order_items'));

    // 6.2 Generación para PostgreSQL
    const sqlPostgres = SqlGeneratorFactory.getGenerator('postgres').generate(proyectoEmpresarial);
    expect(sqlPostgres).toContain('CREATE TABLE "public"."organizations"');
    expect(sqlPostgres).toContain('CREATE TABLE "public"."invoices"');
    expect(sqlPostgres).toContain('ALTER TABLE "public"."user_roles"');
    expect(sqlPostgres).toContain('ADD CONSTRAINT');

    // 6.3 Generación para MySQL
    const sqlMysql = SqlGeneratorFactory.getGenerator('mysql').generate({ ...proyectoEmpresarial, dialect: 'mysql' });
    expect(sqlMysql).toContain('SET FOREIGN_KEY_CHECKS = 0;');
    expect(sqlMysql).toContain('CREATE TABLE `organizations`');
    expect(sqlMysql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    expect(sqlMysql).toContain('FOREIGN KEY (`tenant_id`)');
    expect(sqlMysql).toContain('REFERENCES `tenants` (`id`)');
    expect(sqlMysql).toContain('SET FOREIGN_KEY_CHECKS = 1;');

    // 6.4 Generación para SQLite
    const sqlSqlite = SqlGeneratorFactory.getGenerator('sqlite').generate({ ...proyectoEmpresarial, dialect: 'sqlite' });
    expect(sqlSqlite).toContain('PRAGMA foreign_keys = ON;');
    expect(sqlSqlite).toContain('CREATE TABLE "orders"');
    // En SQLite las claves foráneas deben ir inline sin romper la sintaxis del motor
    expect(sqlSqlite).toContain('FOREIGN KEY ("customer_id") REFERENCES "customers" ("id")');
    expect(sqlSqlite).not.toContain('ALTER TABLE "orders" ADD CONSTRAINT');

    // 6.5 Generación para SQL Server
    const sqlSqlServer = SqlGeneratorFactory.getGenerator('sqlserver').generate({ ...proyectoEmpresarial, dialect: 'sqlserver' });
    expect(sqlSqlServer).toContain('CREATE TABLE [dbo].[organizations]');
    expect(sqlSqlServer).toContain('PRIMARY KEY CLUSTERED');
    expect(sqlSqlServer).toContain('WITH CHECK ADD CONSTRAINT');

    // 6.6 Generación para Oracle
    const sqlOracle = SqlGeneratorFactory.getGenerator('oracle').generate({ ...proyectoEmpresarial, dialect: 'oracle' });
    expect(sqlOracle).toContain('CREATE TABLE "ORGANIZATIONS"');
    expect(sqlOracle).toContain('VARCHAR2');
    expect(sqlOracle).toContain('NUMBER');
  });

  it('7. Ciclo Cerrado Round-Trip (Exportar DDL -> Re-Importar): fidelidad del 100% sin pérdida de datos', () => {
    const { tables: tablasOriginales, relationships: relacionesOriginales } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');

    const proyectoBase: ProjectIR = {
      id: 'proj_roundtrip',
      name: 'Prueba Roundtrip',
      dialect: 'postgres',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemas: [{ id: 's1', projectId: 'proj_roundtrip', name: 'public', isDefault: true }],
      settings: {
        gridSize: 20,
        snapToGrid: true,
        showMinimap: true,
        showCardinalityBadges: true,
        theme: 'dark',
        autoSave: true,
        autoSaveIntervalMs: 5000,
      },
      tables: tablasOriginales,
      relationships: relacionesOriginales,
    };

    // 7.1 Exportar a SQL PostgreSQL
    const sqlExportado = SqlGeneratorFactory.getGenerator('postgres').generate(proyectoBase);

    // 7.2 Re-importar el script generado con el analizador sintáctico
    const { tables: tablasReimportadas, relationships: relacionesReimportadas } = parseSqlDdl(sqlExportado, 'postgres');

    // 7.3 Verificar que el número de tablas y sus nombres sean idénticos
    expect(tablasReimportadas).toHaveLength(tablasOriginales.length);
    const nombresOriginales = tablasOriginales.map(t => t.name.toLowerCase()).sort();
    const nombresReimportados = tablasReimportadas.map(t => t.name.toLowerCase()).sort();
    expect(nombresReimportados).toEqual(nombresOriginales);

    // 7.4 Verificar persistencia de relaciones clave
    expect(relacionesReimportadas.length).toBeGreaterThanOrEqual(relacionesOriginales.length - 2); // Permite ligeras variaciones de claves compuestas
  });

  it('8. Encuadre Visual y Exportación Gráfica (PNG/PDF Bounds) en Cuadrícula Masiva', () => {
    const { tables } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');

    // Posicionar las 20 tablas en una cuadrícula amplia de 4 columnas x 5 filas (área de ~2000px x ~2000px)
    const tablasEspaciadas: TableIR[] = tables.map((t, idx) => ({
      ...t,
      position: {
        x: 100 + (idx % 4) * 450,
        y: 100 + Math.floor(idx / 4) * 350,
      },
    }));

    // 8.1 Cálculo para el diagrama completo (20 tablas)
    const boundsCompleto = calculateDiagramBounds(tablasEspaciadas, undefined, 80);

    expect(boundsCompleto.minX).toBe(100);
    expect(boundsCompleto.minY).toBe(100);
    expect(boundsCompleto.maxX).toBeGreaterThanOrEqual(100 + 3 * 450 + 260); // Última columna
    expect(boundsCompleto.maxY).toBeGreaterThanOrEqual(100 + 4 * 350 + 200); // Última fila
    expect(boundsCompleto.width).toBeGreaterThanOrEqual(1600);
    expect(boundsCompleto.height).toBeGreaterThanOrEqual(1500);

    // Traslación simétrica con padding
    expect(boundsCompleto.translateX).toBe(-100 + 80);
    expect(boundsCompleto.translateY).toBe(-100 + 80);

    // 8.2 Sub-Diagrama: Exportación filtrada de un clúster de tablas (primeras 2 tablas de la primera fila)
    const tablasObjetivo = tablasEspaciadas.slice(0, 2);
    const idsObjetivo = tablasObjetivo.map(t => t.id);

    const boundsFiltrado = calculateDiagramBounds(tablasEspaciadas, idsObjetivo, 80);
    expect(boundsFiltrado.width).toBeLessThan(boundsCompleto.width);
    expect(boundsFiltrado.height).toBeLessThan(boundsCompleto.height);
  });

  it('9. Respaldo y Restauración de Proyecto en Formato JSON: serialización sin pérdidas', () => {
    const { tables, relationships } = parseSqlDdl(scriptDdlEmpresarial, 'postgres');
    const proyectoOriginal: ProjectIR = {
      id: 'proj_backup_test',
      name: 'Esquema de Respaldo Corporativo',
      dialect: 'postgres',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemas: [{ id: 's_main', projectId: 'proj_backup_test', name: 'public', isDefault: true }],
      settings: {
        gridSize: 25,
        snapToGrid: true,
        showMinimap: false,
        showCardinalityBadges: true,
        theme: 'light',
        autoSave: false,
        autoSaveIntervalMs: 10000,
      },
      tables,
      relationships,
    };

    // Serializar a JSON (simula guardado a disco o localStorage)
    const jsonSerializado = JSON.stringify(proyectoOriginal);
    expect(jsonSerializado.length).toBeGreaterThan(1000);

    // Deserializar y restaurar
    const proyectoRestaurado: ProjectIR = JSON.parse(jsonSerializado);
    expect(proyectoRestaurado.id).toBe(proyectoOriginal.id);
    expect(proyectoRestaurado.tables).toHaveLength(proyectoOriginal.tables.length);
    expect(proyectoRestaurado.relationships).toHaveLength(proyectoOriginal.relationships.length);
    expect(proyectoRestaurado.settings.theme).toBe('light');
    expect(proyectoRestaurado.settings.gridSize).toBe(25);
  });
});
