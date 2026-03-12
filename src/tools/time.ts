export const get_time = {
  type: 'function' as const,
  function: {
    name: 'get_time',
    description: 'Get current date and time in ISO format',
    parameters: { type: 'object', properties: {}, required: [] }
  }
};

export async function run_get_time(): Promise<string> {
  return new Date().toISOString();
}

