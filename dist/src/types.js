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
export const searchDocsRequestSchema = z.object({
    query: z.string().min(3),
    packageJson: packageJsonSchema.optional()
});
export const docsResponseSchema = z.object({
    stack: z.string().min(1),
    version: z.string().min(1),
    answer: z.string().min(20),
    code: z.string().min(1).optional(),
    sources: z.array(z.string().url()).min(1),
    confidence: z.number().min(0).max(1)
});
