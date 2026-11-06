import { create } from 'zustand';
import {
  ProjectIR,
  TableIR,
  ColumnIR,
  RelationshipIR,
  IndexIR,
  TableConstraintIR,
  SupportedDialect,
  HealthScoreResult,
} from '../core/ir/types';
import { TEMPLATES } from '../core/templates';
import { parseSqlDdl } from '../core/parser/sql-parser';
import { analyzeSchemaHealth } from '../core/analyzer/health-score';
import { downloadFile } from '../core/exporters/image-exporter';
import { useHistoryStore } from './historyStore';
import { useUiStore } from './uiStore';

/**
 * Estado global del proyecto de diseño de bases de datos.
 * Maneja el modelo canónico (ProjectIR), auditoría de salud del esquema,
 * mutaciones atómicas, historial undo/redo, operaciones de layout y persistencia.
 */
interface ProjectState {
  project: ProjectIR;
  healthResult: HealthScoreResult;
  hasUnsavedChanges: boolean;

  // Acciones de persistencia y estado de cambios sin guardar
  saveProject: () => void;
  saveProjectToDisk: () => void;
  markAsSaved: () => void;
  markAsUnsaved: () => void;

  // Acciones de configuración del Proyecto
  setProject: (project: ProjectIR) => void;
  setDialect: (dialect: SupportedDialect) => void;
  updateProjectMeta: (name: string, description?: string) => void;
  createNewProject: (opciones: {
    name: string;
    description?: string;
    dialect: SupportedDialect;
    startEmpty?: boolean;
  }) => void;

  // Acciones de Tablas
  addTable: (position?: { x: number; y: number }, name?: string) => TableIR;
  updateTable: (tableId: string, updates: Partial<TableIR>) => void;
  removeTable: (tableId: string) => void;
  duplicateTable: (tableId: string) => TableIR | null;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => void;

  // Acciones de Columnas
  addColumn: (tableId: string, column?: Partial<ColumnIR>) => ColumnIR | null;
  updateColumn: (tableId: string, columnId: string, updates: Partial<ColumnIR>) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  reorderColumns: (tableId: string, startIndex: number, endIndex: number) => void;

  // Acciones de Relaciones (Foreign Keys)
  addRelationship: (rel: Omit<RelationshipIR, 'id'>) => RelationshipIR;
  updateRelationship: (relId: string, updates: Partial<RelationshipIR>) => void;
  removeRelationship: (relId: string) => void;

  // Acciones de Índices
  addIndex: (tableId: string, index: Omit<IndexIR, 'id'>) => void;
  removeIndex: (tableId: string, indexId: string) => void;

  // Operaciones Masivas y de Plantillas
  loadTemplate: (templateId: string) => void;
  importSql: (sql: string) => { tableCount: number; relCount: number };
  autoLayout: () => void;
  alignTables: (alignment: 'left' | 'top' | 'distribute-h' | 'distribute-v') => void;

  // Gestión de Historial (Deshacer / Rehacer)
  undo: () => void;
  redo: () => void;
}

// Proyecto inicial cargado por defecto (Plantilla E-Commerce)
const proyectoInicial = TEMPLATES[0].project;

export const useProjectStore = create<ProjectState>((set, get) => {
  // Notifica al proceso de Electron si hay cambios sin guardar
  const sincronizarElectron = (tieneCambios: boolean) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.establecerCambiosSinGuardar) {
      (window as any).electronAPI.establecerCambiosSinGuardar(tieneCambios);
    }
  };

  // Función auxiliar para registrar una captura en la pila de historial antes de cualquier mutación
  const registrarEnHistorial = () => {
    const proyectoActual = get().project;
    useHistoryStore.getState().pushState(proyectoActual);
    set({ hasUnsavedChanges: true });
    useUiStore.getState().setSaveStatus('unsaved');
    sincronizarElectron(true);
  };

  // Función auxiliar para recalcular el informe de salud y buenas prácticas
  const actualizarDiagnosticoSalud = (proyecto: ProjectIR) => {
    return analyzeSchemaHealth(proyecto);
  };

  return {
    project: proyectoInicial,
    healthResult: analyzeSchemaHealth(proyectoInicial),
    hasUnsavedChanges: true,

    // Guarda el proyecto actual en LocalStorage de forma persistente
    saveProject: () => {
      const estado = get();
      try {
        localStorage.setItem('db_architect_current_project', JSON.stringify(estado.project));
        set({ hasUnsavedChanges: false });
        useUiStore.getState().setSaveStatus('saved');
        useUiStore.getState().showToast('¡Proyecto guardado en el navegador!');
        sincronizarElectron(false);
      } catch (error) {
        console.error('Error al guardar el proyecto en almacenamiento local', error);
        useUiStore.getState().showToast('Error al guardar el proyecto');
      }
    },

    // Guarda el proyecto en almacenamiento local y descarga un archivo .json de respaldo en disco
    saveProjectToDisk: () => {
      const estado = get();
      try {
        const contenidoJson = JSON.stringify(estado.project, null, 2);
        const nombreLimpio = estado.project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const nombreArchivo = `${nombreLimpio}_respaldo.dbmodel.json`;
        downloadFile(contenidoJson, nombreArchivo, 'application/json');

        // Persistir también en el almacenamiento local del navegador
        localStorage.setItem('db_architect_current_project', JSON.stringify(estado.project));
        set({ hasUnsavedChanges: false });
        useUiStore.getState().setSaveStatus('saved');
        useUiStore.getState().showToast('¡Copia de respaldo guardada en disco (.json)!');
        sincronizarElectron(false);
      } catch (error) {
        console.error('Error al guardar en disco', error);
        useUiStore.getState().showToast('Error al descargar el archivo de respaldo');
      }
    },

    // Marca manualmente el proyecto como guardado
    markAsSaved: () => {
      set({ hasUnsavedChanges: false });
      useUiStore.getState().setSaveStatus('saved');
      sincronizarElectron(false);
    },

    // Marca manualmente el proyecto como con cambios pendientes
    markAsUnsaved: () => {
      set({ hasUnsavedChanges: true });
      useUiStore.getState().setSaveStatus('unsaved');
      sincronizarElectron(true);
    },

    // Reemplaza el proyecto completo (al cargar proyecto existente)
    setProject: (nuevoProyecto) => {
      set({
        project: nuevoProyecto,
        healthResult: actualizarDiagnosticoSalud(nuevoProyecto),
        hasUnsavedChanges: false,
      });
      useUiStore.getState().setSaveStatus('saved');
      sincronizarElectron(false);
    },

    // Cambia el dialecto SQL activo (PostgreSQL, MySQL o SQLite)
    setDialect: (nuevoDialecto) => {
      registrarEnHistorial();
      set(estado => {
        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          dialect: nuevoDialecto,
          updatedAt: new Date().toISOString(),
        };
        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Actualiza metadatos básicos del proyecto (nombre y descripción)
    updateProjectMeta: (nuevoNombre, nuevaDescripcion) => {
      registrarEnHistorial();
      set(estado => {
        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          name: nuevoNombre,
          description: nuevaDescripcion !== undefined ? nuevaDescripcion : estado.project.description,
          updatedAt: new Date().toISOString(),
        };
        return { project: proyectoActualizado };
      });
    },

    // Crea un proyecto desde cero, permitiendo configurar lienzo en blanco o entidad inicial
    createNewProject: (opciones) => {
      useHistoryStore.getState().clearHistory();

      const ahora = new Date().toISOString();
      const idEsquema = 'schema-1';
      const nombreEsquema =
        opciones.dialect === 'sqlserver' ? 'dbo' : opciones.dialect === 'oracle' ? 'APP_USER' : 'public';

      let tablasIniciales: TableIR[] = [];

      if (!opciones.startEmpty) {
        const idTabla = `tbl_${Date.now()}`;
        const idColId = `col_${Date.now()}_1`;
        const idColNombre = `col_${Date.now()}_2`;
        const idColEmail = `col_${Date.now()}_3`;
        const idColFecha = `col_${Date.now()}_4`;

        tablasIniciales = [
          {
            id: idTabla,
            name: 'usuarios',
            comment: 'Entidad de usuarios del sistema con credenciales y registro de auditoría',
            schemaId: idEsquema,
            color: '#6366F1',
            columns: [
              {
                id: idColId,
                name: 'id',
                dataType: opciones.dialect === 'postgres' ? 'UUID' : 'INT',
                isPrimaryKey: true,
                isAutoIncrement: opciones.dialect !== 'postgres',
                isNullable: false,
                isUnique: true,
                comment: 'Identificador único e inmutable del usuario',
                defaultValue: opciones.dialect === 'postgres' ? 'gen_random_uuid()' : undefined,
              },
              {
                id: idColNombre,
                name: 'nombre_completo',
                dataType: 'VARCHAR',
                length: 150,
                isPrimaryKey: false,
                isAutoIncrement: false,
                isNullable: false,
                isUnique: false,
                comment: 'Nombre de pila y apellidos del usuario registrado',
              },
              {
                id: idColEmail,
                name: 'correo_electronico',
                dataType: 'VARCHAR',
                length: 255,
                isPrimaryKey: false,
                isAutoIncrement: false,
                isNullable: false,
                isUnique: true,
                comment: 'Dirección de correo electrónico única para autenticación',
              },
              {
                id: idColFecha,
                name: 'creado_en',
                dataType: 'TIMESTAMP',
                isPrimaryKey: false,
                isAutoIncrement: false,
                isNullable: false,
                isUnique: false,
                comment: 'Marca temporal del momento de registro',
                defaultValue: 'CURRENT_TIMESTAMP',
              },
            ],
            position: { x: 300, y: 180 },
            indexes: [
              {
                id: `idx_${idTabla}_email`,
                name: 'idx_usuarios_correo',
                columnIds: [idColEmail],
                isUnique: true,
                method: 'BTREE',
              },
            ],
            constraints: [],
          },
        ];
      }

      const nuevoProyecto: ProjectIR = {
        id: `proj_${Date.now()}`,
        name: opciones.name.trim() || 'Nuevo Modelo de Datos',
        description:
          opciones.description?.trim() ||
          'Arquitectura de base de datos relacional creada en DB Architect Studio',
        dialect: opciones.dialect,
        version: '1.0.0',
        schemas: [
          {
            id: idEsquema,
            projectId: `proj_${Date.now()}`,
            name: nombreEsquema,
            isDefault: true,
          },
        ],
        tables: tablasIniciales,
        relationships: [],
        settings: {
          gridSize: 20,
          snapToGrid: true,
          showMinimap: true,
          showCardinalityBadges: true,
          theme: 'dark',
          autoSave: true,
          autoSaveIntervalMs: 5000,
        },
        createdAt: ahora,
        updatedAt: ahora,
      };

      set({
        project: nuevoProyecto,
        healthResult: actualizarDiagnosticoSalud(nuevoProyecto),
        hasUnsavedChanges: true, // Recién iniciado en memoria, no guardado aún por el usuario
      });
      useUiStore.getState().setSaveStatus('unsaved');
      sincronizarElectron(true);

      useUiStore.getState().showToast(`Proyecto "${opciones.name || 'Nuevo Modelo'}" iniciado`);
    },

    // Añade una nueva tabla al esquema con su columna PK por defecto
    addTable: (posicion = { x: 150, y: 150 }, nombreSugerido) => {
      registrarEnHistorial();
      const estado = get();
      const nombresExistentes = new Set(estado.project.tables.map(t => t.name.toLowerCase()));

      let nombreTabla = nombreSugerido || 'nueva_tabla';
      let contadorNombre = 1;
      while (nombresExistentes.has(nombreTabla.toLowerCase())) {
        nombreTabla = `${nombreSugerido || 'nueva_tabla'}_${contadorNombre++}`;
      }

      const idTabla = `tbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const idColumna = `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const nuevaTabla: TableIR = {
        id: idTabla,
        schemaId: estado.project.schemas[0]?.id || 'schema_public',
        name: nombreTabla,
        position: posicion,
        color: '#6366F1',
        columns: [
          {
            id: idColumna,
            tableId: idTabla,
            name: 'id',
            dataType: estado.project.dialect === 'postgres' ? 'UUID' : 'INT',
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
            isNullable: false,
            isAutoIncrement: estado.project.dialect !== 'postgres',
            defaultValue: estado.project.dialect === 'postgres' ? 'gen_random_uuid()' : undefined,
            order: 0,
          },
        ],
        indexes: [],
        constraints: [],
      };

      const proyectoActualizado: ProjectIR = {
        ...estado.project,
        tables: [...estado.project.tables, nuevaTabla],
        updatedAt: new Date().toISOString(),
      };

      set({ project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) });
      return nuevaTabla;
    },

    // Actualiza atributos de una tabla existente
    updateTable: (idTabla, actualizaciones) => {
      registrarEnHistorial();
      set(estado => {
        const tablasActualizadas = estado.project.tables.map(t => (t.id === idTabla ? { ...t, ...actualizaciones } : t));
        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          tables: tablasActualizadas,
          updatedAt: new Date().toISOString(),
        };
        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Elimina una tabla y purga en cascada todas sus relaciones asociadas
    removeTable: (idTabla) => {
      registrarEnHistorial();
      set(estado => {
        const tablasFiltradas = estado.project.tables.filter(t => t.id !== idTabla);
        const relacionesFiltradas = estado.project.relationships.filter(
          r => r.sourceTableId !== idTabla && r.targetTableId !== idTabla
        );

        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          tables: tablasFiltradas,
          relationships: relacionesFiltradas,
          updatedAt: new Date().toISOString(),
        };
        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Duplica una tabla junto con sus columnas
    duplicateTable: (idTabla) => {
      const estado = get();
      const tablaOriginal = estado.project.tables.find(t => t.id === idTabla);
      if (!tablaOriginal) return null;

      registrarEnHistorial();
      const idNuevaTabla = `tbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const columnasDuplicadas: ColumnIR[] = tablaOriginal.columns.map((col, indice) => ({
        ...col,
        id: `col_${Date.now()}_${indice}_${Math.random().toString(36).substring(2, 6)}`,
        tableId: idNuevaTabla,
      }));

      const nuevaTabla: TableIR = {
        ...tablaOriginal,
        id: idNuevaTabla,
        name: `${tablaOriginal.name}_copia`,
        position: { x: tablaOriginal.position.x + 40, y: tablaOriginal.position.y + 40 },
        columns: columnasDuplicadas,
        indexes: [],
        constraints: [],
      };

      const proyectoActualizado: ProjectIR = {
        ...estado.project,
        tables: [...estado.project.tables, nuevaTabla],
        updatedAt: new Date().toISOString(),
      };

      set({ project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) });
      return nuevaTabla;
    },

    // Actualiza la posición 2D de una tabla en el canvas sin saturar el historial durante el arrastre
    updateTablePosition: (idTabla, posicion) => {
      set(estado => {
        const tablasActualizadas = estado.project.tables.map(t =>
          t.id === idTabla ? { ...t, position: posicion } : t
        );
        return {
          project: { ...estado.project, tables: tablasActualizadas },
          hasUnsavedChanges: true,
        };
      });
      useUiStore.getState().setSaveStatus('unsaved');
      sincronizarElectron(true);
    },

    // Añade una columna a la tabla especificada
    addColumn: (idTabla, datosColumna = {}) => {
      const estado = get();
      const tabla = estado.project.tables.find(t => t.id === idTabla);
      if (!tabla) return null;

      registrarEnHistorial();
      const idColumna = `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const orden = tabla.columns.length;

      const nuevaColumna: ColumnIR = {
        id: idColumna,
        tableId: idTabla,
        name: datosColumna.name || `columna_${orden + 1}`,
        dataType: datosColumna.dataType || 'VARCHAR',
        length: datosColumna.dataType === 'VARCHAR' ? 255 : datosColumna.length,
        isPrimaryKey: datosColumna.isPrimaryKey || false,
        isForeignKey: datosColumna.isForeignKey || false,
        isUnique: datosColumna.isUnique || false,
        isNullable: datosColumna.isNullable !== undefined ? datosColumna.isNullable : true,
        isAutoIncrement: datosColumna.isAutoIncrement || false,
        defaultValue: datosColumna.defaultValue,
        comment: datosColumna.comment,
        order: orden,
        ...datosColumna,
      };

      const tablasActualizadas = estado.project.tables.map(t => {
        if (t.id === idTabla) {
          return { ...t, columns: [...t.columns, nuevaColumna] };
        }
        return t;
      });

      const proyectoActualizado: ProjectIR = {
        ...estado.project,
        tables: tablasActualizadas,
        updatedAt: new Date().toISOString(),
      };

      set({ project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) });
      return nuevaColumna;
    },

    // Actualiza la definición técnica de una columna
    updateColumn: (idTabla, idColumna, actualizaciones) => {
      registrarEnHistorial();
      set(estado => {
        const tablasActualizadas = estado.project.tables.map(t => {
          if (t.id === idTabla) {
            const columnas = t.columns.map(c => (c.id === idColumna ? { ...c, ...actualizaciones } : c));
            return { ...t, columns: columnas };
          }
          return t;
        });

        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          tables: tablasActualizadas,
          updatedAt: new Date().toISOString(),
        };

        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Elimina una columna y sus relaciones de foreign key asociadas
    removeColumn: (idTabla, idColumna) => {
      registrarEnHistorial();
      set(estado => {
        const tablasActualizadas = estado.project.tables.map(t => {
          if (t.id === idTabla) {
            return { ...t, columns: t.columns.filter(c => c.id !== idColumna) };
          }
          return t;
        });

        const relacionesActualizadas = estado.project.relationships.filter(
          r => r.sourceColumnId !== idColumna && r.targetColumnId !== idColumna
        );

        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          tables: tablasActualizadas,
          relationships: relacionesActualizadas,
          updatedAt: new Date().toISOString(),
        };

        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Reordena las columnas de una tabla mediante drag & drop
    reorderColumns: (idTabla, indiceInicio, indiceFin) => {
      registrarEnHistorial();
      set(estado => {
        const tablasActualizadas = estado.project.tables.map(t => {
          if (t.id === idTabla) {
            const resultado = Array.from(t.columns);
            const [elementoRemovido] = resultado.splice(indiceInicio, 1);
            resultado.splice(indiceFin, 0, elementoRemovido);
            const columnasReordenadas = resultado.map((c, i) => ({ ...c, order: i }));
            return { ...t, columns: columnasReordenadas };
          }
          return t;
        });

        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          tables: tablasActualizadas,
          updatedAt: new Date().toISOString(),
        };

        return { project: proyectoActualizado };
      });
    },

    // Añade una relación de clave foránea entre dos tablas
    addRelationship: (datosRelacion) => {
      registrarEnHistorial();
      const idRelacion = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const nuevaRelacion: RelationshipIR = {
        ...datosRelacion,
        id: idRelacion,
      };

      const estado = get();

      // Marcar la columna de origen con el indicador isForeignKey
      const tablasActualizadas = estado.project.tables.map(t => {
        if (t.id === datosRelacion.sourceTableId) {
          const columnas = t.columns.map(c =>
            c.id === datosRelacion.sourceColumnId ? { ...c, isForeignKey: true } : c
          );
          return { ...t, columns: columnas };
        }
        return t;
      });

      const proyectoActualizado: ProjectIR = {
        ...estado.project,
        tables: tablasActualizadas,
        relationships: [...estado.project.relationships, nuevaRelacion],
        updatedAt: new Date().toISOString(),
      };

      set({ project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) });
      return nuevaRelacion;
    },

    // Actualiza propiedades de una relación existente (cardinalidad, reglas de borrado o actualización)
    updateRelationship: (idRelacion, actualizaciones) => {
      registrarEnHistorial();
      set(estado => {
        const relacionesActualizadas = estado.project.relationships.map(r =>
          r.id === idRelacion ? { ...r, ...actualizaciones } : r
        );
        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          relationships: relacionesActualizadas,
          updatedAt: new Date().toISOString(),
        };
        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Elimina una relación y actualiza el indicador de foreign key si la columna queda libre
    removeRelationship: (idRelacion) => {
      registrarEnHistorial();
      set(estado => {
        const relacionObjetivo = estado.project.relationships.find(r => r.id === idRelacion);
        const relacionesActualizadas = estado.project.relationships.filter(r => r.id !== idRelacion);

        let tablasActualizadas = estado.project.tables;
        if (relacionObjetivo) {
          const otrasFkUsandoColumna = relacionesActualizadas.some(r => r.sourceColumnId === relacionObjetivo.sourceColumnId);
          if (!otrasFkUsandoColumna) {
            tablasActualizadas = estado.project.tables.map(t => {
              if (t.id === relacionObjetivo.sourceTableId) {
                const columnas = t.columns.map(c =>
                  c.id === relacionObjetivo.sourceColumnId ? { ...c, isForeignKey: false } : c
                );
                return { ...t, columns: columnas };
              }
              return t;
            });
          }
        }

        const proyectoActualizado: ProjectIR = {
          ...estado.project,
          tables: tablasActualizadas,
          relationships: relacionesActualizadas,
          updatedAt: new Date().toISOString(),
        };

        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Añade un índice secundario a una tabla
    addIndex: (idTabla, datosIndice) => {
      registrarEnHistorial();
      set(estado => {
        const idIndice = `idx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const nuevoIndice: IndexIR = { ...datosIndice, id: idIndice, tableId: idTabla };

        const tablasActualizadas = estado.project.tables.map(t => {
          if (t.id === idTabla) {
            return { ...t, indexes: [...(t.indexes || []), nuevoIndice] };
          }
          return t;
        });

        const proyectoActualizado = { ...estado.project, tables: tablasActualizadas };
        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Elimina un índice de una tabla
    removeIndex: (idTabla, idIndice) => {
      registrarEnHistorial();
      set(estado => {
        const tablasActualizadas = estado.project.tables.map(t => {
          if (t.id === idTabla) {
            return { ...t, indexes: (t.indexes || []).filter(idx => idx.id !== idIndice) };
          }
          return t;
        });

        const proyectoActualizado = { ...estado.project, tables: tablasActualizadas };
        return { project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) };
      });
    },

    // Carga un proyecto predefinido desde las plantillas de arquitectura
    loadTemplate: (idPlantilla) => {
      const plantilla = TEMPLATES.find(t => t.id === idPlantilla);
      if (!plantilla) return;

      useHistoryStore.getState().clearHistory();
      const proyectoFresco: ProjectIR = JSON.parse(JSON.stringify(plantilla.project));
      proyectoFresco.id = `proj_${Date.now()}`;
      proyectoFresco.createdAt = new Date().toISOString();
      proyectoFresco.updatedAt = new Date().toISOString();

      set({
        project: proyectoFresco,
        healthResult: actualizarDiagnosticoSalud(proyectoFresco),
        hasUnsavedChanges: true, // Cargado en memoria, pendiente de guardado explícito
      });
      useUiStore.getState().setSaveStatus('unsaved');
      sincronizarElectron(true);

      useUiStore.getState().showToast(`Plantilla "${plantilla.name}" cargada`);
    },

    // Importa y analiza código DDL SQL reconstruyendo tablas y relaciones
    importSql: (codigoSql) => {
      registrarEnHistorial();
      const estado = get();
      const { tables, relationships } = parseSqlDdl(codigoSql, estado.project.dialect);

      if (tables.length === 0) {
        throw new Error('No se detectaron tablas CREATE TABLE válidas en el script SQL.');
      }

      const proyectoActualizado: ProjectIR = {
        ...estado.project,
        tables,
        relationships,
        updatedAt: new Date().toISOString(),
      };

      set({ project: proyectoActualizado, healthResult: actualizarDiagnosticoSalud(proyectoActualizado) });
      return { tableCount: tables.length, relCount: relationships.length };
    },

    // Organiza automáticamente las tablas en una cuadrícula compacta y equilibrada
    autoLayout: () => {
      registrarEnHistorial();
      set(estado => {
        const anchoColumna = 320;
        const altoFila = 300;
        const tablasPorFila = Math.max(2, Math.ceil(Math.sqrt(estado.project.tables.length)));

        const tablasOrganizadas = estado.project.tables.map((tabla, indice) => {
          const columnaMatriz = indice % tablasPorFila;
          const filaMatriz = Math.floor(indice / tablasPorFila);
          return {
            ...tabla,
            position: {
              x: 80 + columnaMatriz * anchoColumna,
              y: 80 + filaMatriz * altoFila,
            },
          };
        });

        const proyectoActualizado = { ...estado.project, tables: tablasOrganizadas };
        return { project: proyectoActualizado };
      });
    },

    // Alinea o distribuye espacialmente las tablas seleccionadas
    alignTables: (tipoAlineacion) => {
      registrarEnHistorial();
      set(estado => {
        if (estado.project.tables.length < 2) return estado;

        let tablas = [...estado.project.tables];

        if (tipoAlineacion === 'left') {
          const minX = Math.min(...tablas.map(t => t.position.x));
          tablas = tablas.map(t => ({ ...t, position: { ...t.position, x: minX } }));
        } else if (tipoAlineacion === 'top') {
          const minY = Math.min(...tablas.map(t => t.position.y));
          tablas = tablas.map(t => ({ ...t, position: { ...t.position, y: minY } }));
        } else if (tipoAlineacion === 'distribute-h') {
          tablas.sort((a, b) => a.position.x - b.position.x);
          const primerX = tablas[0].position.x;
          const ultimoX = tablas[tablas.length - 1].position.x;
          const pasoX = (ultimoX - primerX) / (tablas.length - 1);
          tablas = tablas.map((t, i) => ({ ...t, position: { ...t.position, x: primerX + i * pasoX } }));
        } else if (tipoAlineacion === 'distribute-v') {
          tablas.sort((a, b) => a.position.y - b.position.y);
          const primerY = tablas[0].position.y;
          const ultimoY = tablas[tablas.length - 1].position.y;
          const pasoY = (ultimoY - primerY) / (tablas.length - 1);
          tablas = tablas.map((t, i) => ({ ...t, position: { ...t.position, y: primerY + i * pasoY } }));
        }

        return { project: { ...estado.project, tables } };
      });
    },

    // Deshace el último cambio registrado
    undo: () => {
      const proyectoActual = get().project;
      const proyectoAnterior = useHistoryStore.getState().undo(proyectoActual);
      if (proyectoAnterior) {
        set({ project: proyectoAnterior, healthResult: actualizarDiagnosticoSalud(proyectoAnterior) });
      }
    },

    // Rehace la acción previamente deshecha
    redo: () => {
      const proyectoActual = get().project;
      const proyectoSiguiente = useHistoryStore.getState().redo(proyectoActual);
      if (proyectoSiguiente) {
        set({ project: proyectoSiguiente, healthResult: actualizarDiagnosticoSalud(proyectoSiguiente) });
      }
    },
  };
});
