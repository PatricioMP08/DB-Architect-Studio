/**
 * Script Preload de Electron para DB Architect Studio
 * Expone de manera segura capacidades nativas al proceso de renderizado
 * mediante contextBridge sin comprometer la seguridad (sin nodeIntegration directo).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Identificador de plataforma
  esEscritorio: true,
  plataforma: process.platform,

  // Diálogos nativos del sistema operativo
  guardarArchivoLocal: (opciones) => ipcRenderer.invoke('dialogo:guardarArchivo', opciones),
  abrirArchivoLocal: (opciones) => ipcRenderer.invoke('dialogo:abrirArchivo', opciones),

  // Control de ventana
  minimizarVentana: () => ipcRenderer.send('ventana:minimizar'),
  maximizarVentana: () => ipcRenderer.send('ventana:maximizar'),
  cerrarVentana: () => ipcRenderer.send('ventana:cerrar'),
  cerrarVentanaForzada: () => ipcRenderer.send('ventana:cerrarForzado'),

  // Sincronización del estado de cambios sin guardar
  establecerCambiosSinGuardar: (tieneCambios) =>
    ipcRenderer.send('app:establecerCambiosSinGuardar', Boolean(tieneCambios)),

  // Suscripciones a eventos enviados desde el proceso principal
  onGuardarYSalir: (callback) => {
    const manejador = () => callback();
    ipcRenderer.on('app:guardarYSalir', manejador);
    return () => ipcRenderer.removeListener('app:guardarYSalir', manejador);
  },
  onNuevoProyectoMenu: (callback) => {
    const manejador = () => callback();
    ipcRenderer.on('menu:nuevoProyecto', manejador);
    return () => ipcRenderer.removeListener('menu:nuevoProyecto', manejador);
  },
  onImportarSqlMenu: (callback) => {
    const manejador = () => callback();
    ipcRenderer.on('menu:importarSql', manejador);
    return () => ipcRenderer.removeListener('menu:importarSql', manejador);
  },
  onExportarMenu: (callback) => {
    const manejador = () => callback();
    ipcRenderer.on('menu:exportar', manejador);
    return () => ipcRenderer.removeListener('menu:exportar', manejador);
  },
  onMostrarAtajosMenu: (callback) => {
    const manejador = () => callback();
    ipcRenderer.on('menu:mostrarAtajos', manejador);
    return () => ipcRenderer.removeListener('menu:mostrarAtajos', manejador);
  },
  onMostrarPlantillasMenu: (callback) => {
    const manejador = () => callback();
    ipcRenderer.on('menu:mostrarPlantillas', manejador);
    return () => ipcRenderer.removeListener('menu:mostrarPlantillas', manejador);
  },
});
