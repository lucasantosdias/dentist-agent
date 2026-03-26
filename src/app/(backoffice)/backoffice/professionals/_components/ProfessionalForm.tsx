"use client";

import { Form, Input, Select, Checkbox, Divider, Typography } from "antd";

const { Text } = Typography;

type ClinicService = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
};

type Specialty = {
  id: string;
  name: string;
};

type ProfessionalFormProps = {
  specialties: Specialty[];
  clinicServices: ClinicService[];
};

const ROLE_OPTIONS = [
  { value: "PROFESSIONAL", label: "Profissional" },
  { value: "CLINIC_MANAGER", label: "Gestor" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasilia (SP, RJ, MG)" },
  { value: "America/Manaus", label: "Manaus (AM)" },
  { value: "America/Bahia", label: "Bahia (BA)" },
  { value: "America/Recife", label: "Recife (PE, PB, AL)" },
  { value: "America/Belem", label: "Belem (PA)" },
  { value: "America/Fortaleza", label: "Fortaleza (CE, MA, PI)" },
  { value: "America/Cuiaba", label: "Cuiaba (MT, MS)" },
  { value: "America/Porto_Velho", label: "Porto Velho (RO)" },
  { value: "America/Rio_Branco", label: "Rio Branco (AC)" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
];

export function ProfessionalForm({ specialties, clinicServices }: ProfessionalFormProps) {
  return (
    <>
      {/* Basic Info */}
      <Divider orientation="left" orientationMargin={0} style={{ marginTop: 0 }}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Informacoes basicas
        </Text>
      </Divider>
      <Form.Item
        name="display_name"
        label="Nome"
        rules={[{ required: true, message: "Nome e obrigatorio" }]}
      >
        <Input placeholder="Dr. Joao Silva" />
      </Form.Item>
      <Form.Item name="role" label="Papel">
        <Select options={ROLE_OPTIONS} />
      </Form.Item>

      {/* Contact */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Contato
        </Text>
      </Divider>
      <Form.Item name="email" label="Email">
        <Input type="email" placeholder="joao@clinica.com" />
      </Form.Item>
      <Form.Item name="phone" label="Telefone">
        <Input placeholder="+55 11 99999-9999" />
      </Form.Item>

      {/* Specialties & Services */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Especialidades e Servicos
        </Text>
      </Divider>
      <Form.Item name="specialty_ids" label="Especialidades">
        {specialties.length > 0 ? (
          <Select
            mode="multiple"
            placeholder="Selecione as especialidades"
            allowClear
            showSearch
            optionFilterProp="label"
            options={specialties.map((s) => ({ label: s.name, value: s.id }))}
          />
        ) : (
          <Input
            placeholder="Cadastre especialidades na aba de configuracoes"
            disabled
          />
        )}
      </Form.Item>
      {clinicServices.length > 0 && (
        <Form.Item
          name="service_ids"
          label="Servicos que este profissional realiza"
        >
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            options={clinicServices.map((s) => ({
              label: `${s.display_name} (${s.duration_minutes} min)`,
              value: s.id,
            }))}
          />
        </Form.Item>
      )}

      {/* Settings */}
      <Divider orientation="left" orientationMargin={0}>
        <Text strong style={{ fontSize: 13, color: "#64748b" }}>
          Configuracoes
        </Text>
      </Divider>
      <Form.Item
        name="timezone"
        label="Fuso Horario"
        rules={[{ required: true, message: "Fuso horario e obrigatorio" }]}
      >
        <Select
          showSearch
          placeholder="Selecione o fuso horario"
          optionFilterProp="label"
          options={TIMEZONE_OPTIONS}
        />
      </Form.Item>
    </>
  );
}
