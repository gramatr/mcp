/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/responses/*.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-24T06:29:46.353Z
 */
import { z } from 'zod';
/** Response shape for GET /api/v1/orgs/:orgId/brands/:slug — canonical brand entity with structured voice sub-object. metadata field retained for backward compatibility only; new code must use structured fields. */
export const BrandGetResponseSchema = z.object({
    id: z.string().describe("Brand entity UUID"),
    slug: z.string().describe("Brand slug (entity name)"),
    brainVersion: z.number().optional().describe("Studio conflict detection version counter"),
    voice: z.object({
        voiceFingerprint: z.object({
            sample_count: z.number().optional().describe("Number of text samples used to compute this fingerprint"),
            sample_tokens_total: z.number().optional().describe("Total tokens across all samples"),
            style_vector: z.array(z.any()).optional().describe("Embedding-space style vector (model-internal)"),
            tonal_attributes: z.array(z.object({
                attribute: z.string(),
                confidence: z.number()
            })).optional().describe("LLM-extracted tonal qualities with confidence scores"),
            forbidden_phrases: z.array(z.string()).optional().describe("Phrases the brand voice avoids"),
            preferred_constructions: z.array(z.string()).optional().describe("Sentence constructions the brand voice favors"),
            fingerprint_model_version: z.string().optional().describe("Model version that produced this fingerprint"),
            last_fingerprinted_at: z.string().optional().describe("ISO 8601 timestamp of last fingerprint computation"),
            stylistic_descriptors: z.object({
                sentence_length_mean: z.number().optional(),
                sentence_length_stddev: z.number().optional(),
                avg_syllables_per_word: z.number().optional(),
                reading_grade: z.number().optional(),
                passive_voice_ratio: z.number().optional(),
                contraction_rate: z.number().optional(),
                em_dash_density: z.number().optional(),
                oxford_comma_preference: z.string().optional().describe("always | never | mixed | unknown"),
                first_person_ratio: z.number().optional(),
                hedging_phrase_inventory: z.array(z.string()).optional(),
                signature_phrases: z.array(z.string()).optional()
            }).optional().describe("Quantitative stylometric measurements computed from raw text")
        }).nullable().optional().describe("Computed voice fingerprint. Null if brand has not been fingerprinted yet."),
        voiceGenerationRole: z.string().optional().describe("How the voice fingerprint is used in generation: style_only | full_persona | off"),
        exemplarExcerpts: z.array(z.object({
            text: z.string(),
            label: z.string()
        })).optional().describe("Representative text excerpts used as generation exemplars")
    }).optional().describe("Structured voice identity. Canonical path — do not read from metadata.voice_*"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("Raw entity metadata — backward compatibility only. Deprecated: use structured fields above.")
});
//# sourceMappingURL=rest-api-types.js.map