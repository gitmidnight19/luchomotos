#!/usr/bin/env node
/**
 * Borra artefactos regenerables: cachés de herramientas, bytecode y builds.
 * No toca `data/` (la base de datos) ni `node_modules` / `.venv`.
 * Con --deps borra también las dependencias instaladas.
 */
import { rm, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, no `url.pathname`: la ruta puede llevar espacios y vendrian
// codificados como %20, dejando el barrido sin encontrar nada.
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const conDeps = process.argv.includes('--deps');

/** Directorios a borrar estén donde estén (salvo dentro de EXCLUIDOS). */
const PATRONES = ['__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.expo'];
const SUFIJOS = ['.egg-info'];
const EXCLUIDOS = new Set(['node_modules', '.venv', '.git', 'data']);

/** Rutas concretas, relativas a la raíz. */
const RUTAS = ['movil/dist', 'movil/web-build', 'backend/htmlcov', 'backend/.coverage'];
if (conDeps) RUTAS.push('movil/node_modules');

let borrados = 0;

async function barrer(dir) {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entradas) {
    if (!e.isDirectory()) continue;
    if (EXCLUIDOS.has(e.name)) continue;
    const ruta = join(dir, e.name);
    if (PATRONES.includes(e.name) || SUFIJOS.some((s) => e.name.endsWith(s))) {
      await rm(ruta, { recursive: true, force: true });
      console.log(`  borrado  ${ruta.slice(RAIZ.length + 1)}`);
      borrados++;
      continue;
    }
    await barrer(ruta);
  }
}

await barrer(RAIZ);

for (const rel of RUTAS) {
  const ruta = join(RAIZ, rel);
  try {
    await stat(ruta);
  } catch {
    continue;
  }
  await rm(ruta, { recursive: true, force: true });
  console.log(`  borrado  ${rel}`);
  borrados++;
}

console.log(borrados ? `\n${borrados} artefactos eliminados.` : 'Nada que limpiar.');
