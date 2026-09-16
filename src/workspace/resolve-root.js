/**
 * Auto-detect the workspace root for the MCP, mirroring how Spoon decides
 * where it is operating. There is no manual KETTLE_ROOT knob anymore; the root
 * is discovered from the same two places Spoon looks for a file repository,
 * and falls back to the AI working directory when neither is present.
 *
 * Precedence:
 *   1. ~/.kettle/repositories.xml           -> repository mode (base_directory)
 *   2. PENTAHO_HOME/repositories.xml         -> repository mode (base_directory)
 *      (the data-integration install directory)
 *   3. current working directory             -> file mode
 *
 * Within a repositories.xml the default repository wins (is_default=Y),
 * otherwise the first repository whose base_directory exists is chosen.
 *
 * Returns { root, mode: 'repository' | 'file', source, repository|null }.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseRepositoriesXml } from '../repository/registration.js';

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

/** Pick the default repo, else the first whose base_directory is a real dir. */
function chooseRepository(repositories) {
  const usable = repositories.filter(r => isUsableDirectory(r.baseDirectory));
  if (usable.length === 0) return null;
  return usable.find(r => r.isDefault) ?? usable[0];
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
  const userHome = environment.USERPROFILE || environment.HOME;

  // 1. ~/.kettle/repositories.xml
  if (userHome) {
    const kettleRegistry = path.join(userHome, '.kettle', 'repositories.xml');
    const repo = chooseRepository(readRepositories(kettleRegistry));
    if (repo) {
      return {
        root: path.resolve(repo.baseDirectory),
        mode: 'repository',
        source: 'kettle_home',
        registryPath: kettleRegistry,
        repository: repo,
      };
    }
  }

  // 2. PENTAHO_HOME/repositories.xml (data-integration install)
  if (pentahoHome && pentahoHome.trim()) {
    const installRegistry = path.join(pentahoHome.trim(), 'repositories.xml');
    const repo = chooseRepository(readRepositories(installRegistry));
    if (repo) {
      return {
        root: path.resolve(repo.baseDirectory),
        mode: 'repository',
        source: 'pentaho_home',
        registryPath: installRegistry,
        repository: repo,
      };
    }
  }

  // 3. Fallback: the AI working directory, file mode
  return {
    root: path.resolve(cwd),
    mode: 'file',
    source: 'cwd',
    registryPath: null,
    repository: null,
  };
}
