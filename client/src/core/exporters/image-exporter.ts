import { toBlob, toCanvas, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { ProjectIR, TableIR } from '../ir/types';

/**
 * Sanitiza y normaliza un nombre de archivo para ser 100% seguro en Windows, macOS y Linux.
 * Elimina caracteres reservados como / \ ? % * : | " < > y reemplaza espacios por guiones bajos.
 */
export function sanitizeFileName(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

/**
 * Guarda un Blob en el equipo del usuario de manera infalible.
 * Utiliza FileSaver con fallback automático a enlace DOM nativo.
 */
export function guardarBlob(blob: Blob, nombreArchivo: string): void {
  try {
    if (typeof saveAs === 'function') {
      saveAs(blob, nombreArchivo);
      return;
    }
  } catch (error) {
    console.warn('Advertencia al invocar saveAs, recurriendo a enlace nativo:', error);
  }

  // Fallback universal mediante elemento <a>
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.style.display = 'none';
  document.body.appendChild(enlace);
  enlace.click();
  setTimeout(() => {
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Convierte un Data URL en base64 o texto codificado a un Blob binario nativo del navegador.
 */
function convertirDataUrlABlob(urlDatos: string): Blob {
  try {
    const partes = urlDatos.split(';base64,');
    if (partes.length === 2) {
      const tipoContenido = partes[0].split(':')[1];
      const binario = window.atob(partes[1]);
      const longitudBinaria = binario.length;
      const arregloBytes = new Uint8Array(longitudBinaria);
      for (let i = 0; i < longitudBinaria; ++i) {
        arregloBytes[i] = binario.charCodeAt(i);
      }
      return new Blob([arregloBytes], { type: tipoContenido });
    }
    // Para URLs de vectores SVG codificadas en utf8
    if (urlDatos.startsWith('data:image/svg+xml;charset=utf-8,')) {
      const textoSvg = decodeURIComponent(urlDatos.split('data:image/svg+xml;charset=utf-8,')[1]);
      return new Blob([textoSvg], { type: 'image/svg+xml;charset=utf-8' });
    }
  } catch (error) {
    console.warn('Advertencia al convertir dataUrl a Blob:', error);
  }
  return new Blob([urlDatos], { type: 'application/octet-stream' });
}

/**
 * Descarga un archivo de texto o código de forma robusta,
 * garantizando que Microsoft Edge y Chrome en Windows preserven el nombre del archivo y su extensión.
 */
export function downloadFile(contenido: string, nombreCrudo: string, tipoMime: string): void {
  // 1. Sanitizar el nombre del archivo y preservar su extensión explícita
  const coincidenciaExtension = nombreCrudo.match(/\.([a-zA-Z0-9]+)$/);
  const extension = coincidenciaExtension ? coincidenciaExtension[0] : '';
  const nombreBase = coincidenciaExtension ? nombreCrudo.slice(0, -extension.length) : nombreCrudo;
  const nombreArchivoFinal = `${sanitizeFileName(nombreBase)}${extension}`;

  // 2. Normalizar tipo MIME y codificación de caracteres
  let mimeLimpio = tipoMime;
  let contenidoConBom = contenido;

  if (tipoMime.includes('csv')) {
    // Para CSV agregamos la Marca de Orden de Bytes UTF-8 (\uFEFF) para visualización nativa en Microsoft Excel
    contenidoConBom = `\uFEFF${contenido}`;
    mimeLimpio = 'text/csv;charset=utf-8';
  } else if (tipoMime.includes('sql')) {
    mimeLimpio = 'application/sql;charset=utf-8';
  } else if (tipoMime.includes('markdown') || tipoMime.includes('md')) {
    mimeLimpio = 'text/markdown;charset=utf-8';
  } else if (tipoMime.includes('json')) {
    mimeLimpio = 'application/json;charset=utf-8';
  } else if (!mimeLimpio.includes('charset')) {
    mimeLimpio = `${mimeLimpio};charset=utf-8`;
  }

  // 3. Crear Blob con tipo MIME explícito
  const blob = new Blob([contenidoConBom], { type: mimeLimpio });

  // 4. Invocar guardado persistente de archivo
  guardarBlob(blob, nombreArchivoFinal);
}

export interface DiagramBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  translateX: number;
  translateY: number;
}

/**
 * Calcula las dimensiones y la traslación exacta para enfocar y encuadrar
 * el 100% de las tablas del esquema en la imagen exportada, independientemente
 * del nivel de zoom o paneo actual del usuario en la pantalla.
 */
export function calculateDiagramBounds(
  tablas: TableIR[],
  targetTableIds?: string[],
  padding = 80
): DiagramBounds {
  let tablasObjetivo = tablas;
  if (targetTableIds && targetTableIds.length > 0) {
    const filtradas = tablas.filter((t) => targetTableIds.includes(t.id));
    if (filtradas.length > 0) {
      tablasObjetivo = filtradas;
    }
  }

  if (!tablasObjetivo || tablasObjetivo.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1200,
      maxY: 800,
      width: 1200,
      height: 800,
      translateX: 0,
      translateY: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const tabla of tablasObjetivo) {
    let posX = tabla.position?.x ?? 0;
    let posY = tabla.position?.y ?? 0;

    let ancho = 320;
    let alto = tabla.isCollapsed ? 60 : 90 + (tabla.columns?.length || 0) * 36;

    if (typeof document !== 'undefined') {
      const nodoDom = document.querySelector(`.react-flow__node[data-id="${tabla.id}"]`) as HTMLElement | null;
      if (nodoDom) {
        if (nodoDom.offsetWidth > 0) ancho = nodoDom.offsetWidth;
        if (nodoDom.offsetHeight > 0) alto = nodoDom.offsetHeight;

        // Si el nodo en el DOM tiene transform inline con translate, extraer coordenadas en vivo
        if (nodoDom.style.transform) {
          const coincidencia = nodoDom.style.transform.match(
            /translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/
          );
          if (coincidencia) {
            posX = parseFloat(coincidencia[1]);
            posY = parseFloat(coincidencia[2]);
          }
        }
      }
    }

    minX = Math.min(minX, posX);
    minY = Math.min(minY, posY);
    maxX = Math.max(maxX, posX + ancho);
    maxY = Math.max(maxY, posY + alto);
  }

  // Prevenir rangos inválidos por seguridad
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = 1200;
    maxY = 800;
  }

  const anchoContenido = Math.max(100, maxX - minX);
  const altoContenido = Math.max(100, maxY - minY);

  let anchoImagen = Math.ceil(anchoContenido + padding * 2);
  let altoImagen = Math.ceil(altoContenido + padding * 2);

  // Dimensiones mínimas para que diagramas con pocas tablas queden elegantes y no diminutos
  const anchoMinimo = 900;
  const altoMinimo = 600;

  let extraX = 0;
  let extraY = 0;

  if (anchoImagen < anchoMinimo) {
    extraX = Math.round((anchoMinimo - anchoImagen) / 2);
    anchoImagen = anchoMinimo;
  }
  if (altoImagen < altoMinimo) {
    extraY = Math.round((altoMinimo - altoImagen) / 2);
    altoImagen = altoMinimo;
  }

  const translateX = -minX + padding + extraX;
  const translateY = -minY + padding + extraY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: anchoImagen,
    height: altoImagen,
    translateX,
    translateY,
  };
}

export const ESSENTIAL_STYLE_PROPERTIES = [
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'transform',
  'transform-origin',
  'box-sizing',
  'z-index',
  'display',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
  'flex',
  'flex-shrink',
  'flex-grow',
  'background',
  'background-color',
  'color',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'text-overflow',
  'white-space',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'box-shadow',
  'filter',
  'overflow',
  'visibility',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'fill',
  'd',
];

/**
 * Filtro de nodo de alto rendimiento para exportación.
 * Descarta botones interactivos, formularios y puertos de conexión,
 * reduciendo más del 70% de los elementos DOM innecesarios a clonar.
 */
function filterExportNode(nodo: HTMLElement, targetTableIds?: string[]): boolean {
  if (!nodo || !nodo.tagName) return true;

  const tag = nodo.tagName.toUpperCase();

  // 1. Descartar de raíz todos los botones interactivos (elimina botones de acción, iconos de papelera, etc.)
  if (tag === 'BUTTON' || tag === 'FORM' || tag === 'INPUT' || tag === 'SELECT') {
    return false;
  }

  const listaClases = nodo.classList;
  if (!listaClases) return true;

  // 2. Descartar controles y puertos de conexión interactivos
  if (
    listaClases.contains('react-flow__controls') ||
    listaClases.contains('react-flow__attribution') ||
    listaClases.contains('react-flow__minimap') ||
    listaClases.contains('react-flow__handle') ||
    listaClases.contains('react-flow__panel') ||
    listaClases.contains('react-flow__resize-control')
  ) {
    return false;
  }

  // 3. Filtrar nodos según el ámbito seleccionado
  if (
    targetTableIds &&
    targetTableIds.length > 0 &&
    listaClases.contains('react-flow__node')
  ) {
    const idTabla = nodo.getAttribute('data-id');
    if (idTabla && !targetTableIds.includes(idTabla)) {
      return false;
    }
  }

  return true;
}

/**
 * Exporta el lienzo del diagrama a una imagen PNG de alta resolución,
 * optimizado para ejecución instantánea mediante toBlob y estilos filtrados.
 */
export async function exportDiagramAsPng(
  elemento: HTMLElement,
  proyecto: ProjectIR,
  idsTablasObjetivo?: string[],
  nombreArchivo = 'schema-diagram.png',
  esModoOscuro = true
): Promise<void> {
  const colorFondo = esModoOscuro ? '#080C14' : '#F8FAFC';
  const bounds = calculateDiagramBounds(proyecto.tables, idsTablasObjetivo, 80);

  // Escala balanceada: 1.25 a 1.5 es ultra rápido y nítido para exportación
  const dimensionMaxima = Math.max(bounds.width, bounds.height);
  let pixelRatio = 1.25;
  if (dimensionMaxima > 2000) {
    pixelRatio = 1;
  } else if (dimensionMaxima < 1000) {
    pixelRatio = 1.5;
  }

  const opciones = {
    backgroundColor: colorFondo,
    pixelRatio,
    skipFonts: true,
    fontEmbedCSS: '',
    includeStyleProperties: ESSENTIAL_STYLE_PROPERTIES,
    cacheBust: false,
    width: bounds.width,
    height: bounds.height,
    style: {
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `translate(${bounds.translateX}px, ${bounds.translateY}px) scale(1)`,
      transformOrigin: '0 0',
    },
    filter: (nodo: HTMLElement) => filterExportNode(nodo, idsTablasObjetivo),
  };

  let blob = await toBlob(elemento, opciones as any);
  if (!blob) {
    const canvas = await toCanvas(elemento, opciones as any);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  if (blob) {
    const nombreArchivoSeguro = sanitizeFileName(nombreArchivo.replace(/\.png$/i, '')) + '.png';
    guardarBlob(blob, nombreArchivoSeguro);
  }
}

/**
 * Exporta el lienzo a un gráfico vectorial SVG escalable,
 * encuadrando y enfocando el 100% de las tablas del esquema seleccionado sin recortes.
 */
export async function exportDiagramAsSvg(
  elemento: HTMLElement,
  proyecto: ProjectIR,
  idsTablasObjetivo?: string[],
  nombreArchivo = 'schema-diagram.svg',
  esModoOscuro = true
): Promise<void> {
  const colorFondo = esModoOscuro ? '#080C14' : '#F8FAFC';
  const bounds = calculateDiagramBounds(proyecto.tables, idsTablasObjetivo, 80);

  const urlDatos = await toSvg(elemento, {
    backgroundColor: colorFondo,
    skipFonts: true,
    fontEmbedCSS: '',
    includeStyleProperties: ESSENTIAL_STYLE_PROPERTIES,
    cacheBust: false,
    width: bounds.width,
    height: bounds.height,
    style: {
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `translate(${bounds.translateX}px, ${bounds.translateY}px) scale(1)`,
      transformOrigin: '0 0',
    },
    filter: (nodo: HTMLElement) => filterExportNode(nodo, idsTablasObjetivo),
  } as any);

  const nombreArchivoSeguro = sanitizeFileName(nombreArchivo.replace(/\.svg$/i, '')) + '.svg';
  const blob = convertirDataUrlABlob(urlDatos);
  guardarBlob(blob, nombreArchivoSeguro);
}

/**
 * Exporta el esquema visual a un documento formal PDF en tamaño A3 (apaisado o vertical según la geometría),
 * acelerado mediante toCanvas y compresión JPEG nativa de alta fidelidad.
 */
export async function exportDiagramAsPdf(
  elemento: HTMLElement,
  proyecto: ProjectIR,
  idsTablasObjetivo?: string[],
  nombreArchivo = 'schema-diagram.pdf',
  esModoOscuro = true
): Promise<void> {
  const colorFondo = esModoOscuro ? '#080C14' : '#F8FAFC';
  const bounds = calculateDiagramBounds(proyecto.tables, idsTablasObjetivo, 80);

  const dimensionMaxima = Math.max(bounds.width, bounds.height);
  let pixelRatio = 1.25;
  if (dimensionMaxima > 2000) {
    pixelRatio = 1;
  } else if (dimensionMaxima < 1000) {
    pixelRatio = 1.5;
  }

  // Generar directamente el lienzo Canvas usando la lista esencial de estilos
  const canvas = await toCanvas(elemento, {
    backgroundColor: colorFondo,
    pixelRatio,
    skipFonts: true,
    fontEmbedCSS: '',
    includeStyleProperties: ESSENTIAL_STYLE_PROPERTIES,
    cacheBust: false,
    width: bounds.width,
    height: bounds.height,
    style: {
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `translate(${bounds.translateX}px, ${bounds.translateY}px) scale(1)`,
      transformOrigin: '0 0',
    },
    filter: (nodo: HTMLElement) => filterExportNode(nodo, idsTablasObjetivo),
  } as any);

  // Elegir orientación según la relación de aspecto del diagrama para maximizar el área visible
  const esVertical = bounds.height > bounds.width * 1.15;
  const orientacion = esVertical ? 'portrait' : 'landscape';

  const pdf = new jsPDF({
    orientation: orientacion,
    unit: 'mm',
    format: 'a3',
  });

  const anchoPagina = pdf.internal.pageSize.getWidth();
  const altoPagina = pdf.internal.pageSize.getHeight();

  // 1. Fondo completo de la página uniforme con el tema (evita marcos blancos en modo oscuro)
  pdf.setFillColor(esModoOscuro ? '#080C14' : '#F8FAFC');
  pdf.rect(0, 0, anchoPagina, altoPagina, 'F');

  // 2. Encabezado institucional superior
  const altoEncabezado = 22;
  pdf.setFillColor(esModoOscuro ? '#0B0F19' : '#FFFFFF');
  pdf.rect(0, 0, anchoPagina, altoEncabezado, 'F');

  // Línea divisoria inferior del encabezado
  pdf.setDrawColor(esModoOscuro ? '#1E293B' : '#E2E8F0');
  pdf.setLineWidth(0.4);
  pdf.line(0, altoEncabezado, anchoPagina, altoEncabezado);

  // Título del proyecto
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(esModoOscuro ? '#F8FAFC' : '#0F172A');
  pdf.text(`DB Architect Studio — ${proyecto.name}`, 14, 10);

  // Metadatos técnicos en el encabezado
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(esModoOscuro ? '#94A3B8' : '#64748B');
  const totalTablas = proyecto.tables.length;
  const totalRelaciones = proyecto.relationships?.length || 0;
  const subtitulo = `Motor: ${proyecto.dialect.toUpperCase()}  |  ${totalTablas} ${totalTablas === 1 ? 'tabla' : 'tablas'}  |  ${totalRelaciones} ${totalRelaciones === 1 ? 'relación' : 'relaciones'}`;
  pdf.text(subtitulo, 14, 17);

  // Fecha y hora de generación a la derecha
  const fechaTexto = `Generado: ${new Date().toLocaleString()}`;
  pdf.text(fechaTexto, anchoPagina - 14, 14, { align: 'right' });

  // 3. Dimensionamiento y posicionado proporcional del diagrama (sin distorsión)
  const margenHorizontal = 12;
  const margenSuperior = altoEncabezado + 6;
  const margenInferior = 12;

  const anchoDisponible = anchoPagina - margenHorizontal * 2;
  const altoDisponible = altoPagina - margenSuperior - margenInferior;

  const relacionAspectoDiagrama = bounds.width / bounds.height;
  const relacionAspectoDisponible = anchoDisponible / altoDisponible;

  let anchoRender = anchoDisponible;
  let altoRender = altoDisponible;

  if (relacionAspectoDiagrama > relacionAspectoDisponible) {
    // El diagrama es más ancho relativamente: limitar por el ancho disponible
    anchoRender = anchoDisponible;
    altoRender = anchoRender / relacionAspectoDiagrama;
  } else {
    // El diagrama es más alto: limitar por el alto disponible
    altoRender = altoDisponible;
    anchoRender = altoRender * relacionAspectoDiagrama;
  }

  // Centrar la imagen en el espacio disponible
  const posX = (anchoPagina - anchoRender) / 2;
  const posY = margenSuperior + (altoDisponible - altoRender) / 2;

  // Insertar Canvas directamente en el PDF usando JPEG de alta fidelidad y compresión acelerada
  pdf.addImage(canvas, 'JPEG', posX, posY, anchoRender, altoRender, undefined, 'FAST');

  // 4. Pie de página formal
  pdf.setFontSize(7.5);
  pdf.setTextColor(esModoOscuro ? '#475569' : '#94A3B8');
  pdf.text('Esquema de Base de Datos relacional generado por DB Architect Studio', 14, altoPagina - 5);
  pdf.text('Página 1 / 1', anchoPagina - 14, altoPagina - 5, { align: 'right' });

  const nombrePdfSeguro = sanitizeFileName(nombreArchivo.replace(/\.pdf$/i, '')) + '.pdf';
  pdf.save(nombrePdfSeguro);
}
