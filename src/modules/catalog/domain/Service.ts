export type ServiceProps = {
  id: string;
  clinicId: string;
  code: string;
  displayName: string;
  description?: string | null;
  durationMinutes: number;
  price?: number | null;
  active: boolean;
};

export class Service {
  constructor(private readonly props: ServiceProps) {}

  get id(): string {
    return this.props.id;
  }

  get clinicId(): string {
    return this.props.clinicId;
  }

  get description(): string | null | undefined {
    return this.props.description;
  }

  get price(): number | null | undefined {
    return this.props.price;
  }

  get code(): string {
    return this.props.code;
  }

  /** @deprecated use code */
  get serviceCode(): string {
    return this.props.code;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  /** @deprecated use displayName */
  get name(): string {
    return this.props.displayName;
  }

  get durationMinutes(): number {
    return this.props.durationMinutes;
  }

  /** @deprecated use durationMinutes */
  get durationMin(): number {
    return this.props.durationMinutes;
  }

  get active(): boolean {
    return this.props.active;
  }
}
