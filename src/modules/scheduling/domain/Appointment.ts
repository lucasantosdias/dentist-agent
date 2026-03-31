import {
  type AppointmentStatus,
  type CancelledBy,
  isValidAppointmentTransition,
} from "@/modules/scheduling/domain/AppointmentStatus";

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

  /**
   * Transition to a new status with guard validation.
   * Throws if the transition is not allowed.
   */
  private transitionTo(newStatus: AppointmentStatus): void {
    if (!isValidAppointmentTransition(this.props.status, newStatus)) {
      throw new Error(
        `Invalid appointment transition: ${this.props.status} → ${newStatus}`,
      );
    }
    this.props.status = newStatus;
  }

  /**
   * Move from PENDING to CONFIRMED after backend slot validation.
   */
  confirm(): void {
    this.transitionTo("CONFIRMED");
  }

  /**
   * Cancel an appointment (from PENDING or CONFIRMED).
   */
  cancel(cancelledBy: CancelledBy, reason: string | null, cancelledAt: Date): void {
    if (this.props.status === "CANCELLED") {
      return; // idempotent
    }
    this.transitionTo("CANCELLED");
    this.props.cancelledBy = cancelledBy;
    this.props.cancelledAt = cancelledAt;
    this.props.cancellationReason = reason;
  }

  /**
   * Mark a CONFIRMED appointment as RESCHEDULED (historical marker).
   * A new appointment should be created for the new time slot.
   */
  markRescheduled(at: Date): void {
    this.transitionTo("RESCHEDULED");
    this.props.cancelledAt = at;
    this.props.cancelledBy = "SISTEMA";
    this.props.cancellationReason = "Reagendamento solicitado pelo paciente";
  }

  /**
   * Patient arrived — start the appointment (CONFIRMED → IN_PROGRESS).
   */
  checkIn(): void {
    this.transitionTo("IN_PROGRESS");
  }

  /**
   * Appointment finished (IN_PROGRESS → COMPLETED).
   */
  complete(): void {
    this.transitionTo("COMPLETED");
  }

  /**
   * Mark as NO_SHOW (CONFIRMED → NO_SHOW).
   * Only valid after scheduled time has passed.
   */
  markNoShow(now: Date): void {
    if (now < this.props.startsAt) {
      throw new Error("Cannot mark NO_SHOW before scheduled start time");
    }
    this.transitionTo("NO_SHOW");
  }

  toPrimitives(): AppointmentProps {
    return { ...this.props };
  }
}
