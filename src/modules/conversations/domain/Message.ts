export const messageDirections = ["INBOUND", "OUTBOUND"] as const;

export type MessageDirection = (typeof messageDirections)[number];

export type MessageProps = {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  text: string;
  channel: string;
  externalUserId: string;
  externalMessageId: string | null;
  llmIntent: string | null;
  entitiesJson: Record<string, unknown> | null;
  createdAt: Date;
};

export class Message {
  constructor(private readonly props: MessageProps) {}

  get id(): string {
    return this.props.id;
  }

  get conversationId(): string {
    return this.props.conversationId;
  }

  get direction(): MessageDirection {
    return this.props.direction;
  }

  get text(): string {
    return this.props.text;
  }

  get channel(): string {
    return this.props.channel;
  }

  get externalUserId(): string {
    return this.props.externalUserId;
  }

  get externalMessageId(): string | null {
    return this.props.externalMessageId;
  }

  get llmIntent(): string | null {
    return this.props.llmIntent;
  }

  get entitiesJson(): Record<string, unknown> | null {
    return this.props.entitiesJson;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
