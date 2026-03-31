import type { GoogleCalendarPort } from "@/modules/integration/application/ports/GoogleCalendarPort";
import type { ConnectGoogleCalendarUseCase } from "@/modules/integration/application/usecases/ConnectGoogleCalendarUseCase";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { Result } from "@/shared/result";
import { ok, fail } from "@/shared/result";
import { createHmac, timingSafeEqual } from "crypto";

export type CallbackInput = {
  code: string;
  state: string;
};

export type CallbackError =
  | "INVALID_STATE"
  | "EXPIRED_STATE"
  | "PROFESSIONAL_NOT_FOUND"
  | "TOKEN_EXCHANGE_FAILED"
  | "CONNECTION_FAILED";

const STATE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export class HandleGoogleOAuthCallbackUseCase {
  constructor(
    private readonly catalogRepo: CatalogRepositoryPort,
    private readonly googleCalendar: GoogleCalendarPort,
    private readonly connectUseCase: ConnectGoogleCalendarUseCase,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  async execute(input: CallbackInput): Promise<Result<{ professionalId: string }, CallbackError>> {
    // 1. Verify and decode state
    const stateResult = this.verifyState(input.state);
    if (!stateResult.ok) return stateResult;

    const { professionalId, timestamp } = stateResult.value;

    // 2. Check expiration
    if (Date.now() - timestamp > STATE_MAX_AGE_MS) {
      return fail("EXPIRED_STATE");
    }

    // 3. Verify professional exists
    const professional = await this.catalogRepo.findProfessionalById(professionalId);
    if (!professional) return fail("PROFESSIONAL_NOT_FOUND");

    // 4. Exchange code for tokens
    let tokens: { accessToken: string; refreshToken: string; expiresAt: Date };
    try {
      tokens = await this.googleCalendar.exchangeCodeForTokens(input.code, this.redirectUri);
    } catch (error) {
      console.error("Google OAuth token exchange failed:", error);
      return fail("TOKEN_EXCHANGE_FAILED");
    }

    // 5. Connect via existing use case
    const googleCalendarId = professional.email ?? "primary";
    const connectResult = await this.connectUseCase.execute({
      professionalId,
      googleCalendarId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    });

    if (!connectResult.ok) {
      return fail("CONNECTION_FAILED");
    }

    return ok({ professionalId });
  }

  private verifyState(
    state: string,
  ): Result<{ professionalId: string; timestamp: number }, CallbackError> {
    const dotIndex = state.lastIndexOf(".");
    if (dotIndex === -1) return fail("INVALID_STATE");

    const encoded = state.substring(0, dotIndex);
    const signature = state.substring(dotIndex + 1);

    const expectedSignature = createHmac("sha256", this.clientSecret)
      .update(Buffer.from(encoded, "base64url").toString())
      .digest("hex");

    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return fail("INVALID_STATE");
    }

    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as {
        professionalId: string;
        timestamp: number;
      };
      return ok(payload);
    } catch {
      return fail("INVALID_STATE");
    }
  }
}
