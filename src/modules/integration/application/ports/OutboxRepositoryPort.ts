export type OutboxAction = "CREATE_EVENT" | "UPDATE_EVENT" | "CANCEL_EVENT";

export type OutboxStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export type CreateOutboxRecordInput = {
  appointmentId: string;
  aggregateType: string;
  action: OutboxAction;
  payload: Record<string, unknown>;
};

export type OutboxRecord = {
  id: string;
  appointmentId: string;
  aggregateType: string;
  action: string;
  status: string;
  externalEventId: string | null;
  payloadJson: Record<string, unknown>;
  createdAt: Date;
};

export interface OutboxRepositoryPort {
  createPending(input: CreateOutboxRecordInput): Promise<void>;
  findPending(limit: number): Promise<OutboxRecord[]>;
  markProcessing(id: string): Promise<void>;
  markDone(id: string, externalEventId?: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
