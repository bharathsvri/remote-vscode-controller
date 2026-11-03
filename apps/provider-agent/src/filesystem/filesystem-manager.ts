import * as fs from 'fs';
import * as path from 'path';
import {
  DirectoryListResponse,
  FileNode,
  FileReadResponse,
  safeResolvePath,
} from '@remote-vscode/shared';

export class FileSystemManager {
  /**
   * List files and directories within the authorized workspace.
   */
  public listDirectory(workspaceRoot: string, relativePath: string = ''): DirectoryListResponse {
    const targetDir = safeResolvePath(workspaceRoot, relativePath);

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory does not exist: ${relativePath}`);
    }

    const dirents = fs.readdirSync(targetDir, { withFileTypes: true });
    const items: FileNode[] = dirents.map(dirent => {
      const fullPath = path.join(targetDir, dirent.name);
      const itemRelPath = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');
      let size = 0;
      let modifiedTime = 0;

      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        modifiedTime = stat.mtimeMs;
      } catch {
        // Ignore unreadable stat
      }

      return {
        name: dirent.name,
        path: fullPath,
        relativePath: itemRelPath,
        isDirectory: dirent.isDirectory(),
        size,
        modifiedTime,
        extension: dirent.isDirectory() ? undefined : path.extname(dirent.name).toLowerCase(),
      };
    });

    // Sort folders first, then files alphabetically
    items.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });

    return {
      currentPath: targetDir,
      relativePath: path.relative(workspaceRoot, targetDir).replace(/\\/g, '/'),
      items,
    };
  }

  /**
   * Read file content safely within the authorized workspace.
   */
  public readFile(workspaceRoot: string, relativePath: string): FileReadResponse {
    const filePath = safeResolvePath(workspaceRoot, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      throw new Error(`Target is a directory, not a file: ${relativePath}`);
    }

    // Determine encoding (support binary files via base64 or text via utf-8)
    const buffer = fs.readFileSync(filePath);
    const isText = this.isTextBuffer(buffer);

    return {
      path: relativePath,
      content: isText ? buffer.toString('utf-8') : buffer.toString('base64'),
      encoding: isText ? 'utf-8' : 'base64',
      size: stat.size,
    };
  }

  /**
   * Write file content safely within the authorized workspace.
   */
  public writeFile(workspaceRoot: string, relativePath: string, content: string, encoding: 'utf-8' | 'base64' = 'utf-8'): void {
    const filePath = safeResolvePath(workspaceRoot, relativePath);
    const parentDir = path.dirname(filePath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const buffer = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8');
    fs.writeFileSync(filePath, buffer);
  }

  /**
   * Create a new file or directory safely within the authorized workspace.
   */
  public createItem(workspaceRoot: string, relativePath: string, isDirectory: boolean): void {
    const targetPath = safeResolvePath(workspaceRoot, relativePath);

    if (fs.existsSync(targetPath)) {
      throw new Error(`Item already exists: ${relativePath}`);
    }

    if (isDirectory) {
      fs.mkdirSync(targetPath, { recursive: true });
    } else {
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, '');
    }
  }

  /**
   * Delete a file or directory safely with confirmation check.
   */
  public deleteItem(workspaceRoot: string, relativePath: string, isDirectory: boolean = false): void {
    const targetPath = safeResolvePath(workspaceRoot, relativePath);

    if (targetPath.toLowerCase() === path.resolve(workspaceRoot).toLowerCase()) {
      throw new Error('Cannot delete the root workspace folder itself');
    }

    if (!fs.existsSync(targetPath)) {
      return;
    }

    if (isDirectory) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }

  /**
   * Rename or move an item safely within the authorized workspace.
   */
  public renameItem(workspaceRoot: string, oldRelativePath: string, newRelativePath: string): void {
    const oldPath = safeResolvePath(workspaceRoot, oldRelativePath);
    const newPath = safeResolvePath(workspaceRoot, newRelativePath);

    if (!fs.existsSync(oldPath)) {
      throw new Error(`Source item not found: ${oldRelativePath}`);
    }

    if (fs.existsSync(newPath)) {
      throw new Error(`Destination item already exists: ${newRelativePath}`);
    }

    fs.renameSync(oldPath, newPath);
  }

  /**
   * Search files by pattern/query inside the authorized workspace.
   */
  public searchFiles(workspaceRoot: string, query: string, maxResults: number = 50): FileNode[] {
    const results: FileNode[] = [];
    const lowerQuery = query.toLowerCase();

    const scan = (dir: string) => {
      if (results.length >= maxResults) return;

      const dirents = fs.readdirSync(dir, { withFileTypes: true });
      for (const dirent of dirents) {
        if (results.length >= maxResults) break;

        // Skip node_modules and .git by default
        if (dirent.name === 'node_modules' || dirent.name === '.git' || dirent.name === 'dist') {
          continue;
        }

        const fullPath = path.join(dir, dirent.name);
        const relPath = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');

        if (dirent.name.toLowerCase().includes(lowerQuery)) {
          const stat = fs.statSync(fullPath);
          results.push({
            name: dirent.name,
            path: fullPath,
            relativePath: relPath,
            isDirectory: dirent.isDirectory(),
            size: stat.size,
            modifiedTime: stat.mtimeMs,
            extension: dirent.isDirectory() ? undefined : path.extname(dirent.name).toLowerCase(),
          });
        }

        if (dirent.isDirectory()) {
          scan(fullPath);
        }
      }
    };

    scan(workspaceRoot);
    return results;
  }

  private isTextBuffer(buf: Buffer): boolean {
    const max = Math.min(buf.length, 512);
    for (let i = 0; i < max; i++) {
      if (buf[i] === 0) return false;
    }
    return true;
  }
}

export const fileSystemManager = new FileSystemManager();
