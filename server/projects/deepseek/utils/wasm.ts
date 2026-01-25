import { readFileSync } from 'node:fs';

let wasmModule: WebAssembly.Module | null = null;

export function compute_pow_answer(
    algorithm: string,
    challenge_str: string,
    salt: string,
    difficulty: number,
    expire_at: number,
    signature: string,
    target_path: string,
    wasm_path: string
): number | null {
    if (algorithm !== 'DeepSeekHashV1')
        throw new Error(`Unsupported PoW algorithm: ${algorithm}`);

    const prefix = `${salt}_${expire_at}_`;

    if (!wasmModule) {
        try {
            const wasmBuffer = readFileSync(wasm_path);
            wasmModule = new WebAssembly.Module(wasmBuffer);
        } catch (e) {
            throw new Error(`Failed to load WASM from ${wasm_path}: ${e}`);
        }
    }

    let instance: WebAssembly.Instance;
    try {
        instance = new WebAssembly.Instance(wasmModule, {});
    } catch (e) {
        throw new Error(`Failed to instantiate WASM: ${e}`);
    }

    const exports = instance.exports as any;
    const memory = exports.memory as WebAssembly.Memory;
    const add_to_stack = exports.__wbindgen_add_to_stack_pointer;
    const alloc = exports.__wbindgen_export_0;
    const wasm_solve = exports.wasm_solve;

    if (!memory || !add_to_stack || !alloc || !wasm_solve) {
        throw new Error('Missing expected WASM exports (memory, __wbindgen_add_to_stack_pointer, __wbindgen_export_0, wasm_solve)');
    }

    const encodeString = (text: string) => {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        const len = bytes.length;
        const ptr = alloc(len, 1);
        const mem = new Uint8Array(memory.buffer);
        mem.set(bytes, ptr);
        return { ptr, len };
    };

    const retptr = add_to_stack(-16);
    try {
        const { ptr: ptr_challenge, len: len_challenge } = encodeString(challenge_str);
        const { ptr: ptr_prefix, len: len_prefix } = encodeString(prefix);

        wasm_solve(retptr, ptr_challenge, len_challenge, ptr_prefix, len_prefix, difficulty);

        const view = new DataView(memory.buffer);
        // Little-endian
        const status = view.getInt32(retptr, true);
        const value = view.getFloat64(retptr + 8, true);

        if (status === 0) {
            return null;
        }
        return Math.floor(value);
    } finally {
        add_to_stack(16);
    }
}
