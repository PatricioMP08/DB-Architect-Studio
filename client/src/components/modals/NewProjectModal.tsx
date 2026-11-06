import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Database,
  Plus,
  Layers,
  FileText,
  Check,
  Server,
  Cpu,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { SupportedDialect } from '../../core/ir/types';

interface OpcionDialecto {
  id: SupportedDialect;
  nombre: string;
  version: string;
  descripcion: string;
  colorBorde: string;
  colorFondo: string;
  colorTexto: string;
  badge: string;
}

const OPCIONES_DIALECTOS: OpcionDialecto[] = [
  {
    id: 'postgres',
    nombre: 'PostgreSQL',
    version: '15 / 16+',
    descripcion: 'Soporte avanzado JSONB, UUID nativos, esquemas y estándares ACID.',
    colorBorde: 'hover:border-[#336791] dark:hover:border-[#6495ED]',
    colorFondo: 'peer-checked:bg-[#336791]/10 dark:peer-checked:bg-[#336791]/20',
    colorTexto: 'text-[#336791] dark:text-[#6495ED]',
    badge: 'Open Source',
  },
  {
    id: 'mysql',
    nombre: 'MySQL',
    version: '8.0+ / MariaDB',
    descripcion: 'Motor InnoDB, utf8mb4 y alta compatibilidad web y servidores LAMP.',
    colorBorde: 'hover:border-[#00758F] dark:hover:border-[#00A8CC]',
    colorFondo: 'peer-checked:bg-[#00758F]/10 dark:peer-checked:bg-[#00758F]/20',
    colorTexto: 'text-[#00758F] dark:text-[#00A8CC]',
    badge: 'Web Standard',
  },
  {
    id: 'sqlite',
    nombre: 'SQLite',
    version: '3.x',
    descripcion: 'Base de datos embebida serverless, tipos dinámicos y PRAGMA FKs.',
    colorBorde: 'hover:border-[#003B57] dark:hover:border-[#38BDF8]',
    colorFondo: 'peer-checked:bg-[#003B57]/10 dark:peer-checked:bg-[#003B57]/20',
    colorTexto: 'text-[#003B57] dark:text-[#38BDF8]',
    badge: 'Serverless',
  },
  {
    id: 'sqlserver',
    nombre: 'Microsoft SQL Server',
    version: '2019 / 2022 / Azure SQL',
    descripcion: 'Dialecto T-SQL, claves agrupadas CLUSTERED, NVARCHAR y esquemas [dbo].',
    colorBorde: 'hover:border-[#0078D4] dark:hover:border-[#60A5FA]',
    colorFondo: 'peer-checked:bg-[#0078D4]/10 dark:peer-checked:bg-[#0078D4]/20',
    colorTexto: 'text-[#0078D4] dark:text-[#60A5FA]',
    badge: 'Enterprise',
  },
  {
    id: 'oracle',
    nombre: 'Oracle Database',
    version: '19c / 21c / 23c',
    descripcion: 'Dialecto PL/SQL corporativo, NUMBER, VARCHAR2(CHAR) e identidades IDENTITY.',
    colorBorde: 'hover:border-[#F80000] dark:hover:border-[#F87171]',
    colorFondo: 'peer-checked:bg-[#F80000]/10 dark:peer-checked:bg-[#F80000]/20',
    colorTexto: 'text-[#b91c1c] dark:text-[#F87171]',
    badge: 'Corporate',
  },
];

export const NewProjectModal: React.FC = () => {
  const { createNewProject, hasUnsavedChanges } = useProjectStore();
  const { activeModal, setActiveModal, setPendingAction } = useUiStore();

  const [nombre, setNombre] = useState('Mi Sistema de Datos');
  const [descripcion, setDescripcion] = useState('Plataforma y arquitectura relacional con registro de auditoría');
  const [dialecto, setDialecto] = useState<SupportedDialect>('postgres');
  const [iniciarEnBlanco, setIniciarEnBlanco] = useState(true);

  if (activeModal !== 'newProject') return null;

  const ejecutarCreacion = () => {
    useUiStore.getState().clearSelection();
    createNewProject({
      name: nombre.trim(),
      description: descripcion.trim(),
      dialect: dialecto,
      startEmpty: iniciarEnBlanco,
    });
    setActiveModal(null);
  };

  const manejarCreacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    // Si el proyecto activo tiene modificaciones sin guardar, pedir confirmación para no perder datos
    if (hasUnsavedChanges) {
      setPendingAction(() => {
        ejecutarCreacion();
      });
      setActiveModal('unsavedChanges');
    } else {
      ejecutarCreacion();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in text-xs transition-colors flex flex-col max-h-[92vh]">
        {/* Cabecera del Diálogo Modal */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Crear Nuevo Proyecto de Base de Datos
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Inicia un modelo de datos desde cero con configuración personalizada y motor SQL
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario Principal */}
        <form onSubmit={manejarCreacion} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. Nombre del Proyecto */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Nombre del Proyecto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. E-Commerce Storefront, ERP Corporativo, etc."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* 2. Descripción General y Propósito */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Descripción del Proyecto (Aparecerá en el encabezado SQL DDL)
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el propósito del sistema de datos para documentar el script generado..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* 3. Selección del Motor de Base de Datos (Dialecto) */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Motor Relacional de Base de Datos (Dialecto Objetivo)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPCIONES_DIALECTOS.map((opc) => {
                const seleccionado = dialecto === opc.id;
                return (
                  <label
                    key={opc.id}
                    onClick={() => setDialecto(opc.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl transition-all cursor-pointer ${
                      seleccionado
                        ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 ring-1 ring-brand-500/20 shadow-sm'
                        : 'border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dialect"
                      checked={seleccionado}
                      onChange={() => setDialecto(opc.id)}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold text-xs ${seleccionado ? opc.colorTexto : 'text-slate-900 dark:text-slate-100'}`}>
                          {opc.nombre}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {opc.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {opc.descripcion}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 4. Estado Inicial del Lienzo */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              Contenido Inicial del Lienzo
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIniciarEnBlanco(true)}
                className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${
                  iniciarEnBlanco
                    ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold shadow-sm ring-1 ring-brand-500/20'
                    : 'border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Layers className="w-4 h-4 flex-shrink-0" />
                <div>
                  <div className="text-xs">Lienzo en Blanco (0 tablas)</div>
                  <div className="text-[10px] text-slate-400 font-normal">Empieza totalmente desde cero</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIniciarEnBlanco(false)}
                className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${
                  !iniciarEnBlanco
                    ? 'border-2 border-brand-500 dark:border-brand-400 bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold shadow-sm ring-1 ring-brand-500/20'
                    : 'border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Database className="w-4 h-4 flex-shrink-0" />
                <div>
                  <div className="text-xs">Tabla Base Inicial ('usuarios')</div>
                  <div className="text-[10px] text-slate-400 font-normal">Con PK, email, nombre y comentarios</div>
                </div>
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-all shadow-glow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Proyecto desde Cero</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
