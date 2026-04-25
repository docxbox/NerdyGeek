import { validate } from "./validation.js";
export async function withRetry(fn, retries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const result = await fn();
            return validate(result);
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Unknown retry failure");
}
