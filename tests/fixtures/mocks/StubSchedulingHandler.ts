import type {
  SchedulingIntentHandlerPort,
  SchedulingIntentInput,
  SchedulingIntentResult,
  CancellationHandlerPort,
  CancellationInput,
  CancellationResult,
  ConfirmPresenceHandlerPort,
  ConfirmPresenceInput,
  ConfirmPresenceResult,
  CatalogSnapshotPort,
  CatalogSnapshot,
} from "@/modules/conversations/application/ports/IntentHandlerPorts";
import { defaultCatalog } from "../catalog";

export class StubSchedulingHandler implements SchedulingIntentHandlerPort {
  public lastInput: SchedulingIntentInput | null = null;
  public result: SchedulingIntentResult = {
    reply_text: "Reservei o horário para você. Responda CONFIRMO para finalizar.",
    conversation_state: "WAITING",
  };

  async execute(input: SchedulingIntentInput): Promise<SchedulingIntentResult> {
    this.lastInput = input;
    return this.result;
  }

  setResult(result: SchedulingIntentResult): void {
    this.result = result;
  }
}

export class StubCancellationHandler implements CancellationHandlerPort {
  public lastInput: CancellationInput | null = null;
  public result: CancellationResult = { kind: "NO_APPOINTMENTS" };

  async execute(input: CancellationInput): Promise<CancellationResult> {
    this.lastInput = input;
    return this.result;
  }
}

export class StubConfirmPresenceHandler implements ConfirmPresenceHandlerPort {
  public lastInput: ConfirmPresenceInput | null = null;
  public result: ConfirmPresenceResult = { kind: "NO_APPOINTMENTS" };

  async execute(input: ConfirmPresenceInput): Promise<ConfirmPresenceResult> {
    this.lastInput = input;
    return this.result;
  }
}

export class StubCatalogSnapshot implements CatalogSnapshotPort {
  private catalogByClinic: Map<string, CatalogSnapshot> = new Map();

  constructor() {
    // Default catalog for all clinics
    this.catalogByClinic.set("default", defaultCatalog);
  }

  async execute(clinicId: string): Promise<CatalogSnapshot> {
    return this.catalogByClinic.get(clinicId) ?? this.catalogByClinic.get("default")!;
  }

  setCatalogForClinic(clinicId: string, catalog: CatalogSnapshot): void {
    this.catalogByClinic.set(clinicId, catalog);
  }
}
