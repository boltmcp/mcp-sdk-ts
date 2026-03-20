/**
 * Cloudflare Worker-compatible JSON Schema validator provider
 *
 * This provider uses @cfworker/json-schema for validation without code generation,
 * making it compatible with edge runtimes like Cloudflare Workers that restrict
 * eval and new Function.
 *
 * @see {@linkcode AjvJsonSchemaValidator} for the Node.js alternative
 */

import type { JsonSchemaType, JsonSchemaValidator, jsonSchemaValidator, JsonSchemaValidatorResult } from './types.js';

let _Validator: typeof import('@cfworker/json-schema').Validator | undefined;
try {
    ({ Validator: _Validator } = await import('@cfworker/json-schema'));
} catch {
    // Optional dependency not installed — expected in Node.js environments
    // where AjvJsonSchemaValidator is used instead.
}

/**
 * JSON Schema draft version supported by @cfworker/json-schema
 */
export type CfWorkerSchemaDraft = '4' | '7' | '2019-09' | '2020-12';

/**
 *
 * @example Use with default configuration (2020-12, shortcircuit)
 * ```ts source="./cfWorkerProvider.examples.ts#CfWorkerJsonSchemaValidator_default"
 * const validator = new CfWorkerJsonSchemaValidator();
 * ```
 *
 * @example Use with custom configuration
 * ```ts source="./cfWorkerProvider.examples.ts#CfWorkerJsonSchemaValidator_customConfig"
 * const validator = new CfWorkerJsonSchemaValidator({
 *     draft: '2020-12',
 *     shortcircuit: false // Report all errors
 * });
 * ```
 */
export class CfWorkerJsonSchemaValidator implements jsonSchemaValidator {
    private shortcircuit: boolean;
    private draft: CfWorkerSchemaDraft;

    /**
     * Create a validator
     *
     * @param options - Configuration options
     * @param options.shortcircuit - If `true`, stop validation after first error (default: `true`)
     * @param options.draft - JSON Schema draft version to use (default: `'2020-12'`)
     */
    constructor(options?: { shortcircuit?: boolean; draft?: CfWorkerSchemaDraft }) {
        this.shortcircuit = options?.shortcircuit ?? true;
        this.draft = options?.draft ?? '2020-12';
    }

    /**
     * Create a validator for the given JSON Schema
     *
     * Unlike AJV, this validator is not cached internally
     *
     * @param schema - Standard JSON Schema object
     * @returns A validator function that validates input data
     */
    getValidator<T>(schema: JsonSchemaType): JsonSchemaValidator<T> {
        if (!_Validator) {
            throw new Error(
                '@cfworker/json-schema is not installed. Install it to use CfWorkerJsonSchemaValidator, '
                + 'or use AjvJsonSchemaValidator for Node.js environments.'
            );
        }
        // Cast to the cfworker Schema type - our JsonSchemaType is structurally compatible
        const ValidatorCtor = _Validator;
        const validator = new ValidatorCtor(schema as ConstructorParameters<typeof ValidatorCtor>[0], this.draft, this.shortcircuit);

        return (input: unknown): JsonSchemaValidatorResult<T> => {
            const result = validator.validate(input);

            return result.valid
                ? {
                      valid: true,
                      data: input as T,
                      errorMessage: undefined
                  }
                : {
                      valid: false,
                      data: undefined,
                      errorMessage: result.errors.map(err => `${err.instanceLocation}: ${err.error}`).join('; ')
                  };
        };
    }
}
