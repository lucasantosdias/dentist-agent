import type { AppointmentStatus, CancelledBy } from "@/modules/scheduling/domain/AppointmentStatus";

export type AppointmentProps = {
  id: string;
  patientId: string;
  conversationId: string | null;
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  cancelledAt: Date | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  createdBy: string;
};

export class Appointment {
  constructor(private props: AppointmentProps) {}

  get id(): string {
    return this.props.id;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get conversationId(): string | null {
    return this.props.conversationId;
  }

  get professionalId(): string {
    return this.props.professionalId;
  }

  get serviceId(): string {
    return this.props.serviceId;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }

  get status(): AppointmentStatus {
    return this.props.status;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get cancelledBy(): CancelledBy | null {
    return this.props.cancelledBy;
  }

  get cancellationReason(): string | null {
    return this.props.cancellationReason;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  cancel(cancelledBy: CancelledBy, reason: string | null, cancelledAt: Date): void {
    if (this.props.status === "CANCELADA") {
      return;
    }

    this.props.status = "CANCELADA";
    this.props.cancelledBy = cancelledBy;
    this.props.cancelledAt = cancelledAt;
    this.props.cancellationReason = reason;
  }

  confirmPresence(): void {
    if (this.props.status === "AGENDADA") {
      this.props.status = "CONFIRMADA";
    }
  }

  toPrimitives(): AppointmentProps {
    return { ...this.props };
  }
}
