import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { CalendarConnectionRepositoryPort } from "@/modules/integration/application/ports/CalendarConnectionRepositoryPort";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";
import { createHmac } from "crypto";

export type InitiateInput = {
  professionalId: string;
};

export type InitiateError = "PROFESSIONAL_NOT_FOUND" | "ALREADY_CONNECTED";

export class InitiateGoogleCalendarConnectionUseCase {
  constructor(
    private readonly catalogRepo: CatalogRepositoryPort,
    private readonly connectionRepo: CalendarConnectionRepositoryPort,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  async execute(input: InitiateInput): Promise<Result<{ oauthUrl: string }, InitiateError>> {
    const professional = await this.catalogRepo.findProfessionalById(input.professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    const existing = await this.connectionRepo.findByProfessional(input.professionalId);
    if (existing) return fail("ALREADY_CONNECTED");

    const state = this.buildSignedState(input.professionalId);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return ok({ oauthUrl });
  }

  private buildSignedState(professionalId: string): string {
    const payload = JSON.stringify({
      professionalId,
      timestamp: Date.now(),
    });
    const signature = createHmac("sha256", this.clientSecret)
      .update(payload)
      .digest("hex");
    const encoded = Buffer.from(payload).toString("base64url");
    return `${encoded}.${signature}`;
  }
}
