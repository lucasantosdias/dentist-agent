import { getEnv } from "@/config/env";
import { createLlmInterpreter } from "@/modules/ai/infrastructure/createLlmInterpreter";
import { createResponseGenerator } from "@/modules/ai/infrastructure/createResponseGenerator";
import { PrismaCatalogRepository } from "@/modules/catalog/infrastructure/PrismaCatalogRepository";
import { GetCatalogSnapshotUseCase } from "@/modules/catalog/application/usecases/GetCatalogSnapshotUseCase";
import { PrismaClinicSettingsRepository } from "@/modules/clinic/infrastructure/PrismaClinicSettingsRepository";
import { ConversationOrchestrator } from "@/modules/conversations/application/usecases/ConversationOrchestrator";
import { PrismaConversationRepository } from "@/modules/conversations/infrastructure/PrismaConversationRepository";
import { PrismaMessageRepository } from "@/modules/conversations/infrastructure/PrismaMessageRepository";
import { PrismaProcessedInboundRepository } from "@/modules/conversations/infrastructure/PrismaProcessedInboundRepository";
import { PrismaOutboxRepository } from "@/modules/integration/infrastructure/PrismaOutboxRepository";
import { PrismaKnowledgeRepository } from "@/modules/knowledge/infrastructure/PrismaKnowledgeRepository";
import { PrismaPatientRepository } from "@/modules/patients/infrastructure/PrismaPatientRepository";
import { CancelAppointmentUseCase } from "@/modules/scheduling/application/usecases/CancelAppointmentUseCase";
import { ConfirmAppointmentUseCase } from "@/modules/scheduling/application/usecases/ConfirmAppointmentUseCase";
import { ConfirmPresenceUseCase } from "@/modules/scheduling/application/usecases/ConfirmPresenceUseCase";
import { CreateHoldUseCase } from "@/modules/scheduling/application/usecases/CreateHoldUseCase";
import { HandleSchedulingIntentUseCase } from "@/modules/scheduling/application/usecases/HandleSchedulingIntentUseCase";
import { ProposeSlotsUseCase } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import { StartSchedulingUseCase } from "@/modules/scheduling/application/usecases/StartSchedulingUseCase";
import { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import { PrismaAppointmentRepository } from "@/modules/scheduling/infrastructure/PrismaAppointmentRepository";
import { PrismaSchedulingAvailability } from "@/modules/scheduling/infrastructure/PrismaSchedulingAvailability";
import { PrismaSlotHoldRepository } from "@/modules/scheduling/infrastructure/PrismaSlotHoldRepository";
import { prisma } from "@/server/db/prisma";

// New imports for availability and calendar integration
import { PrismaAvailabilityRuleRepository } from "@/modules/scheduling/infrastructure/PrismaAvailabilityRuleRepository";
import { PrismaAvailabilityExceptionRepository } from "@/modules/scheduling/infrastructure/PrismaAvailabilityExceptionRepository";
import { PrismaCalendarConnectionRepository } from "@/modules/integration/infrastructure/PrismaCalendarConnectionRepository";
import { PrismaCalendarWatchChannelRepository } from "@/modules/integration/infrastructure/PrismaCalendarWatchChannelRepository";
import { PrismaCalendarSyncStateRepository } from "@/modules/integration/infrastructure/PrismaCalendarSyncStateRepository";
import { GoogleCalendarAdapter } from "@/modules/integration/infrastructure/GoogleCalendarAdapter";
import { CreateAvailabilityRuleUseCase } from "@/modules/scheduling/application/usecases/CreateAvailabilityRuleUseCase";
import { CreateAvailabilityExceptionUseCase } from "@/modules/scheduling/application/usecases/CreateAvailabilityExceptionUseCase";
import { GenerateAvailableSlotsUseCase } from "@/modules/scheduling/application/usecases/GenerateAvailableSlotsUseCase";
import { ConnectGoogleCalendarUseCase } from "@/modules/integration/application/usecases/ConnectGoogleCalendarUseCase";
import { CheckGoogleCalendarFreeBusyUseCase } from "@/modules/integration/application/usecases/CheckGoogleCalendarFreeBusyUseCase";
import { RunCalendarIncrementalSyncUseCase } from "@/modules/integration/application/usecases/RunCalendarIncrementalSyncUseCase";
import { ProcessCalendarWebhookUseCase } from "@/modules/integration/application/usecases/ProcessCalendarWebhookUseCase";
import { ProcessCalendarOutboxUseCase } from "@/modules/integration/application/usecases/ProcessCalendarOutboxUseCase";

export type AppContainer = {
  conversationOrchestrator: ConversationOrchestrator;
  // Scheduling — availability
  createAvailabilityRuleUseCase: CreateAvailabilityRuleUseCase;
  createAvailabilityExceptionUseCase: CreateAvailabilityExceptionUseCase;
  generateAvailableSlotsUseCase: GenerateAvailableSlotsUseCase;
  // Integration — Google Calendar (null if not configured)
  connectGoogleCalendarUseCase: ConnectGoogleCalendarUseCase | null;
  checkGoogleCalendarFreeBusyUseCase: CheckGoogleCalendarFreeBusyUseCase | null;
  runCalendarIncrementalSyncUseCase: RunCalendarIncrementalSyncUseCase | null;
  processCalendarWebhookUseCase: ProcessCalendarWebhookUseCase | null;
  processCalendarOutboxUseCase: ProcessCalendarOutboxUseCase | null;
};

let cachedContainer: AppContainer | null = null;

export function getContainer(): AppContainer {
  if (cachedContainer) {
    return cachedContainer;
  }

  const env = getEnv();

  const patientRepository = new PrismaPatientRepository(prisma);
  const conversationRepository = new PrismaConversationRepository(prisma);
  const messageRepository = new PrismaMessageRepository(prisma);
  const processedInboundRepository = new PrismaProcessedInboundRepository(prisma);

  const catalogRepository = new PrismaCatalogRepository(prisma);

  const appointmentRepository = new PrismaAppointmentRepository(prisma);
  const slotHoldRepository = new PrismaSlotHoldRepository(prisma);
  const availabilityRepository = new PrismaSchedulingAvailability(prisma, env.APP_UTC_OFFSET_MINUTES);

  const outboxRepository = new PrismaOutboxRepository(prisma);

  // New repositories
  const availabilityRuleRepository = new PrismaAvailabilityRuleRepository(prisma);
  const availabilityExceptionRepository = new PrismaAvailabilityExceptionRepository(prisma);
  const calendarConnectionRepository = new PrismaCalendarConnectionRepository(prisma);
  const calendarWatchChannelRepository = new PrismaCalendarWatchChannelRepository(prisma);
  const calendarSyncStateRepository = new PrismaCalendarSyncStateRepository(prisma);

  const policies = new SchedulingPolicies({
    holdTtlMinutes: env.SCHEDULING_HOLD_TTL_MINUTES,
    stepMinutes: env.SCHEDULING_SLOT_STEP_MINUTES,
    workingHourStart: env.WORKING_HOUR_START,
    workingHourEnd: env.WORKING_HOUR_END,
    timezoneOffsetMinutes: env.APP_UTC_OFFSET_MINUTES,
  });

  // Google Calendar adapter (null if not configured)
  const googleCalendarEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const googleCalendar = googleCalendarEnabled
    ? new GoogleCalendarAdapter({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        webhookBaseUrl: env.GOOGLE_WEBHOOK_BASE_URL,
      })
    : null;

  // Scheduling use cases
  const startSchedulingUseCase = new StartSchedulingUseCase(catalogRepository, policies);
  const proposeSlotsUseCase = new ProposeSlotsUseCase(availabilityRepository, policies);
  const createHoldUseCase = new CreateHoldUseCase(slotHoldRepository, availabilityRepository, policies);
  const confirmAppointmentUseCase = new ConfirmAppointmentUseCase(
    slotHoldRepository,
    appointmentRepository,
    availabilityRepository,
    catalogRepository,
    outboxRepository,
  );

  const handleSchedulingIntentUseCase = new HandleSchedulingIntentUseCase(
    catalogRepository,
    startSchedulingUseCase,
    proposeSlotsUseCase,
    createHoldUseCase,
    confirmAppointmentUseCase,
    policies,
  );

  const cancelAppointmentUseCase = new CancelAppointmentUseCase(
    appointmentRepository,
    catalogRepository,
    outboxRepository,
  );

  const confirmPresenceUseCase = new ConfirmPresenceUseCase(appointmentRepository, catalogRepository);

  // New availability use cases
  const createAvailabilityRuleUseCase = new CreateAvailabilityRuleUseCase(
    availabilityRuleRepository,
    catalogRepository,
  );

  const createAvailabilityExceptionUseCase = new CreateAvailabilityExceptionUseCase(
    availabilityExceptionRepository,
    catalogRepository,
  );

  const generateAvailableSlotsUseCase = new GenerateAvailableSlotsUseCase(
    catalogRepository,
    availabilityRuleRepository,
    availabilityExceptionRepository,
    availabilityRepository,
    calendarConnectionRepository,
    googleCalendar,
    env.APP_UTC_OFFSET_MINUTES,
  );

  // Google Calendar integration use cases (only if configured)
  let connectGoogleCalendarUseCase: ConnectGoogleCalendarUseCase | null = null;
  let checkGoogleCalendarFreeBusyUseCase: CheckGoogleCalendarFreeBusyUseCase | null = null;
  let runCalendarIncrementalSyncUseCase: RunCalendarIncrementalSyncUseCase | null = null;
  let processCalendarWebhookUseCase: ProcessCalendarWebhookUseCase | null = null;
  let processCalendarOutboxUseCase: ProcessCalendarOutboxUseCase | null = null;

  if (googleCalendar) {
    connectGoogleCalendarUseCase = new ConnectGoogleCalendarUseCase(
      catalogRepository,
      calendarConnectionRepository,
      googleCalendar,
      calendarWatchChannelRepository,
      calendarSyncStateRepository,
      env.GOOGLE_WEBHOOK_BASE_URL,
    );

    checkGoogleCalendarFreeBusyUseCase = new CheckGoogleCalendarFreeBusyUseCase(
      calendarConnectionRepository,
      googleCalendar,
    );

    runCalendarIncrementalSyncUseCase = new RunCalendarIncrementalSyncUseCase(
      calendarConnectionRepository,
      calendarSyncStateRepository,
      googleCalendar,
      availabilityExceptionRepository,
      availabilityRuleRepository,
      env.APP_UTC_OFFSET_MINUTES,
    );

    processCalendarWebhookUseCase = new ProcessCalendarWebhookUseCase(
      calendarWatchChannelRepository,
      runCalendarIncrementalSyncUseCase,
    );

    processCalendarOutboxUseCase = new ProcessCalendarOutboxUseCase(
      outboxRepository,
      calendarConnectionRepository,
      googleCalendar,
      prisma,
      env.APP_TIMEZONE,
    );
  }

  // Clinic settings
  const clinicSettingsRepository = new PrismaClinicSettingsRepository(prisma);

  // Knowledge retrieval (RAG v1 — text-based, no embeddings)
  const knowledgeRepository = new PrismaKnowledgeRepository(prisma);

  // LLM: classification + response generation
  const responseGenerator = createResponseGenerator({
    provider: env.LLM_PROVIDER,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    ollamaModel: env.OLLAMA_MODEL,
  });

  const llmInterpreter = createLlmInterpreter({
    provider: env.LLM_PROVIDER,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    ollamaModel: env.OLLAMA_MODEL,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL,
    openAiBaseUrl: env.OPENAI_BASE_URL,
  });

  const getCatalogSnapshotUseCase = new GetCatalogSnapshotUseCase(catalogRepository);

  const conversationOrchestrator = new ConversationOrchestrator(
    processedInboundRepository,
    patientRepository,
    conversationRepository,
    messageRepository,
    llmInterpreter,
    { execute: (clinicId: string) => getCatalogSnapshotUseCase.execute(clinicId) },
    {
      execute: (input) => handleSchedulingIntentUseCase.execute({
        clinic_id: input.clinic_id,
        patient_id: input.patient_id,
        conversation_id: input.conversation_id,
        patient_known_name: input.patient_known_name,
        interpretation: input.interpretation,
        now: input.now,
      }),
    },
    {
      execute: (input) => cancelAppointmentUseCase.execute({
        patient_id: input.patient_id,
        requested_datetime_iso: input.requested_datetime_iso,
        reason: input.reason,
        now: input.now,
      }),
    },
    {
      execute: (input) => confirmPresenceUseCase.execute({
        patient_id: input.patient_id,
        requested_datetime_iso: input.requested_datetime_iso,
        now: input.now,
      }),
    },
    env.APP_TIMEZONE,
    env.MESSAGE_CONTEXT_LIMIT,
    clinicSettingsRepository,
    responseGenerator,
    knowledgeRepository,
  );

  cachedContainer = {
    conversationOrchestrator,
    createAvailabilityRuleUseCase,
    createAvailabilityExceptionUseCase,
    generateAvailableSlotsUseCase,
    connectGoogleCalendarUseCase,
    checkGoogleCalendarFreeBusyUseCase,
    runCalendarIncrementalSyncUseCase,
    processCalendarWebhookUseCase,
    processCalendarOutboxUseCase,
  };

  return cachedContainer;
}
