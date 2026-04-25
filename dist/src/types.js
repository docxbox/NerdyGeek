import { z } from "zod";
export const packageJsonSchema = z
    .object({
    name: z.string().optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional()
})
    .passthrough();
export const lockfileContextSchema = z.object({
    packageJson: packageJsonSchema.optional(),
    goMod: z.string().optional(),
    cargoToml: z.string().optional(),
    requirementsTxt: z.string().optional(),
    gemfileLock: z.string().optional()
});
export const docsModeSchema = z.enum(["quick", "full", "deep"]).default("full");
export const searchDocsRequestSchema = z.object({
    query: z.string().min(3),
    mode: docsModeSchema.optional(),
    packageJson: packageJsonSchema.optional(),
    lockfiles: lockfileContextSchema.optional()
});
export const docsResponseSchema = z.object({
    stack: z.string().min(1),
    version: z.string().min(1),
    answer: z.string().min(1),
    code: z.string().min(1).optional(),
    sources: z.array(z.string().url()).min(1),
    confidence: z.number().min(0).max(1)
});
