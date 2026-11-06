import { ProjectIR } from '../ir/types';

/**
 * Genera un archivo CSV estructurado con el diccionario de datos de todas las tablas
 * o de un conjunto específico de entidades seleccionadas dinámicamente.
 * Compatible con Microsoft Excel, Google Sheets y LibreOffice Calc.
 */
export function generateCsvDataDictionary(project: ProjectIR, selectedTableIds?: string[]): string {
  const encabezados = [
    'Tabla',
    'Columna',
    'Tipo de Dato',
    'Longitud',
    'Precisión',
    'Escala',
    'Clave Primaria',
    'Clave Foránea',
    'Único',
    'Permite Nulo',
    'Auto Incremento',
    'Valor por Defecto',
    'Descripción',
  ];

  // Escapa valores según la especificación RFC 4180 (comillas dobles y comas)
  const escaparCsv = (valor: string | number | boolean | undefined | null): string => {
    if (valor === undefined || valor === null) return '""';
    const texto = String(valor).replace(/"/g, '""');
    return `"${texto}"`;
  };

  const filasCsv: string[] = [encabezados.map(escaparCsv).join(',')];

  const tablasParaExportar = selectedTableIds && selectedTableIds.length > 0
    ? project.tables.filter(t => selectedTableIds.includes(t.id))
    : project.tables;

  tablasParaExportar.forEach(tabla => {
    tabla.columns.forEach(columna => {
      const fila = [
        escaparCsv(tabla.name),
        escaparCsv(columna.name),
        escaparCsv(columna.dataType),
        escaparCsv(columna.length || ''),
        escaparCsv(columna.precision || ''),
        escaparCsv(columna.scale || ''),
        escaparCsv(columna.isPrimaryKey ? 'SÍ' : 'NO'),
        escaparCsv(columna.isForeignKey ? 'SÍ' : 'NO'),
        escaparCsv(columna.isUnique ? 'SÍ' : 'NO'),
        escaparCsv(columna.isNullable ? 'SÍ' : 'NO'),
        escaparCsv(columna.isAutoIncrement ? 'SÍ' : 'NO'),
        escaparCsv(columna.defaultValue || ''),
        escaparCsv(columna.comment || ''),
      ];
      filasCsv.push(fila.join(','));
    });
  });

  return filasCsv.join('\r\n');
}

