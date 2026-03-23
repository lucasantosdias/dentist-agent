import type { PrismaClient } from "@prisma/client";
import type { ClinicSettingsPort } from "@/modules/clinic/application/ports/ClinicSettingsPort";
import { ClinicSettings } from "@/modules/clinic/domain/ClinicSettings";
import { buildDefaultClinicSettings } from "@/modules/clinic/domain/ClinicSettings";

export class PrismaClinicSettingsRepository implements ClinicSettingsPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findByClinicId(clinicId: string): Promise<ClinicSettings | null> {
    const row = await this.prisma.clinicSettings.findUnique({
      where: { clinicId },
    });

    if (!row) {
      // Fallback: build defaults from clinic name
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { name: true },
      });
      if (!clinic) return null;
      return buildDefaultClinicSettings(clinicId, clinic.name);
    }

    return new ClinicSettings({
      id: row.id,
      clinicId: row.clinicId,
      botName: row.botName,
      clinicDisplayName: row.clinicDisplayName,
      tone: row.tone,
      greetingTemplate: row.greetingTemplate,
      fallbackMessage: row.fallbackMessage,
      workingHourStart: row.workingHourStart,
      workingHourEnd: row.workingHourEnd,
      workingDaysText: row.workingDaysText,
      timezone: row.timezone,
      maxUnknownBeforeFallback: row.maxUnknownBeforeFallback,
      holdTtlMinutes: row.holdTtlMinutes,
      slotStepMinutes: row.slotStepMinutes,
      tplAskName: row.tplAskName,
      tplAskCareType: row.tplAskCareType,
      tplAskService: row.tplAskService,
      tplAskDatetime: row.tplAskDatetime,
      tplAskProfessional: row.tplAskProfessional,
      tplHoldCreated: row.tplHoldCreated,
      tplAppointmentConfirmed: row.tplAppointmentConfirmed,
      tplNoSlots: row.tplNoSlots,
      tplEscalateHuman: row.tplEscalateHuman,
    });
  }
}
