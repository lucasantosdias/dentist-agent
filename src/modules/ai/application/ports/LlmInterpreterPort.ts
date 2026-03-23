import type {
  LlmInterpretation,
  LlmInterpretationInput,
} from "@/modules/ai/application/dto/LlmInterpretation";

export interface LlmInterpreterPort {
  interpret(input: LlmInterpretationInput): Promise<LlmInterpretation>;
}
