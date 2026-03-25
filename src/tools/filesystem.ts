import { promises as fs } from 'fs';
import path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd());

function resolveSafe(p: string): string {
  const resolved = path.resolve(p);
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(WORKSPACE_ROOT + path.sep)) {
    throw new Error('Access denied: path must be within the workspace directory');
  }
  return resolved;
}

export const read_file = {
  type: 'function' as const,
  function: {
    name: 'read_file',
    description: 'Read a UTF-8 text file from disk (workspace directory only)',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path within the workspace' } },
      required: ['path']
    }
  }
};

export const create_file = {
  type: 'function' as const,
  function: {
    name: 'create_file',
    description: 'Create a UTF-8 file on disk (workspace directory only)',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path within the workspace'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  }
};

export async function run_read_file(args: { path: string }) {
  const safe = resolveSafe(args.path);
  const content = await fs.readFile(safe, 'utf8');
  return content.slice(0, 50_000);
}

export async function run_create_file(args: { path: string; content: string }) {
  const safe = resolveSafe(args.path);
  await fs.mkdir(path.dirname(safe), { recursive: true });
  await fs.writeFile(safe, args.content, 'utf8');
  return `File ${args.path} created/overwritten successfully.`;
}
