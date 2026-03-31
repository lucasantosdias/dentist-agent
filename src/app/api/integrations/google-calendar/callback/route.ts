import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const container = getContainer();

  if (!container.handleGoogleOAuthCallbackUseCase) {
    return htmlResponse("Google Calendar integration is not configured.", 501);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return htmlResponse(`Autorizacao negada: ${error}`, 400);
  }

  if (!code || !state) {
    return htmlResponse("Parametros invalidos. Tente novamente.", 400);
  }

  try {
    const result = await container.handleGoogleOAuthCallbackUseCase.execute({ code, state });

    if (!result.ok) {
      const messages: Record<string, string> = {
        INVALID_STATE: "Link invalido ou adulterado. Solicite um novo link.",
        EXPIRED_STATE: "Link expirado. Solicite um novo link ao administrador.",
        PROFESSIONAL_NOT_FOUND: "Profissional nao encontrado.",
        TOKEN_EXCHANGE_FAILED: "Falha na autorizacao com o Google. Tente novamente.",
        CONNECTION_FAILED: "Falha ao salvar a conexao. Tente novamente.",
      };
      return htmlResponse(messages[result.error] ?? "Erro desconhecido.", 400);
    }

    return htmlResponse("Google Calendar conectado com sucesso! Voce pode fechar esta pagina.", 200, true);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return htmlResponse("Erro inesperado. Tente novamente.", 500);
  }
}

function htmlResponse(message: string, status: number, success = false): NextResponse {
  const color = success ? "#52c41a" : "#ff4d4f";
  const icon = success ? "&#10004;" : "&#10008;";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentzi AI — Google Calendar</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:white;border-radius:12px;padding:48px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px}
.icon{font-size:48px;color:${color};margin-bottom:16px}
.msg{font-size:18px;color:#333;line-height:1.5}</style></head>
<body><div class="card"><div class="icon">${icon}</div><p class="msg">${message}</p></div></body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
