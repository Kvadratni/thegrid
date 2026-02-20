import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface GitStatusFile {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'untracked';
}

export interface GitLogEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
}

// Resolve the actual workspace root since the server might be running inside /server
function getWorkspaceDir(): string {
    const current = process.cwd();
    if (current.endsWith(path.sep + 'server') || current.endsWith('/server')) {
        return path.resolve(current, '..');
    }
    return current;
}

// Run a git command in a specific directory, defaulting to workspace root
async function runGit(command: string, cwd?: string): Promise<string> {
    try {
        const dir = cwd || getWorkspaceDir();
        const { stdout } = await execAsync(`git ${command}`, { cwd: dir });
        return stdout.trim();
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Git error: ${error.message}`);
        }
        throw error;
    }
}

export async function checkIsGitRepo(dirPath?: string): Promise<boolean> {
    try {
        await runGit('rev-parse --is-inside-work-tree', dirPath);
        return true;
    } catch {
        return false;
    }
}

export async function getStatus(dirPath?: string): Promise<{ branch: string; files: GitStatusFile[] }> {
    const dir = dirPath || getWorkspaceDir();
    const branch = await runGit('branch --show-current', dir);
    const porcelain = await runGit('status --porcelain', dir);

    if (!porcelain) {
        return { branch, files: [] };
    }

    const files: GitStatusFile[] = porcelain.split('\n').map(line => {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);

        let status: GitStatusFile['status'] = 'modified';
        if (statusCode === '??') status = 'untracked';
        else if (statusCode.includes('A')) status = 'added';
        else if (statusCode.includes('D')) status = 'deleted';

        return { path: filePath, status };
    });

    return { branch, files };
}

export async function getLog(dirPath?: string): Promise<GitLogEntry[]> {
    try {
        const dir = dirPath || getWorkspaceDir();
        const rawLog = await runGit('log -n 30 --format="%h|%s|%an|%aI"', dir);
        if (!rawLog) return [];

        return rawLog.split('\n').map(line => {
            const parts = line.split('|');
            const message = parts.slice(1, parts.length - 2).join('|');
            const author = parts[parts.length - 2];
            const date = parts[parts.length - 1];
            return {
                hash: parts[0],
                message: message || parts[1] || 'No message',
                author,
                date,
            };
        });
    } catch {
        return [];
    }
}

export async function getDiff(filePath?: string, dirPath?: string): Promise<string> {
    try {
        const dir = dirPath || getWorkspaceDir();
        const target = filePath ? `"${filePath}"` : '';
        return await runGit(`diff --unified=3 HEAD ${target}`, dir);
    } catch {
        if (filePath) {
            try {
                const absolutePath = path.resolve(dirPath || getWorkspaceDir(), filePath);
                const content = await fs.readFile(absolutePath, 'utf-8');
                return `Untracked file: ${filePath}\n\n${content}`;
            } catch {
                return 'Could not read file content.';
            }
        }
        return '';
    }
}

export async function commitChanges(message: string, dirPath?: string): Promise<string> {
    if (!message.trim()) throw new Error('Commit message is required.');
    const dir = dirPath || getWorkspaceDir();
    const safeMessage = message.replace(/"/g, '\\"');
    await runGit('add .', dir);
    return await runGit(`commit -m "${safeMessage}"`, dir);
}

export async function pushChanges(dirPath?: string): Promise<string> {
    const dir = dirPath || getWorkspaceDir();
    const branch = await runGit('branch --show-current', dir);
    return await runGit(`push origin ${branch}`, dir);
}

export async function pullChanges(dirPath?: string): Promise<string> {
    const dir = dirPath || getWorkspaceDir();
    const branch = await runGit('branch --show-current', dir);
    return await runGit(`pull origin ${branch}`, dir);
}

// Discover all git repos under a given root directory (max 4 levels deep)
export async function findGitRepos(rootPath: string): Promise<string[]> {
    try {
        // Use find to locate .git directories, then return their parents
        const { stdout } = await execAsync(
            `find "${rootPath}" -maxdepth 4 -name ".git" -type d 2>/dev/null`,
            { cwd: rootPath }
        );
        if (!stdout.trim()) return [];
        return stdout.trim().split('\n')
            .map(p => path.dirname(p))      // parent of .git = repo root
            .filter(p => p && p !== '.');
    } catch {
        return [];
    }
}
