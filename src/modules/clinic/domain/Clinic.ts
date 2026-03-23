export type ClinicProps = {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class Clinic {
  constructor(private props: ClinicProps) {}

  get id() {
    return this.props.id;
  }
  get name() {
    return this.props.name;
  }
  get slug() {
    return this.props.slug;
  }
  get timezone() {
    return this.props.timezone;
  }
  get active() {
    return this.props.active;
  }
  get legalName() {
    return this.props.legalName;
  }
  get document() {
    return this.props.document;
  }
  get phone() {
    return this.props.phone;
  }
  get email() {
    return this.props.email;
  }
  get address() {
    return this.props.address;
  }

  update(input: {
    name?: string;
    legalName?: string | null;
    document?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  }) {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.legalName !== undefined) this.props.legalName = input.legalName;
    if (input.document !== undefined) this.props.document = input.document;
    if (input.phone !== undefined) this.props.phone = input.phone;
    if (input.email !== undefined) this.props.email = input.email;
    if (input.address !== undefined) this.props.address = input.address;
  }

  toPrimitives() {
    return { ...this.props };
  }
}
