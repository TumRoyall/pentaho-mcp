/**
 * Auto-detect the workspace root for the MCP. There is no manual root env
 * knob: the root follows the folder the AI client was opened in (the server
 * process's working directory), and the file repositories Spoon knows about
 * (~/.kettle/repositories.xml, PENTAHO_HOME/repositories.xml) only decide
 * whether that folder is repository-backed. A repository registered somewhere
 * else never takes over an unrelated working folder.
 *
 * Precedence (registered = a repository with an existing base_directory):
 *   1. cwd is the base_directory of a registered repository, or inside one
 *      -> repository mode, root = that base_directory (deepest match wins)
 *   2. exactly one registered repository lives inside cwd (or several, one of
 *      which is the default) -> repository mode, root = that base_directory
 *   3. cwd is not a real project folder (user home, drive root, Windows
 *      system dir: some clients launch servers there) -> the default
 *      registered repository, else the first registered one
 *   4. otherwise -> file mode, root = cwd
 *
 * Returns { root, mode: 'repository' | 'file', source, match, registryPath,
 * repository }. `source` is 'kettle_home' | 'pentaho_home' | 'cwd'.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseRepositoriesXml } from '../repository/registration.js';

const caseInsensitive = process.platform === 'win32';
const key = p => (caseInsensitive ? p.toLowerCase() : p);

function readRepositories(registryPath) {
  if (!registryPath || !existsSync(registryPath)) return [];
  try {
    return parseRepositoriesXml(readFileSync(registryPath, 'utf8'));
  } catch {
    return [];
  }
}

function isUsableDirectory(dir) {
  if (typeof dir !== 'string' || dir.trim() === '') return false;
  const resolved = path.resolve(dir.trim());
  return existsSync(resolved) && statSync(resolved).isDirectory();
}

/** True when `child` equals `parent` or sits underneath it. */
function isWithin(parent, child) {
  const rel = path.relative(key(parent), key(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Folders that are a launch location, not a project the user opened. */
function isLaunchLocation(dir, environment) {
  const resolved = path.resolve(dir);
  if (path.parse(resolved).root === resolved) return true;
  const home = environment.USERPROFILE || environment.HOME;
  if (home && key(path.resolve(home)) === key(resolved)) return true;
  const systemRoot = environment.SystemRoot || environment.windir;
  if (systemRoot && isWithin(path.resolve(systemRoot), resolved)) return true;
  return false;
}

/** Every registered file repository with a real base_directory, in precedence order. */
function registeredRepositories(environment, pentahoHome) {
  const sources = [];
  const userHome = environment.USERPROFILE || environment.HOME;
  if (userHome) sources.push({ source: 'kettle_home', registryPath: path.join(userHome, '.kettle', 'repositories.xml') });
  if (pentahoHome && pentahoHome.trim()) {
    sources.push({ source: 'pentaho_home', registryPath: path.join(pentahoHome.trim(), 'repositories.xml') });
  }
  const out = [];
  for (const { source, registryPath } of sources) {
    for (const repository of readRepositories(registryPath)) {
      if (!isUsableDirectory(repository.baseDirectory)) continue;
      out.push({ base: path.resolve(repository.baseDirectory.trim()), source, registryPath, repository });
    }
  }
  return out;
}

function repositoryResult(entry, match) {
  return {
    root: entry.base,
    mode: 'repository',
    source: entry.source,
    match,
    registryPath: entry.registryPath,
    repository: entry.repository,
  };
}

/**
 * @param {object} [opts]
 * @param {NodeJS.ProcessEnv} [opts.environment]
 * @param {string} [opts.cwd]
 * @param {string} [opts.pentahoHome]
 */
export function resolveWorkspaceRoot({
  environment = process.env,
  cwd = process.cwd(),
  pentahoHome = environment.PENTAHO_HOME,
} = {}) {
  const work = path.resolve(cwd);
  const repos = registeredRepositories(environment, pentahoHome);

  // 1. Opened inside (or at) a repository: deepest base_directory wins.
  const containing = repos
    .filter(r => isWithin(r.base, work))
    .sort((a, b) => b.base.length - a.base.length);
  if (containing.length > 0) return repositoryResult(containing[0], 'cwd_inside_repository');

  // 2. Opened at a folder that holds the repository.
  if (!isLaunchLocation(work, environment)) {
    const inside = repos.filter(r => isWithin(work, r.base));
    const distinct = [...new Map(inside.map(r => [key(r.base), r])).values()];
    const chosen = distinct.length === 1 ? distinct[0] : distinct.find(r => r.repository.isDefault);
    if (chosen) return repositoryResult(chosen, 'repository_inside_cwd');
  }

  // 3. Launched from home / drive root / system dir: fall back to Spoon's default.
  if (isLaunchLocation(work, environment) && repos.length > 0) {
    return repositoryResult(repos.find(r => r.repository.isDefault) ?? repos[0], 'fallback_default');
  }

  // 4. Plain folder: file mode at the working directory.
  return { root: work, mode: 'file', source: 'cwd', match: 'cwd', registryPath: null, repository: null };
}
