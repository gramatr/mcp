/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/responses/*.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-24T06:29:46.353Z
 */
import { z } from 'zod';
/** Response shape for GET /api/v1/orgs/:orgId/brands/:slug — canonical brand entity with structured voice sub-object. metadata field retained for backward compatibility only; new code must use structured fields. */
export declare const BrandGetResponseSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    brainVersion: z.ZodOptional<z.ZodNumber>;
    voice: z.ZodOptional<z.ZodObject<{
        voiceFingerprint: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            sample_count: z.ZodOptional<z.ZodNumber>;
            sample_tokens_total: z.ZodOptional<z.ZodNumber>;
            style_vector: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
            tonal_attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                attribute: z.ZodString;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                attribute: string;
            }, {
                confidence: number;
                attribute: string;
            }>, "many">>;
            forbidden_phrases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            preferred_constructions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            fingerprint_model_version: z.ZodOptional<z.ZodString>;
            last_fingerprinted_at: z.ZodOptional<z.ZodString>;
            stylistic_descriptors: z.ZodOptional<z.ZodObject<{
                sentence_length_mean: z.ZodOptional<z.ZodNumber>;
                sentence_length_stddev: z.ZodOptional<z.ZodNumber>;
                avg_syllables_per_word: z.ZodOptional<z.ZodNumber>;
                reading_grade: z.ZodOptional<z.ZodNumber>;
                passive_voice_ratio: z.ZodOptional<z.ZodNumber>;
                contraction_rate: z.ZodOptional<z.ZodNumber>;
                em_dash_density: z.ZodOptional<z.ZodNumber>;
                oxford_comma_preference: z.ZodOptional<z.ZodString>;
                first_person_ratio: z.ZodOptional<z.ZodNumber>;
                hedging_phrase_inventory: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                signature_phrases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            }, {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            sample_count?: number | undefined;
            sample_tokens_total?: number | undefined;
            style_vector?: any[] | undefined;
            tonal_attributes?: {
                confidence: number;
                attribute: string;
            }[] | undefined;
            forbidden_phrases?: string[] | undefined;
            preferred_constructions?: string[] | undefined;
            fingerprint_model_version?: string | undefined;
            last_fingerprinted_at?: string | undefined;
            stylistic_descriptors?: {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            } | undefined;
        }, {
            sample_count?: number | undefined;
            sample_tokens_total?: number | undefined;
            style_vector?: any[] | undefined;
            tonal_attributes?: {
                confidence: number;
                attribute: string;
            }[] | undefined;
            forbidden_phrases?: string[] | undefined;
            preferred_constructions?: string[] | undefined;
            fingerprint_model_version?: string | undefined;
            last_fingerprinted_at?: string | undefined;
            stylistic_descriptors?: {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            } | undefined;
        }>>>;
        voiceGenerationRole: z.ZodOptional<z.ZodString>;
        exemplarExcerpts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            text: z.ZodString;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            label: string;
        }, {
            text: string;
            label: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        voiceFingerprint?: {
            sample_count?: number | undefined;
            sample_tokens_total?: number | undefined;
            style_vector?: any[] | undefined;
            tonal_attributes?: {
                confidence: number;
                attribute: string;
            }[] | undefined;
            forbidden_phrases?: string[] | undefined;
            preferred_constructions?: string[] | undefined;
            fingerprint_model_version?: string | undefined;
            last_fingerprinted_at?: string | undefined;
            stylistic_descriptors?: {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            } | undefined;
        } | null | undefined;
        voiceGenerationRole?: string | undefined;
        exemplarExcerpts?: {
            text: string;
            label: string;
        }[] | undefined;
    }, {
        voiceFingerprint?: {
            sample_count?: number | undefined;
            sample_tokens_total?: number | undefined;
            style_vector?: any[] | undefined;
            tonal_attributes?: {
                confidence: number;
                attribute: string;
            }[] | undefined;
            forbidden_phrases?: string[] | undefined;
            preferred_constructions?: string[] | undefined;
            fingerprint_model_version?: string | undefined;
            last_fingerprinted_at?: string | undefined;
            stylistic_descriptors?: {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            } | undefined;
        } | null | undefined;
        voiceGenerationRole?: string | undefined;
        exemplarExcerpts?: {
            text: string;
            label: string;
        }[] | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    slug: string;
    id: string;
    metadata?: Record<string, unknown> | undefined;
    voice?: {
        voiceFingerprint?: {
            sample_count?: number | undefined;
            sample_tokens_total?: number | undefined;
            style_vector?: any[] | undefined;
            tonal_attributes?: {
                confidence: number;
                attribute: string;
            }[] | undefined;
            forbidden_phrases?: string[] | undefined;
            preferred_constructions?: string[] | undefined;
            fingerprint_model_version?: string | undefined;
            last_fingerprinted_at?: string | undefined;
            stylistic_descriptors?: {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            } | undefined;
        } | null | undefined;
        voiceGenerationRole?: string | undefined;
        exemplarExcerpts?: {
            text: string;
            label: string;
        }[] | undefined;
    } | undefined;
    brainVersion?: number | undefined;
}, {
    slug: string;
    id: string;
    metadata?: Record<string, unknown> | undefined;
    voice?: {
        voiceFingerprint?: {
            sample_count?: number | undefined;
            sample_tokens_total?: number | undefined;
            style_vector?: any[] | undefined;
            tonal_attributes?: {
                confidence: number;
                attribute: string;
            }[] | undefined;
            forbidden_phrases?: string[] | undefined;
            preferred_constructions?: string[] | undefined;
            fingerprint_model_version?: string | undefined;
            last_fingerprinted_at?: string | undefined;
            stylistic_descriptors?: {
                sentence_length_mean?: number | undefined;
                sentence_length_stddev?: number | undefined;
                avg_syllables_per_word?: number | undefined;
                reading_grade?: number | undefined;
                passive_voice_ratio?: number | undefined;
                contraction_rate?: number | undefined;
                em_dash_density?: number | undefined;
                oxford_comma_preference?: string | undefined;
                first_person_ratio?: number | undefined;
                hedging_phrase_inventory?: string[] | undefined;
                signature_phrases?: string[] | undefined;
            } | undefined;
        } | null | undefined;
        voiceGenerationRole?: string | undefined;
        exemplarExcerpts?: {
            text: string;
            label: string;
        }[] | undefined;
    } | undefined;
    brainVersion?: number | undefined;
}>;
export type BrandGetResponse = z.infer<typeof BrandGetResponseSchema>;
//# sourceMappingURL=rest-api-types.d.ts.map