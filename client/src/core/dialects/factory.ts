import { SupportedDialect } from '../ir/types';
import { SqlGenerator } from './types';
import { PostgresSqlGenerator } from './postgres';
import { MySqlGenerator } from './mysql';
import { SqliteGenerator } from './sqlite';
import { SqlServerGenerator } from './sqlserver';
import { OracleGenerator } from './oracle';

/**
 * Fábrica de generadores SQL según el motor relacional seleccionado.
 * Implementa el patrón Factory Method para instanciar y despachar
 * el generador DDL adecuado (PostgreSQL, MySQL, SQLite, SQL Server u Oracle).
 */
export class SqlGeneratorFactory {
  // Registro en memoria de las instancias singleton de generadores por dialecto
  private static generadores: Map<SupportedDialect, SqlGenerator> = new Map([
    ['postgres', new PostgresSqlGenerator()],
    ['mysql', new MySqlGenerator()],
    ['sqlite', new SqliteGenerator()],
    ['sqlserver', new SqlServerGenerator()],
    ['oracle', new OracleGenerator()],
  ]);

  /**
   * Obtiene la instancia del generador SQL correspondiente al dialecto solicitado.
   *
   * @param dialecto Dialecto relacional objetivo ('postgres', 'mysql', 'sqlite')
   * @returns Instancia que implementa la interfaz SqlGenerator
   */
  public static getGenerator(dialecto: SupportedDialect): SqlGenerator {
    const generador = this.generadores.get(dialecto);
    if (!generador) {
      throw new Error(`Dialecto SQL no soportado: ${dialecto}`);
    }
    return generador;
  }
}
