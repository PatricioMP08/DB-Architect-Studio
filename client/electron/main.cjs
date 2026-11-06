/**
 * Proceso Principal de Electron (Main Process)
 * DB Architect Studio — Plataforma de Escritorio
 *
 * Administra el ciclo de vida de la aplicación, creación de ventanas nativas,
 * menú del sistema operativo en español y comunicación IPC segura con el sistema de archivos.
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Determinar si estamos en modo desarrollo o ejecutando el bundle empaquetado
const esDesarrollo = !app.isPackaged || process.env.NODE_ENV === 'development';

// Mantener referencia global para evitar que el recolector de basura cierre la ventana
let ventanaPrincipal = null;

// Control de cambios sin guardar y cierre forzado
let tieneCambiosSinGuardar = false;
let forzarCierre = false;

// Bloqueo de instancia única para evitar múltiples ventanas duplicadas
const bloqueoInstanciaUnica = app.requestSingleInstanceLock();
if (!bloqueoInstanciaUnica) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ventanaPrincipal) {
      if (ventanaPrincipal.isMinimized()) ventanaPrincipal.restore();
      ventanaPrincipal.focus();
    }
  });
}

/**
 * Crea la ventana principal de la aplicación de escritorio
 */
function crearVentanaPrincipal() {
  ventanaPrincipal = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0B0F19', // Coincide con el tema oscuro de la plataforma
    show: false, // Se muestra solo cuando el contenido está listo para evitar parpadeos
    title: 'DB Architect Studio — Modelado Visual de Bases de Datos',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Construir y configurar el menú de la aplicación nativa en español
  configurarMenuNativo();

  // Cargar URL del servidor Vite en desarrollo o el archivo index.html compilado en producción
  if (esDesarrollo) {
    const urlDesarrollo = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    ventanaPrincipal.loadURL(urlDesarrollo);
    // Abrir herramientas de desarrollador en modo dev si es necesario
    // ventanaPrincipal.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rutaIndexProduccion = path.join(__dirname, '../dist/index.html');
    ventanaPrincipal.loadFile(rutaIndexProduccion);
  }

  // Mostrar la ventana suavemente una vez renderizado el contenido inicial
  ventanaPrincipal.once('ready-to-show', () => {
    ventanaPrincipal.show();
  });

  // Manejar el cierre de la ventana con advertencia si hay cambios sin guardar
  ventanaPrincipal.on('close', (e) => {
    if (forzarCierre) {
      return;
    }

    if (tieneCambiosSinGuardar) {
      e.preventDefault();
      const eleccion = dialog.showMessageBoxSync(ventanaPrincipal, {
        type: 'warning',
        title: 'DB Architect Studio',
        message: '¿Deseas guardar los cambios antes de salir?',
        detail:
          'Tienes modificaciones en tu proyecto de base de datos sin guardar. Si sales ahora, los cambios no guardados se perderán.',
        buttons: ['Guardar y Salir', 'Salir sin Guardar', 'Cancelar'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });

      if (eleccion === 0) {
        // Guardar y Salir: notificar al renderer para persistir y forzar cierre
        ventanaPrincipal.webContents.send('app:guardarYSalir');
      } else if (eleccion === 1) {
        // Salir sin Guardar
        forzarCierre = true;
        ventanaPrincipal.close();
      } else {
        // Cancelar: el usuario decide permanecer en la app
      }
    }
  });

  ventanaPrincipal.on('closed', () => {
    ventanaPrincipal = null;
  });

  // Abrir enlaces externos en el navegador predeterminado del sistema operativo
  ventanaPrincipal.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

/**
 * Configura la barra de menús del sistema operativo completamente en español
 */
function configurarMenuNativo() {
  const plantillaMenu = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo Proyecto',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (ventanaPrincipal) {
              ventanaPrincipal.webContents.send('menu:nuevoProyecto');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Importar Script SQL...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (ventanaPrincipal) {
              ventanaPrincipal.webContents.send('menu:importarSql');
            }
          },
        },
        {
          label: 'Exportar Esquema...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (ventanaPrincipal) {
              ventanaPrincipal.webContents.send('menu:exportar');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            if (ventanaPrincipal) {
              ventanaPrincipal.close();
            } else {
              app.quit();
            }
          },
        },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Pegar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Seleccionar Todo', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Forzar Recarga', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Alternar Herramientas de Desarrollador', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Restablecer Zoom', role: 'resetZoom' },
        { label: 'Acercar Zoom', role: 'zoomIn' },
        { label: 'Alejar Zoom', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Pantalla Completa', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Atajos de Teclado',
          click: () => {
            if (ventanaPrincipal) {
              ventanaPrincipal.webContents.send('menu:mostrarAtajos');
            }
          },
        },
        {
          label: 'Plantillas Preconfiguradas',
          click: () => {
            if (ventanaPrincipal) {
              ventanaPrincipal.webContents.send('menu:mostrarPlantillas');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Acerca de DB Architect Studio',
          click: () => {
            dialog.showMessageBox(ventanaPrincipal, {
              type: 'info',
              title: 'Acerca de DB Architect Studio',
              message: 'DB Architect Studio v1.0.0',
              detail: 'Plataforma profesional de ingeniería, modelado y documentación visual de bases de datos relacionales.\n\nSoporte para PostgreSQL, MySQL y SQLite.',
              buttons: ['Aceptar'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(plantillaMenu);
  Menu.setApplicationMenu(menu);
}

// Controladores IPC para operaciones del sistema operativo
ipcMain.handle('dialogo:guardarArchivo', async (_evento, { nombreSugerido, contenido, filtros }) => {
  const resultado = await dialog.showSaveDialog(ventanaPrincipal, {
    defaultPath: nombreSugerido || 'esquema.sql',
    filters: filtros || [{ name: 'Archivos SQL', extensions: ['sql'] }],
  });

  if (!resultado.canceled && resultado.filePath) {
    await fs.promises.writeFile(resultado.filePath, contenido, 'utf-8');
    return { exito: true, rutaArchivo: resultado.filePath };
  }
  return { exito: false, cancelado: true };
});

ipcMain.handle('dialogo:abrirArchivo', async (_evento, { filtros }) => {
  const resultado = await dialog.showOpenDialog(ventanaPrincipal, {
    properties: ['openFile'],
    filters: filtros || [{ name: 'Scripts SQL', extensions: ['sql', 'txt'] }],
  });

  if (!resultado.canceled && resultado.filePaths.length > 0) {
    const contenido = await fs.promises.readFile(resultado.filePaths[0], 'utf-8');
    return { exito: true, contenido, rutaArchivo: resultado.filePaths[0] };
  }
  return { exito: false, cancelado: true };
});

// Sincronización del estado de cambios sin guardar desde el proceso de renderizado
ipcMain.on('app:establecerCambiosSinGuardar', (_evento, tieneCambios) => {
  tieneCambiosSinGuardar = Boolean(tieneCambios);
});

// Cierre forzado tras guardar cambios en el almacenamiento local
ipcMain.on('ventana:cerrarForzado', () => {
  forzarCierre = true;
  if (ventanaPrincipal) {
    ventanaPrincipal.close();
  }
});

// Controles nativos de ventana
ipcMain.on('ventana:minimizar', () => {
  if (ventanaPrincipal) ventanaPrincipal.minimize();
});

ipcMain.on('ventana:maximizar', () => {
  if (ventanaPrincipal) {
    if (ventanaPrincipal.isMaximized()) {
      ventanaPrincipal.unmaximize();
    } else {
      ventanaPrincipal.maximize();
    }
  }
});

ipcMain.on('ventana:cerrar', () => {
  if (ventanaPrincipal) ventanaPrincipal.close();
});

// Eventos del ciclo de vida de la aplicación
app.whenReady().then(() => {
  crearVentanaPrincipal();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentanaPrincipal();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
