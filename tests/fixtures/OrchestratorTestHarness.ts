import { ConversationOrchestrator } from "@/modules/conversations/application/usecases/ConversationOrchestrator";
import { MockLlmInterpreter } from "@/modules/ai/infrastructure/MockLlmInterpreter";
import type { ProcessedInboundResponse } from "@/modules/conversations/application/ports/ProcessedInboundRepositoryPort";
import type { InboundMessageCommand } from "@/modules/conversations/application/dto/InboundMessageCommand";
import { InMemoryPatientRepository } from "./mocks/InMemoryPatientRepository";
import { InMemoryConversationRepository } from "./mocks/InMemoryConversationRepository";
import { InMemoryMessageRepository } from "./mocks/InMemoryMessageRepository";
import { InMemoryProcessedInboundRepository } from "./mocks/InMemoryProcessedInboundRepository";
import { InMemoryClinicSettingsRepository } from "./mocks/InMemoryClinicSettingsRepository";
import { InMemoryKnowledgeRepository } from "./mocks/InMemoryKnowledgeRepository";
import {
  StubSchedulingHandler,
  StubCancellationHandler,
  StubConfirmPresenceHandler,
  StubCatalogSnapshot,
} from "./mocks/StubSchedulingHandler";
import { CLINIC_A_ID } from "./catalog";
import { randomUUID } from "crypto";

export class OrchestratorTestHarness {
  public readonly patientRepo: InMemoryPatientRepository;
  public readonly conversationRepo: InMemoryConversationRepository;
  public readonly messageRepo: InMemoryMessageRepository;
  public readonly processedInboundRepo: InMemoryProcessedInboundRepository;
  public readonly clinicSettingsRepo: InMemoryClinicSettingsRepository;
  public readonly knowledgeRepo: InMemoryKnowledgeRepository;
  public readonly llmInterpreter: MockLlmInterpreter;
  public readonly catalogSnapshot: StubCatalogSnapshot;
  public readonly schedulingHandler: StubSchedulingHandler;
  public readonly cancellationHandler: StubCancellationHandler;
  public readonly confirmPresenceHandler: StubConfirmPresenceHandler;
  public readonly orchestrator: ConversationOrchestrator;

  private messageCounter = 0;

  constructor(
    public readonly clinicId: string = CLINIC_A_ID,
    public readonly externalUserId: string = "test-user-" + randomUUID().slice(0, 8),
  ) {
    this.patientRepo = new InMemoryPatientRepository();
    this.conversationRepo = new InMemoryConversationRepository();
    this.messageRepo = new InMemoryMessageRepository();
    this.processedInboundRepo = new InMemoryProcessedInboundRepository();
    this.clinicSettingsRepo = new InMemoryClinicSettingsRepository();
    this.knowledgeRepo = new InMemoryKnowledgeRepository();
    this.llmInterpreter = new MockLlmInterpreter();
    this.catalogSnapshot = new StubCatalogSnapshot();
    this.schedulingHandler = new StubSchedulingHandler();
    this.cancellationHandler = new StubCancellationHandler();
    this.confirmPresenceHandler = new StubConfirmPresenceHandler();

    this.orchestrator = new ConversationOrchestrator(
      this.processedInboundRepo,
      this.patientRepo,
      this.conversationRepo,
      this.messageRepo,
      this.llmInterpreter,
      this.catalogSnapshot,
      this.schedulingHandler,
      this.cancellationHandler,
      this.confirmPresenceHandler,
      "America/Sao_Paulo",
      20,
      this.clinicSettingsRepo,
      null, // responseGenerator (not used in tests)
      this.knowledgeRepo,
    );
  }

  async send(text: string, overrides?: Partial<InboundMessageCommand>): Promise<ProcessedInboundResponse> {
    this.messageCounter++;
    const input: InboundMessageCommand = {
      channel: "sim",
      external_user_id: this.externalUserId,
      message_id: `msg-${this.messageCounter}`,
      text,
      ...overrides,
    };
    return this.orchestrator.execute(this.clinicId, input);
  }

  async getLatestConversation() {
    const patients = this.patientRepo.getAll();
    const patient = patients.find(
      (p) => p.externalUserId === this.externalUserId && p.clinicId === this.clinicId,
    );
    if (!patient) return null;
    return this.conversationRepo.findLatestByPatientAndChannel(patient.id, "sim");
  }

  async getPatient() {
    return this.patientRepo.findByChannelAndExternalUser(this.clinicId, "sim", this.externalUserId);
  }

  reset(): void {
    this.patientRepo.clear();
    this.conversationRepo.clear();
    this.messageRepo.clear();
    this.processedInboundRepo.clear();
    this.clinicSettingsRepo.clear();
    this.messageCounter = 0;
  }
}
