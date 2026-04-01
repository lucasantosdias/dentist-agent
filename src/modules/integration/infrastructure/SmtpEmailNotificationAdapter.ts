import nodemailer from "nodemailer";
import type { NotificationPort, SendNotificationInput } from "@/modules/integration/application/ports/NotificationPort";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export class SmtpEmailNotificationAdapter implements NotificationPort {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
    if (input.channel !== "email") {
      return { sent: false, error: "SmtpEmailNotificationAdapter only handles email channel" };
    }

    try {
      console.log("[SMTP] Sending email to:", input.recipient, "| template:", input.templateKey);

      // Verify connection first
      await this.transporter.verify();
      console.log("[SMTP] Connection verified OK");

      const html = this.renderTemplate(input.templateKey, input.data);

      const result = await this.transporter.sendMail({
        from: this.from,
        to: input.recipient,
        subject: input.subject ?? input.templateKey,
        html,
      });

      console.log("[SMTP] Email sent OK | messageId:", result.messageId);
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed";
      const stack = error instanceof Error ? error.stack : "";
      console.error("[SMTP] ❌ Email send FAILED:", message);
      console.error("[SMTP] Stack:", stack);
      return { sent: false, error: message };
    }
  }

  private renderTemplate(templateKey: string, data: Record<string, string>): string {
    if (templateKey === "google-calendar-link") {
      return `
        <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;margin-bottom:8px">Dentzi AI</h2>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Ola, <strong>${data.professional_name ?? ""}</strong>!
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Clique no botao abaixo para conectar seu Google Calendar ao sistema de agendamentos da clinica.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${data.oauth_url ?? "#"}"
               style="background:#1677ff;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">
              Conectar Google Calendar
            </a>
          </div>
          <p style="color:#999;font-size:13px">
            Este link expira em 1 hora. Se voce nao solicitou esta conexao, ignore este email.
          </p>
        </div>
      `;
    }

    if (templateKey === "user-invite") {
      const roleLabel = data.role ?? "Membro";
      return `
        <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;margin-bottom:8px">Dentzi AI</h2>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Ola, <strong>${data.name ?? ""}</strong>!
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Voce foi convidado para a plataforma Dentzi AI como <strong>${roleLabel}</strong>.
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Clique no botao abaixo para criar sua senha e acessar a plataforma.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${data.invite_url ?? "#"}"
               style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">
              Criar minha senha
            </a>
          </div>
          <p style="color:#999;font-size:13px">
            Este link expira em 72 horas.
          </p>
        </div>
      `;
    }

    if (templateKey === "password-reset") {
      return `
        <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a;margin-bottom:8px">Dentzi AI</h2>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Ola, <strong>${data.name ?? ""}</strong>!
          </p>
          <p style="color:#555;font-size:16px;line-height:1.6">
            Recebemos uma solicitacao para redefinir sua senha.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${data.reset_url ?? "#"}"
               style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;display:inline-block">
              Redefinir senha
            </a>
          </div>
          <p style="color:#999;font-size:13px">
            Este link expira em 1 hora. Se voce nao solicitou, ignore este email.
          </p>
        </div>
      `;
    }

    // Fallback: render data as key-value pairs
    const lines = Object.entries(data)
      .map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`)
      .join("");
    return `<div style="font-family:sans-serif;padding:16px">${lines}</div>`;
  }
}
