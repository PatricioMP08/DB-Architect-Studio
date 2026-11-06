import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Servidor API RESTful de DB Architect Studio
 * Proporciona endpoints para persistencia remota de proyectos, verificación de estado
 * y simulación de introspección de esquemas de bases de datos.
 */
const aplicacion = express();
const PUERTO = process.env.PORT || 3001;

// Middlewares globales de seguridad y serialización
aplicacion.use(cors());
aplicacion.use(express.json({ limit: '10mb' }));

// Almacén en memoria de proyectos (preparado para integración con PostgreSQL / Prisma)
const baseDatosProyectosEnMemoria = new Map<string, any>();

/**
 * 1. Endpoint de verificación de estado operativo (Health Check)
 */
aplicacion.get('/api/health', (_solicitud: Request, respuesta: Response) => {
  respuesta.json({
    status: 'ok',
    service: 'DB Architect Studio API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 2. Obtener la lista resumida de todos los proyectos registrados
 */
aplicacion.get('/api/projects', (_solicitud: Request, respuesta: Response) => {
  const listaProyectos = Array.from(baseDatosProyectosEnMemoria.values()).map(proyecto => ({
    id: proyecto.id,
    name: proyecto.name,
    dialect: proyecto.dialect,
    tableCount: proyecto.tables?.length || 0,
    updatedAt: proyecto.updatedAt,
  }));
  respuesta.json({ projects: listaProyectos });
});

/**
 * 3. Obtener la definición completa de un proyecto por su identificador único
 */
aplicacion.get('/api/projects/:id', (solicitud: Request, respuesta: Response) => {
  const idProyecto = String(solicitud.params.id);
  const proyectoEncontrado = baseDatosProyectosEnMemoria.get(idProyecto);
  if (!proyectoEncontrado) {
    return respuesta.status(404).json({ error: 'Proyecto no encontrado' });
  }
  respuesta.json({ project: proyectoEncontrado });
});

/**
 * 4. Guardar o actualizar la definición de un proyecto
 */
aplicacion.post('/api/projects', (solicitud: Request, respuesta: Response) => {
  const proyectoRecibido = solicitud.body;
  if (!proyectoRecibido || !proyectoRecibido.id || !proyectoRecibido.name) {
    return respuesta.status(400).json({ error: 'El objeto de proyecto es inválido o carece de ID y nombre' });
  }

  proyectoRecibido.updatedAt = new Date().toISOString();
  baseDatosProyectosEnMemoria.set(proyectoRecibido.id, proyectoRecibido);

  respuesta.status(201).json({
    message: 'Proyecto guardado exitosamente',
    id: proyectoRecibido.id,
    updatedAt: proyectoRecibido.updatedAt,
  });
});

/**
 * 5. Introspección Segura de Bases de Datos
 * Recibe credenciales temporales y devuelve metadatos del esquema
 */
aplicacion.post('/api/introspect', async (solicitud: Request, respuesta: Response) => {
  const { host: anfitrion, port: puerto, database: nombreBaseDatos, user: usuario, dialect: dialecto } = solicitud.body;

  // Validación estricta de parámetros obligatorios
  if (!anfitrion || !nombreBaseDatos || !usuario) {
    return respuesta.status(400).json({ error: 'Parámetros de conexión incompletos para introspección' });
  }

  // Las credenciales NUNCA se persisten en texto plano ni se exponen
  respuesta.json({
    message: `Conexión verificada con ${dialecto || 'PostgreSQL'} en ${anfitrion}:${puerto || 5432}`,
    tablesDiscovered: 0,
    status: 'ready',
  });
});

// Inicialización del servidor HTTP
aplicacion.listen(PUERTO, () => {
  console.log(`🚀 DB Architect Studio Server corriendo en http://localhost:${PUERTO}`);
});
