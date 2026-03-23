import type { OutboxRepositoryPort } from "@/modules/integration/application/ports/OutboxRepositoryPort";
import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { GoogleCalendarPort } from "@/modules/integration/application/ports/GoogleCalendarPort";
import type { PrismaClient } from "@prisma/client";

export type ProcessOutboxResult = {
  processed: number;
  succeeded: number;
  failed: number;
  details: Array<{ id: string; status: "done" | "failed"; error?: string }>;
};

export class ProcessCalendarOutboxUseCase {
  constructor(
    private readonly outboxRepository: OutboxRepositoryPort,
    private readonly calendarConnectionRepository: CalendarConnectionRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort,
    private readonly prisma: PrismaClient,
    private readonly timezone: string,
  ) {}

  async execute(batchSize = 10): Promise<ProcessOutboxResult> {
    const pending = await this.outboxRepository.findPending(batchSize);
    const result: ProcessOutboxResult = {
      processed: pending.length,
      succeeded: 0,
      failed: 0,
      details: [],
    };

    for (const record of pending) {
      await this.outboxRepository.markProcessing(record.id);

      try {
        let externalEventId: string | undefined;
        if (record.action === "CREATE_EVENT") {
          // Idempotency: if event was already created (e.g. previous attempt
          // succeeded at Google but failed locally), skip creation
          if (record.externalEventId) {
            externalEventId = record.externalEventId;
          } else {
            externalEventId = await this.processCreateEvent(record);
          }
        }
        // TODO: handle UPDATE_EVENT and CANCEL_EVENT

        await this.outboxRepository.markDone(record.id, externalEventId);
        result.succeeded++;
        result.details.push({ id: record.id, status: "done" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await this.outboxRepository.markFailed(record.id, message);
        result.failed++;
        result.details.push({ id: record.id, status: "failed", error: message });
      }
    }

    return result;
  }

  private async processCreateEvent(record: {
    id: string;
    appointmentId: string;
    payloadJson: Record<string, unknown>;
  }): Promise<string | undefined> {
    const payload = record.payloadJson;

    // Find the professional for this appointment
    const appointment = await this.prisma.appointment.findUniqueOrThrow({
      where: { id: record.appointmentId },
      select: { professionalId: true },
    });

    // Get calendar connection
    const connection = await this.calendarConnectionRepository.findByProfessional(
      appointment.professionalId,
    );
    if (!connection) {
      throw new Error("No calendar connection for professional");
    }

    // Refresh token if needed
    let accessToken = connection.accessToken;
    if (connection.isTokenExpired(new Date())) {
      const refreshed = await this.googleCalendar.refreshAccessToken(connection.refreshToken);
      connection.updateTokens(refreshed.accessToken, refreshed.expiresAt);
      await this.calendarConnectionRepository.save(connection);
      accessToken = refreshed.accessToken;
    }

    // Create the calendar event
    const startsAt = payload.starts_at as string;
    const endsAt = payload.ends_at as string;
    const patientName = payload.patient_name as string;
    const serviceName = payload.service_name as string;
    const professionalName = payload.professional_name as string;

    const created = await this.googleCalendar.createEvent(accessToken, {
      calendarId: connection.googleCalendarId,
      summary: `${serviceName} - ${patientName}`,
      description: `Paciente: ${patientName}\nServiço: ${serviceName}\nProfissional: ${professionalName}`,
      start: new Date(startsAt),
      end: new Date(endsAt),
      timezone: this.timezone,
    });

    // Persist event ID immediately so retries won't create duplicates
    await this.prisma.calendarOutbox.update({
      where: { id: record.id },
      data: { externalEventId: created.eventId },
    });

    return created.eventId;
  }
}
