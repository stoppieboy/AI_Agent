import { forget, remember } from "../memory/longterm.js";

export const save_to_memory = {
    type: "function" as const,
    function: {
        name: "save_to_memory",
        description: "Save a key-value pair to long-term memory",
        parameters: {
            type: "object",
            properties: {
                key: { type: "string", description: "Memory key" },
                value: { type: "string", description: "Memory value" }
            },
            required: ["key", "value"]
        },
    }
}

export const remove_from_memory = {
    type: "function" as const,
    function: {
        name: "remove_from_memory",
        description: "Remove a key (and its value) from long-term memory",
        parameters: {
            type: "object",
            properties: {
                key: { type: "string", description: "Memory key to remove" },
            },
            required: ["key"]
        }
    }
}

export async function saveToMemory(key: string, value: string): Promise<string> {
  remember(key, value);
  return `Saved "${key}" to memory.`;
}

export async function removeFromMemory(key: string): Promise<string> {
  forget(key);
  return `Removed "${key}" from memory.`;
}