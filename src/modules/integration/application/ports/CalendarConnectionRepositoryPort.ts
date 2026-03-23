import type { CalendarConnection } from "@/modules/integration/domain/CalendarConnection";

export type CreateCalendarConnectionInput = {
  professionalId: string;
  provider: "GOOGLE";
  googleCalendarId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
};

export interface CalendarConnectionRepositoryPort {
  upsert(input: CreateCalendarConnectionInput): Promise<CalendarConnection>;
  save(connection: CalendarConnection): Promise<CalendarConnection>;
  findByProfessional(professionalId: string): Promise<CalendarConnection | null>;
}
