/**
 * Port for LLM-based response generation.
 *
 * This is SEPARATE from LlmInterpreterPort (classification/extraction).
 * The interpreter reads the user's message. The generator writes the bot's reply.
 *
 * The generator receives structured facts from the backend and produces
 * natural, human-like responses. It NEVER decides business logic — it only
 * decides wording.
 *
 * Facts are authoritative. The LLM must use ALL required facts and must NOT
 * invent additional ones.
 */

export type ResponseGenerationInput = {
  /** What the bot needs to communicate (backend-decided) */
  facts: string[];
  /** What the bot must NOT say */
  constraints?: string[];
  /** Tone setting from clinic config */
  tone: string;
  /** Bot personality name */
  botName: string;
  /** Clinic display name */
  clinicName: string;
  /** The user's original message (for context) */
  userMessage: string;
  /** Whether this is the first turn of the conversation */
  isFirstTurn?: boolean;
  /** Conversational signals detected */
  signals?: {
    hasGreeting?: boolean;
    greetingType?: string | null;
    hasConcern?: boolean;
    hasServiceMention?: boolean;
    mentionedServiceName?: string | null;
  };
};

export interface ResponseGeneratorPort {
  generate(input: ResponseGenerationInput): Promise<string>;
}
