import type { PatientState } from "@/modules/patients/domain/PatientState";

export type PatientProps = {
  id: string;
  clinicId: string;
  externalUserId: string;
  defaultChannel: string;
  fullName: string | null;
  phoneE164: string | null;
  state: PatientState;
  lastInteractionAt: Date | null;
};

export class Patient {
  constructor(private props: PatientProps) {}

  get id(): string {
    return this.props.id;
  }

  get clinicId(): string {
    return this.props.clinicId;
  }

  get defaultChannel(): string {
    return this.props.defaultChannel;
  }

  get externalUserId(): string {
    return this.props.externalUserId;
  }

  get fullName(): string | null {
    return this.props.fullName;
  }

  get phoneE164(): string | null {
    return this.props.phoneE164;
  }

  get state(): PatientState {
    return this.props.state;
  }

  get lastInteractionAt(): Date | null {
    return this.props.lastInteractionAt;
  }

  setFullName(fullName: string): void {
    const normalized = fullName.trim();
    if (normalized.length > 0) {
      this.props.fullName = normalized;
      if (this.props.state === "LEAD_NEW") {
        this.props.state = "LEAD_QUALIFIED";
      }
    }
  }

  setPhone(phone: string): void {
    this.props.phoneE164 = phone.trim() || null;
  }

  touchInteraction(): void {
    this.props.lastInteractionAt = new Date();
  }

  activate(): void {
    this.props.state = "ACTIVE";
  }

  markLeadInactive(): void {
    if (this.props.state === "LEAD_NEW" || this.props.state === "LEAD_QUALIFIED") {
      this.props.state = "LEAD_INACTIVE";
    }
  }

  inactivate(): void {
    this.props.state = "INACTIVE";
  }

  toPrimitives(): PatientProps {
    return { ...this.props };
  }
}
