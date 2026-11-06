import { ProjectIR } from '../ir/types';

/**
 * Genera documentación técnica exhaustiva en formato Markdown
 * compatible con GitHub, Obsidian y GitLab.
 * Permite filtrar por un conjunto específico de tablas o exportar toda la base de datos completa.
 *
 * @param proyecto Modelo canónico del proyecto de base de datos
 * @param idsTablasSeleccionadas Lista opcional de identificadores de tablas a incluir
 * @returns Documento Markdown formateado
 */
export function generateMarkdownDocumentation(proyecto: ProjectIR, idsTablasSeleccionadas?: string[]): string {
  const partes: string[] = [];

  // Determinar el conjunto de tablas a documentar según el alcance
  const tablasParaExportar = idsTablasSeleccionadas && idsTablasSeleccionadas.length > 0
    ? proyecto.tables.filter(tabla => idsTablasSeleccionadas.includes(tabla.id))
    : proyecto.tables;

  const conjuntoIdsTablas = new Set(tablasParaExportar.map(tabla => tabla.id));
  const esParcial = tablasParaExportar.length < proyecto.tables.length;

  // Encabezado principal del documento
  partes.push(`# Diccionario y Arquitectura de Datos: ${proyecto.name}`);
  if (esParcial) {
    partes.push(`\n> **Exportación Parcial:** Documentación de ${tablasParaExportar.length} tabla(s) seleccionada(s).\n`);
  } else if (proyecto.description) {
    partes.push(`\n> ${proyecto.description}\n`);
  }

  // Metadatos técnicos de la base de datos
  partes.push(`- **Motor Relacional:** \`${proyecto.dialect.toUpperCase()}\``);
  partes.push(`- **Versión:** \`${proyecto.version}\``);
  partes.push(`- **Generado:** \`${new Date().toLocaleString()}\``);
  partes.push(`- **Tablas Documentadas:** \`${tablasParaExportar.length}\` ${esParcial ? `(de ${proyecto.tables.length})` : ''}`);

  // Filtrar relaciones relevantes al alcance actual
  const relacionesRelevantes = proyecto.relationships.filter(
    rel => conjuntoIdsTablas.has(rel.sourceTableId) || conjuntoIdsTablas.has(rel.targetTableId)
  );

  partes.push(`- **Relaciones Relevantes:** \`${relacionesRelevantes.length}\``);
  partes.push(`\n---\n`);

  // Índice de tablas
  partes.push(`## Tabla de Contenidos`);
  tablasParaExportar.forEach(tabla => {
    partes.push(`- [${tabla.name}](#${tabla.name.toLowerCase()})`);
  });
  if (relacionesRelevantes.length > 0) {
    partes.push(`- [Resumen de Relaciones](#resumen-de-relaciones)`);
  }
  partes.push(`\n---\n`);

  // Documentar cada tabla en detalle
  tablasParaExportar.forEach(tabla => {
    partes.push(`### <a id="${tabla.name.toLowerCase()}"></a> Tabla: \`${tabla.name}\``);
    if (tabla.comment) {
      partes.push(`*${tabla.comment}*\n`);
    }

    partes.push(`#### Columnas`);
    partes.push(`| Columna | Tipo de Dato | Clave | Nulo | Por Defecto | Descripción |`);
    partes.push(`| :--- | :--- | :---: | :---: | :--- | :--- |`);

    tabla.columns.forEach(columna => {
      let insigniaClave = '-';
      if (columna.isPrimaryKey) insigniaClave = '🔑 PK';
      else if (columna.isForeignKey) insigniaClave = '🔗 FK';
      else if (columna.isUnique) insigniaClave = '⚡ Unique';

      const textoTipo = `${columna.dataType}${columna.length ? `(${columna.length})` : ''}`;
      const textoNulo = columna.isNullable ? 'SÍ' : '**NO**';
      const textoDefecto = columna.defaultValue ? `\`${columna.defaultValue}\`` : '-';
      const textoDescripcion = columna.comment || '-';

      partes.push(`| **${columna.name}** | \`${textoTipo}\` | ${insigniaClave} | ${textoNulo} | ${textoDefecto} | ${textoDescripcion} |`);
    });

    // Índices de la tabla
    if (tabla.indexes && tabla.indexes.length > 0) {
      partes.push(`\n#### Índices`);
      partes.push(`| Nombre | Columnas | Único | Método |`);
      partes.push(`| :--- | :--- | :---: | :---: |`);
      tabla.indexes.forEach(indice => {
        const nombresCols = indice.columnIds
          .map(id => tabla.columns.find(c => c.id === id)?.name || id)
          .join(', ');
        partes.push(`| \`${indice.name}\` | \`${nombresCols}\` | ${indice.isUnique ? 'SÍ' : 'NO'} | \`${indice.method || 'BTREE'}\` |`);
      });
    }

    // Relaciones donde participa la tabla (salientes y entrantes)
    const relacionesSalientes = proyecto.relationships.filter(r => r.sourceTableId === tabla.id);
    const relacionesEntrantes = proyecto.relationships.filter(r => r.targetTableId === tabla.id);

    if (relacionesSalientes.length > 0 || relacionesEntrantes.length > 0) {
      partes.push(`\n#### Relaciones`);
      relacionesSalientes.forEach(rel => {
        const tablaDestino = proyecto.tables.find(t => t.id === rel.targetTableId);
        const columnaOrigen = tabla.columns.find(c => c.id === rel.sourceColumnId);
        const columnaDestino = tablaDestino?.columns.find(c => c.id === rel.targetColumnId);
        partes.push(
          `- **Saliente (FK):** \`${columnaOrigen?.name}\` -> \`${tablaDestino?.name}.${columnaDestino?.name}\` (${rel.cardinality}) | ON DELETE ${rel.onDelete}`
        );
      });
      relacionesEntrantes.forEach(rel => {
        const tablaOrigen = proyecto.tables.find(t => t.id === rel.sourceTableId);
        const columnaDestino = tabla.columns.find(c => c.id === rel.targetColumnId);
        const columnaOrigen = tablaOrigen?.columns.find(c => c.id === rel.sourceColumnId);
        partes.push(
          `- **Entrante (Referenciada por):** \`${tablaOrigen?.name}.${columnaOrigen?.name}\` -> \`${columnaDestino?.name}\` (${rel.cardinality})`
        );
      });
    }

    partes.push(`\n---\n`);
  });

  // Resumen global de relaciones relevantes
  if (relacionesRelevantes.length > 0) {
    partes.push(`## Resumen de Relaciones`);
    partes.push(`| Nombre | Origen (FK) | Destino (PK) | Cardinalidad | ON DELETE | ON UPDATE |`);
    partes.push(`| :--- | :--- | :--- | :---: | :---: | :---: |`);

    relacionesRelevantes.forEach(rel => {
      const tablaOrigen = proyecto.tables.find(t => t.id === rel.sourceTableId);
      const tablaDestino = proyecto.tables.find(t => t.id === rel.targetTableId);
      const columnaOrigen = tablaOrigen?.columns.find(c => c.id === rel.sourceColumnId);
      const columnaDestino = tablaDestino?.columns.find(c => c.id === rel.targetColumnId);

      partes.push(
        `| \`${rel.name || 'FK'}\` | \`${tablaOrigen?.name}.${columnaOrigen?.name}\` | \`${tablaDestino?.name}.${columnaDestino?.name}\` | **${rel.cardinality}** | \`${rel.onDelete}\` | \`${rel.onUpdate}\` |`
      );
    });
  }

  return partes.join('\n');
}
