/**
 * Port for LLM-based response generation.
 *
 * This is SEPARATE from LlmInterpreterPort (classification/extraction).
 * The interpreter reads the user's message. The generator writes the bot's reply.
 *
 * The generator receives a ResponseDirective — structured context from the
 * backend — and produces a natural, human-like response. It NEVER decides
 * business logic — it only decides wording.
 *
 * Facts are authoritative. The LLM must use ALL required facts and must NOT
 * invent additional ones.
 */

import type { ResponseDirective } from "@/modules/conversations/domain/ResponseDirective";

export type { ResponseDirective };

export interface ResponseGeneratorPort {
  generate(directive: ResponseDirective): Promise<string>;
}
