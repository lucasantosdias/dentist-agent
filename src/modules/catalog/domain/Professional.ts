export type ProfessionalProps = {
  id: string;
  displayName: string;
  specialties: string[];
  email: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
};

export class Professional {
  constructor(private readonly props: ProfessionalProps) {}

  get id(): string {
    return this.props.id;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get specialties(): string[] {
    return this.props.specialties;
  }

  /** @deprecated use displayName */
  get name(): string {
    return this.props.displayName;
  }

  get email(): string | null {
    return this.props.email;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get active(): boolean {
    return this.props.active;
  }
}
