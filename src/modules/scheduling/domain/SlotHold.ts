import type { SlotHoldStatus } from "@/modules/scheduling/domain/SlotHoldStatus";

export type SlotHoldProps = {
  id: string;
  conversationId: string;
  patientId: string;
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  status: SlotHoldStatus;
  expiresAt: Date;
};

export class SlotHold {
  constructor(private props: SlotHoldProps) {}

  get id(): string {
    return this.props.id;
  }

  get conversationId(): string {
    return this.props.conversationId;
  }

  get patientId(): string {
    return this.props.patientId;
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

  get status(): SlotHoldStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime() || this.props.status === "EXPIRED";
  }

  expire(): void {
    if (this.props.status === "HELD") {
      this.props.status = "EXPIRED";
    }
  }

  release(): void {
    if (this.props.status === "HELD") {
      this.props.status = "RELEASED";
    }
  }

  convert(): void {
    if (this.props.status !== "HELD") {
      throw new Error("Only HELD slot can be converted");
    }
    this.props.status = "CONVERTED";
  }

  toPrimitives(): SlotHoldProps {
    return { ...this.props };
  }
}
