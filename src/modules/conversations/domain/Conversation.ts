import type { LlmIntent } from "@/modules/ai/application/dto/LlmInterpretation";
import type { ConversationState } from "@/modules/conversations/domain/ConversationState";
import type { CollectedData } from "@/modules/conversations/domain/services/RequirementResolver";

export type ConversationProps = {
  id: string;
  clinicId: string;
  patientId: string;
  channel: string;
  state: ConversationState;
  attempts: number;
  currentIntent: string | null;
  collectedData: CollectedData;
  missingRequirements: string[];
  currentFunnelStep: string | null;
  lastMessageAt: Date | null;
};

export class Conversation {
  constructor(private props: ConversationProps) {}

  get id(): string {
    return this.props.id;
  }

  get clinicId(): string {
    return this.props.clinicId;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get channel(): string {
    return this.props.channel;
  }

  get state(): ConversationState {
    return this.props.state;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get currentIntent(): string | null {
    return this.props.currentIntent;
  }

  get collectedData(): CollectedData {
    return this.props.collectedData;
  }

  get missingRequirements(): string[] {
    return this.props.missingRequirements;
  }

  get currentFunnelStep(): string | null {
    return this.props.currentFunnelStep;
  }

  get lastMessageAt(): Date | null {
    return this.props.lastMessageAt;
  }

  transition(nextState: ConversationState): void {
    if (this.props.state === "FINALIZADA" && nextState !== "FINALIZADA") {
      throw new Error("FINALIZADA conversation cannot return to active states");
    }
    this.props.state = nextState;
  }

  setCurrentIntent(intent: LlmIntent): void {
    this.props.currentIntent = intent;
  }

  setCollectedData(data: CollectedData): void {
    this.props.collectedData = data;
  }

  setMissingRequirements(missing: string[]): void {
    this.props.missingRequirements = missing;
  }

  setCurrentFunnelStep(step: string): void {
    this.props.currentFunnelStep = step;
  }

  touchMessage(): void {
    this.props.lastMessageAt = new Date();
    this.props.attempts += 1;
  }

  resetContext(): void {
    this.props.currentIntent = null;
    this.props.collectedData = {};
    this.props.missingRequirements = [];
    this.props.currentFunnelStep = null;
  }

  toPrimitives(): ConversationProps {
    return { ...this.props };
  }
}
