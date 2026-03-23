import type { AppointmentStatus } from "@/modules/scheduling/domain/AppointmentStatus";

export type TimeSlot = {
  startsAt: Date;
  endsAt: Date;
};

export type AppointmentSummary = {
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  professionalName: string;
  serviceCode: string;
};
