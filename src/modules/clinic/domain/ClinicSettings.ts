import type { TemplateKey } from "@/shared/domain/constants";

export type ClinicSettingsProps = {
  id: string;
  clinicId: string;
  botName: string;
  clinicDisplayName: string;
  tone: string;
  greetingTemplate: string;
  fallbackMessage: string;
  workingHourStart: number;
  workingHourEnd: number;
  workingDaysText: string;
  timezone: string;
  maxUnknownBeforeFallback: number;
  holdTtlMinutes: number;
  slotStepMinutes: number;
  tplAskName: string;
  tplAskCareType: string;
  tplAskService: string;
  tplAskDatetime: string;
  tplAskProfessional: string;
  tplHoldCreated: string;
  tplAppointmentConfirmed: string;
  tplNoSlots: string;
  tplEscalateHuman: string;
};

export class ClinicSettings {
  constructor(private readonly props: ClinicSettingsProps) {}

  get clinicId(): string { return this.props.clinicId; }
  get botName(): string { return this.props.botName; }
  get clinicDisplayName(): string { return this.props.clinicDisplayName; }
  get tone(): string { return this.props.tone; }
  get greetingTemplate(): string { return this.props.greetingTemplate; }
  get fallbackMessage(): string { return this.props.fallbackMessage; }
  get workingHourStart(): number { return this.props.workingHourStart; }
  get workingHourEnd(): number { return this.props.workingHourEnd; }
  get workingDaysText(): string { return this.props.workingDaysText; }
  get timezone(): string { return this.props.timezone; }
  get maxUnknownBeforeFallback(): number { return this.props.maxUnknownBeforeFallback; }
  get holdTtlMinutes(): number { return this.props.holdTtlMinutes; }
  get slotStepMinutes(): number { return this.props.slotStepMinutes; }

  get workingHoursText(): string {
    return `${String(this.workingHourStart).padStart(2, "0")}:00-${String(this.workingHourEnd).padStart(2, "0")}:00`;
  }

  getTemplate(key: TemplateKey): string {
    const map: Record<TemplateKey, string> = {
      ask_name: this.props.tplAskName,
      ask_care_type: this.props.tplAskCareType,
      ask_service: this.props.tplAskService,
      ask_datetime: this.props.tplAskDatetime,
      ask_professional: this.props.tplAskProfessional,
      hold_created: this.props.tplHoldCreated,
      appointment_confirmed: this.props.tplAppointmentConfirmed,
      no_slots: this.props.tplNoSlots,
      escalate_human: this.props.tplEscalateHuman,
      greeting: this.props.greetingTemplate,
      fallback: this.props.fallbackMessage,
    };
    return map[key];
  }

  toPrimitives(): ClinicSettingsProps {
    return { ...this.props };
  }
}

/**
 * Default settings — written to sound like a real dental clinic secretary.
 * Warm, professional, concise. Brazilian Portuguese.
 */
export function buildDefaultClinicSettings(clinicId: string, clinicName: string): ClinicSettings {
  return new ClinicSettings({
    id: "",
    clinicId,
    botName: "secretária",
    clinicDisplayName: clinicName,
    tone: "warm_professional",
    greetingTemplate: "Olá! Aqui é da {clinic_name}. Em que posso te ajudar?",
    fallbackMessage: "Desculpa, não consegui entender. Pode repetir de outra forma? Se preferir, posso te passar para um de nossos atendentes.",
    workingHourStart: 8,
    workingHourEnd: 19,
    workingDaysText: "segunda a sexta",
    timezone: "America/Sao_Paulo",
    maxUnknownBeforeFallback: 3,
    holdTtlMinutes: 10,
    slotStepMinutes: 30,
    tplAskName: "Pra eu dar andamento, pode me informar seu nome completo?",
    tplAskCareType: "Vai ser particular ou por convênio?",
    tplAskService: "Certo! Qual procedimento você gostaria? Temos: {services}.",
    tplAskDatetime: "E qual seria o melhor dia e horário pra você?",
    tplAskProfessional: "Tem preferência por algum dos nossos profissionais?",
    tplHoldCreated: "Pronto! Reservei o horário de {slot} com {professional} pra {service}. Pra confirmar, é só responder CONFIRMO. Essa reserva vale por {ttl} minutos, tá?",
    tplAppointmentConfirmed: "Perfeito, tá confirmado! Seu agendamento ficou pra {datetime}. Te esperamos! 😊",
    tplNoSlots: "Puxa, infelizmente não encontrei horários disponíveis nesse período. Quer que eu procure em outro dia ou com outro profissional?",
    tplEscalateHuman: "Sem problema! Vou te passar pra um dos nossos atendentes agora. Só um minutinho.",
  });
}
