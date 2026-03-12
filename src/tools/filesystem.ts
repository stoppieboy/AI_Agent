import { promises as fs } from 'fs';
export const read_file = {
  type: 'function' as const,
  function: {
    name: 'read_file',
    description: 'Read a UTF-8 text file from disk',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute or relative path' } },
      required: ['path']
    }
  }
};

export const create_file = {
  type: 'function' as const,
  function: {
    name: 'create_file',
    description: 'Create a UTF-8 file on disk',
    parameters: {
      type: 'object',
      properties: { 
        path: { 
          type: 'string', 
          description: 'Absolute or relative path' 
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
  const content = await fs.readFile(args.path, 'utf8');
  return content.slice(0, 50_000); // guardrails
}

export async function run_create_file(args: { path: string, content: string }) {
  await fs.writeFile(args.path, args.content, 'utf8');
  return `File ${args.path} created/overwritten successfully.`;
}
