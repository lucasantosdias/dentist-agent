import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Stable UUIDs ───────────────────────────────────────────

// Clinics
const CLINIC_1 = '00000000-0000-0000-0001-000000000001';
const CLINIC_2 = '00000000-0000-0000-0001-000000000002';
const CLINIC_3 = '00000000-0000-0000-0001-000000000003';

// Professionals
const PROF_ANA    = '00000000-0000-0000-0002-000000000001';
const PROF_JOAO   = '00000000-0000-0000-0002-000000000002';
const PROF_BEA    = '00000000-0000-0000-0002-000000000003';
const PROF_RAFAEL = '00000000-0000-0000-0002-000000000004';
const PROF_CAMILA = '00000000-0000-0000-0002-000000000005';
const PROF_FELIPE = '00000000-0000-0000-0002-000000000006';

// Services (3 per clinic = 9 total)
const SVC_C1_AVAL  = '00000000-0000-0000-0003-000000000001';
const SVC_C1_LIMP  = '00000000-0000-0000-0003-000000000002';
const SVC_C1_CLAR  = '00000000-0000-0000-0003-000000000003';
const SVC_C2_AVAL  = '00000000-0000-0000-0003-000000000004';
const SVC_C2_ORTO  = '00000000-0000-0000-0003-000000000005';
const SVC_C2_MANUT = '00000000-0000-0000-0003-000000000006';
const SVC_C3_AVAL  = '00000000-0000-0000-0003-000000000007';
const SVC_C3_IMPL  = '00000000-0000-0000-0003-000000000008';
const SVC_C3_CANAL = '00000000-0000-0000-0003-000000000009';

// Patients (5 per clinic = 15 total)
const PAT_C1_1 = '00000000-0000-0000-0004-000000000001';
const PAT_C1_2 = '00000000-0000-0000-0004-000000000002';
const PAT_C1_3 = '00000000-0000-0000-0004-000000000003';
const PAT_C1_4 = '00000000-0000-0000-0004-000000000004';
const PAT_C1_5 = '00000000-0000-0000-0004-000000000005';
const PAT_C2_1 = '00000000-0000-0000-0004-000000000006';
const PAT_C2_2 = '00000000-0000-0000-0004-000000000007';
const PAT_C2_3 = '00000000-0000-0000-0004-000000000008';
const PAT_C2_4 = '00000000-0000-0000-0004-000000000009';
const PAT_C2_5 = '00000000-0000-0000-0004-000000000010';
const PAT_C3_1 = '00000000-0000-0000-0004-000000000011';
const PAT_C3_2 = '00000000-0000-0000-0004-000000000012';
const PAT_C3_3 = '00000000-0000-0000-0004-000000000013';
const PAT_C3_4 = '00000000-0000-0000-0004-000000000014';
const PAT_C3_5 = '00000000-0000-0000-0004-000000000015';

// Appointments
const APT_C1_1 = '00000000-0000-0000-0005-000000000001';
const APT_C1_2 = '00000000-0000-0000-0005-000000000002';
const APT_C1_3 = '00000000-0000-0000-0005-000000000003';
const APT_C1_4 = '00000000-0000-0000-0005-000000000004';
const APT_C2_1 = '00000000-0000-0000-0005-000000000005';
const APT_C2_2 = '00000000-0000-0000-0005-000000000006';
const APT_C2_3 = '00000000-0000-0000-0005-000000000007';
const APT_C3_1 = '00000000-0000-0000-0005-000000000008';
const APT_C3_2 = '00000000-0000-0000-0005-000000000009';
const APT_C3_3 = '00000000-0000-0000-0005-000000000010';
const APT_C3_4 = '00000000-0000-0000-0005-000000000011';
const APT_C3_5 = '00000000-0000-0000-0005-000000000012';

// Specialties
const SPEC_CLINICA_GERAL  = '00000000-0000-0000-0007-000000000001';
const SPEC_ORTODONTIA     = '00000000-0000-0000-0007-000000000002';
const SPEC_IMPLANTODONTIA = '00000000-0000-0000-0007-000000000003';
const SPEC_ENDODONTIA     = '00000000-0000-0000-0007-000000000004';

// Availability rule ID generator (deterministic)
function availRuleId(profIdx: number, weekday: number, slot: number): string {
  const num = String(profIdx * 100 + weekday * 10 + slot).padStart(12, '0');
  return `00000000-0000-0000-0006-${num}`;
}

// ─── Helpers ────────────────────────────────────────────────

/** Returns a Date for "today + offsetDays" at the given hour:minute in São Paulo (UTC-3). */
function futureDate(offsetDays: number, hour: number, minute: number): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offsetDays,
      hour + 3, // São Paulo is UTC-3
      minute,
    ),
  );
  return d;
}

// ─── Collected IDs for cleanup ──────────────────────────────

const ALL_APPOINTMENT_IDS = [
  APT_C1_1, APT_C1_2, APT_C1_3, APT_C1_4,
  APT_C2_1, APT_C2_2, APT_C2_3,
  APT_C3_1, APT_C3_2, APT_C3_3, APT_C3_4, APT_C3_5,
];

const ALL_PATIENT_IDS = [
  PAT_C1_1, PAT_C1_2, PAT_C1_3, PAT_C1_4, PAT_C1_5,
  PAT_C2_1, PAT_C2_2, PAT_C2_3, PAT_C2_4, PAT_C2_5,
  PAT_C3_1, PAT_C3_2, PAT_C3_3, PAT_C3_4, PAT_C3_5,
];

const ALL_SERVICE_IDS = [
  SVC_C1_AVAL, SVC_C1_LIMP, SVC_C1_CLAR,
  SVC_C2_AVAL, SVC_C2_ORTO, SVC_C2_MANUT,
  SVC_C3_AVAL, SVC_C3_IMPL, SVC_C3_CANAL,
];

const ALL_PROFESSIONAL_IDS = [
  PROF_ANA, PROF_JOAO, PROF_BEA, PROF_RAFAEL, PROF_CAMILA, PROF_FELIPE,
];

const ALL_CLINIC_IDS = [CLINIC_1, CLINIC_2, CLINIC_3];

// Build all availability rule IDs
const ALL_AVAIL_RULE_IDS: string[] = [];
for (let profIdx = 1; profIdx <= 6; profIdx++) {
  for (let wd = 1; wd <= 5; wd++) {
    ALL_AVAIL_RULE_IDS.push(availRuleId(profIdx, wd, 1));
    ALL_AVAIL_RULE_IDS.push(availRuleId(profIdx, wd, 2));
  }
}

// ─── Cleanup ────────────────────────────────────────────────

async function cleanup() {
  console.log('Cleaning up existing seed data...');

  await prisma.permission.deleteMany({});
  await prisma.user.deleteMany({});

  // Delete in FK-safe order (children first)
  await prisma.calendarOutbox.deleteMany({ where: { appointment: { clinicId: { in: ALL_CLINIC_IDS } } } });
  await prisma.slotHold.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.appointment.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.professionalAvailabilityRule.deleteMany({ where: { id: { in: ALL_AVAIL_RULE_IDS } } });
  await prisma.professionalService.deleteMany({
    where: {
      OR: [
        { professionalId: { in: ALL_PROFESSIONAL_IDS } },
        { serviceId: { in: ALL_SERVICE_IDS } },
      ],
    },
  });
  await prisma.professionalSpecialty.deleteMany({
    where: { professionalId: { in: ALL_PROFESSIONAL_IDS } },
  });
  await prisma.clinicProfessional.deleteMany({
    where: { clinicId: { in: ALL_CLINIC_IDS } },
  });
  await prisma.message.deleteMany({ where: { conversation: { clinicId: { in: ALL_CLINIC_IDS } } } });
  await prisma.processedInboundMessage.deleteMany({ where: { conversation: { clinicId: { in: ALL_CLINIC_IDS } } } });
  await prisma.conversation.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.patient.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.service.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  // Delete professional_specialty links that reference specialties we're about to delete
  const specialtyIds = (await prisma.specialty.findMany({
    where: { clinicId: { in: ALL_CLINIC_IDS } },
    select: { id: true },
  })).map(s => s.id);
  if (specialtyIds.length > 0) {
    await prisma.professionalSpecialty.deleteMany({
      where: { specialtyId: { in: specialtyIds } },
    });
  }
  await prisma.specialty.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.clinicSettings.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.insurancePlan.deleteMany({ where: { clinicId: { in: ALL_CLINIC_IDS } } });
  await prisma.professional.deleteMany({ where: { id: { in: ALL_PROFESSIONAL_IDS } } });
  await prisma.clinic.deleteMany({ where: { id: { in: ALL_CLINIC_IDS } } });

  console.log('  Cleanup done.\n');
}

// ─── Seed functions ─────────────────────────────────────────

async function seedClinics() {
  console.log('Seeding clinics...');

  const clinics = [
    {
      id: CLINIC_1, name: 'Dentzi Centro', slug: 'dentzi-centro',
      phone: '+551133001001', email: 'centro@dentzi.com.br',
      address: 'Rua Augusta, 1000 - Centro, São Paulo - SP',
      legalName: 'Dentzi Centro Odontologia LTDA',
    },
    {
      id: CLINIC_2, name: 'Dentzi Jardins', slug: 'dentzi-jardins',
      phone: '+551133001002', email: 'jardins@dentzi.com.br',
      address: 'Av. Brasil, 500 - Jardins, São Paulo - SP',
      legalName: 'Dentzi Jardins Odontologia LTDA',
    },
    {
      id: CLINIC_3, name: 'Odonto Prime Moema', slug: 'odonto-prime-moema',
      phone: '+551133001003', email: 'contato@odontoprime.com.br',
      address: 'Av. Moema, 200 - Moema, São Paulo - SP',
      legalName: 'Odonto Prime Moema LTDA',
    },
  ];

  for (const c of clinics) {
    await prisma.clinic.upsert({
      where: { id: c.id },
      update: { name: c.name, slug: c.slug, phone: c.phone, email: c.email, address: c.address },
      create: c,
    });
  }

  console.log(`  Created ${clinics.length} clinics.`);
}

async function seedSpecialties() {
  console.log('Seeding specialties...');

  // Shared specialties for all clinics
  const clinics = [CLINIC_1, CLINIC_2, CLINIC_3];
  const specialties = [
    { id: SPEC_CLINICA_GERAL,  name: 'Clinica Geral' },
    { id: SPEC_ORTODONTIA,     name: 'Ortodontia' },
    { id: SPEC_IMPLANTODONTIA, name: 'Implantodontia' },
    { id: SPEC_ENDODONTIA,     name: 'Endodontia' },
  ];

  let specIdx = 1;
  for (const clinicId of clinics) {
    for (const s of specialties) {
      const id = `00000000-0000-0000-0007-${String(specIdx++).padStart(12, '0')}`;
      await prisma.specialty.upsert({
        where: { clinicId_name: { clinicId, name: s.name } },
        update: {},
        create: { id, clinicId, name: s.name },
      });
    }
  }

  console.log(`  Created specialties for ${clinics.length} clinics.`);
}

async function seedProfessionals() {
  console.log('Seeding professionals...');

  const professionals = [
    { id: PROF_ANA,    displayName: 'Dra. Ana Souza',     email: 'ana.souza@dentzi.com.br' },
    { id: PROF_JOAO,   displayName: 'Dr. João Lima',      email: 'joao.lima@dentzi.com.br' },
    { id: PROF_BEA,    displayName: 'Dra. Beatriz Costa', email: 'beatriz.costa@dentzi.com.br' },
    { id: PROF_RAFAEL, displayName: 'Dr. Rafael Mendes',  email: 'rafael.mendes@dentzi.com.br' },
    { id: PROF_CAMILA, displayName: 'Dra. Camila Rocha',  email: 'camila.rocha@odontoprime.com.br' },
    { id: PROF_FELIPE, displayName: 'Dr. Felipe Martins', email: 'felipe.martins@odontoprime.com.br' },
  ];

  for (const p of professionals) {
    await prisma.professional.upsert({
      where: { id: p.id },
      update: { displayName: p.displayName, email: p.email },
      create: p,
    });
  }

  console.log(`  Created ${professionals.length} professionals.`);
}

async function seedProfessionalSpecialties() {
  console.log('Linking professionals to specialties...');

  // Look up specialty IDs by name for each clinic's context
  const specByName = await prisma.specialty.findMany({
    where: { clinicId: CLINIC_1, active: true },
  });
  const specMap = Object.fromEntries(specByName.map((s) => [s.name, s.id]));

  const links: Array<{ professionalId: string; specialtyIds: string[] }> = [
    { professionalId: PROF_ANA,    specialtyIds: [specMap['Clinica Geral']] },
    { professionalId: PROF_JOAO,   specialtyIds: [specMap['Clinica Geral']] },
    { professionalId: PROF_BEA,    specialtyIds: [specMap['Ortodontia']] },
    { professionalId: PROF_RAFAEL, specialtyIds: [specMap['Ortodontia'], specMap['Clinica Geral']] },
    { professionalId: PROF_CAMILA, specialtyIds: [specMap['Implantodontia']] },
    { professionalId: PROF_FELIPE, specialtyIds: [specMap['Endodontia']] },
  ];

  for (const { professionalId, specialtyIds } of links) {
    for (const specialtyId of specialtyIds) {
      if (!specialtyId) continue;
      await prisma.professionalSpecialty.upsert({
        where: { professionalId_specialtyId: { professionalId, specialtyId } },
        create: { professionalId, specialtyId },
        update: {},
      });
    }
  }

  console.log('  Linked professionals to specialties.');
}

async function seedClinicProfessionals() {
  console.log('Linking professionals to clinics...');

  const links = [
    // Clinic 1: Ana is manager, João is professional
    { clinicId: CLINIC_1, professionalId: PROF_ANA,    role: 'CLINIC_MANAGER' as const },
    { clinicId: CLINIC_1, professionalId: PROF_JOAO,   role: 'PROFESSIONAL' as const },
    // Clinic 2: Beatriz is manager, Rafael is professional
    { clinicId: CLINIC_2, professionalId: PROF_BEA,    role: 'CLINIC_MANAGER' as const },
    { clinicId: CLINIC_2, professionalId: PROF_RAFAEL, role: 'PROFESSIONAL' as const },
    // Clinic 3: Camila is manager, Felipe is professional
    { clinicId: CLINIC_3, professionalId: PROF_CAMILA, role: 'CLINIC_MANAGER' as const },
    { clinicId: CLINIC_3, professionalId: PROF_FELIPE, role: 'PROFESSIONAL' as const },
  ];

  // Composite PK — no upsert available, cleanup already handled
  await prisma.clinicProfessional.createMany({ data: links });

  console.log(`  Created ${links.length} clinic-professional links.`);
}

async function seedServices() {
  console.log('Seeding services...');

  const services = [
    // Clinic 1
    { id: SVC_C1_AVAL, clinicId: CLINIC_1, code: 'AVALIACAO',       displayName: 'Avaliação Clínica',        durationMinutes: 30, price: new Decimal(0) },
    { id: SVC_C1_LIMP, clinicId: CLINIC_1, code: 'LIMPEZA',         displayName: 'Limpeza',                   durationMinutes: 45, price: new Decimal(150) },
    { id: SVC_C1_CLAR, clinicId: CLINIC_1, code: 'CLAREAMENTO',     displayName: 'Clareamento',               durationMinutes: 60, price: new Decimal(500) },
    // Clinic 2
    { id: SVC_C2_AVAL, clinicId: CLINIC_2, code: 'AVALIACAO',       displayName: 'Avaliação Clínica',        durationMinutes: 30, price: new Decimal(0) },
    { id: SVC_C2_ORTO, clinicId: CLINIC_2, code: 'ORTODONTIA',      displayName: 'Ortodontia',                durationMinutes: 45, price: new Decimal(300) },
    { id: SVC_C2_MANUT,clinicId: CLINIC_2, code: 'MANUTENCAO_ORTO', displayName: 'Manutenção Ortodôntica',  durationMinutes: 30, price: new Decimal(150) },
    // Clinic 3
    { id: SVC_C3_AVAL, clinicId: CLINIC_3, code: 'AVALIACAO',       displayName: 'Avaliação Clínica',        durationMinutes: 30, price: new Decimal(0) },
    { id: SVC_C3_IMPL, clinicId: CLINIC_3, code: 'IMPLANTE',        displayName: 'Implante',                  durationMinutes: 90, price: new Decimal(2000) },
    { id: SVC_C3_CANAL,clinicId: CLINIC_3, code: 'CANAL',           displayName: 'Tratamento de Canal',       durationMinutes: 60, price: new Decimal(800) },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: { code: s.code, displayName: s.displayName, durationMinutes: s.durationMinutes, price: s.price },
      create: s,
    });
  }

  console.log(`  Created ${services.length} services.`);
}

async function seedProfessionalServices() {
  console.log('Linking professionals to services...');

  const links = [
    // Clinic 1 professionals -> Clinic 1 services
    { professionalId: PROF_ANA,  serviceId: SVC_C1_AVAL },
    { professionalId: PROF_ANA,  serviceId: SVC_C1_LIMP },
    { professionalId: PROF_ANA,  serviceId: SVC_C1_CLAR },
    { professionalId: PROF_JOAO, serviceId: SVC_C1_AVAL },
    { professionalId: PROF_JOAO, serviceId: SVC_C1_LIMP },
    { professionalId: PROF_JOAO, serviceId: SVC_C1_CLAR },
    // Clinic 2 professionals -> Clinic 2 services
    { professionalId: PROF_BEA,    serviceId: SVC_C2_AVAL },
    { professionalId: PROF_BEA,    serviceId: SVC_C2_ORTO },
    { professionalId: PROF_BEA,    serviceId: SVC_C2_MANUT },
    { professionalId: PROF_RAFAEL, serviceId: SVC_C2_AVAL },
    { professionalId: PROF_RAFAEL, serviceId: SVC_C2_ORTO },
    { professionalId: PROF_RAFAEL, serviceId: SVC_C2_MANUT },
    // Clinic 3 professionals -> Clinic 3 services
    { professionalId: PROF_CAMILA, serviceId: SVC_C3_AVAL },
    { professionalId: PROF_CAMILA, serviceId: SVC_C3_IMPL },
    { professionalId: PROF_CAMILA, serviceId: SVC_C3_CANAL },
    { professionalId: PROF_FELIPE, serviceId: SVC_C3_AVAL },
    { professionalId: PROF_FELIPE, serviceId: SVC_C3_IMPL },
    { professionalId: PROF_FELIPE, serviceId: SVC_C3_CANAL },
  ];

  // Composite PK — cleanup already handled
  await prisma.professionalService.createMany({ data: links });

  console.log(`  Created ${links.length} professional-service links.`);
}

async function seedPatients() {
  console.log('Seeding patients...');

  const patients = [
    // Clinic 1
    { id: PAT_C1_1, clinicId: CLINIC_1, fullName: 'Maria Silva',       phoneE164: '+5511900010001', externalUserId: '+5511900010001', defaultChannel: 'WHATSAPP' },
    { id: PAT_C1_2, clinicId: CLINIC_1, fullName: 'Carlos Santos',     phoneE164: '+5511900010002', externalUserId: '+5511900010002', defaultChannel: 'WHATSAPP' },
    { id: PAT_C1_3, clinicId: CLINIC_1, fullName: 'Fernanda Oliveira', phoneE164: '+5511900010003', externalUserId: '+5511900010003', defaultChannel: 'WHATSAPP' },
    { id: PAT_C1_4, clinicId: CLINIC_1, fullName: 'Ricardo Almeida',   phoneE164: '+5511900010004', externalUserId: '+5511900010004', defaultChannel: 'WHATSAPP' },
    { id: PAT_C1_5, clinicId: CLINIC_1, fullName: 'Juliana Costa',     phoneE164: '+5511900010005', externalUserId: '+5511900010005', defaultChannel: 'WHATSAPP' },
    // Clinic 2
    { id: PAT_C2_1, clinicId: CLINIC_2, fullName: 'Pedro Mendes',      phoneE164: '+5511900020001', externalUserId: '+5511900020001', defaultChannel: 'WHATSAPP' },
    { id: PAT_C2_2, clinicId: CLINIC_2, fullName: 'Luciana Ferreira',  phoneE164: '+5511900020002', externalUserId: '+5511900020002', defaultChannel: 'WHATSAPP' },
    { id: PAT_C2_3, clinicId: CLINIC_2, fullName: 'André Barbosa',     phoneE164: '+5511900020003', externalUserId: '+5511900020003', defaultChannel: 'WHATSAPP' },
    { id: PAT_C2_4, clinicId: CLINIC_2, fullName: 'Patrícia Lima',     phoneE164: '+5511900020004', externalUserId: '+5511900020004', defaultChannel: 'WHATSAPP' },
    { id: PAT_C2_5, clinicId: CLINIC_2, fullName: 'Gustavo Rocha',     phoneE164: '+5511900020005', externalUserId: '+5511900020005', defaultChannel: 'WHATSAPP' },
    // Clinic 3
    { id: PAT_C3_1, clinicId: CLINIC_3, fullName: 'Amanda Torres',     phoneE164: '+5511900030001', externalUserId: '+5511900030001', defaultChannel: 'WHATSAPP' },
    { id: PAT_C3_2, clinicId: CLINIC_3, fullName: 'Bruno Cardoso',     phoneE164: '+5511900030002', externalUserId: '+5511900030002', defaultChannel: 'WHATSAPP' },
    { id: PAT_C3_3, clinicId: CLINIC_3, fullName: 'Daniela Souza',     phoneE164: '+5511900030003', externalUserId: '+5511900030003', defaultChannel: 'WHATSAPP' },
    { id: PAT_C3_4, clinicId: CLINIC_3, fullName: 'Eduardo Gomes',     phoneE164: '+5511900030004', externalUserId: '+5511900030004', defaultChannel: 'WHATSAPP' },
    { id: PAT_C3_5, clinicId: CLINIC_3, fullName: 'Isabela Martins',   phoneE164: '+5511900030005', externalUserId: '+5511900030005', defaultChannel: 'WHATSAPP' },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: { fullName: p.fullName, phoneE164: p.phoneE164, state: 'ACTIVE' },
      create: { ...p, state: 'ACTIVE' },
    });
  }

  console.log(`  Created ${patients.length} patients.`);
}

async function seedAppointments() {
  console.log('Seeding appointments...');

  const appointments = [
    // Clinic 1 - 4 appointments
    {
      id: APT_C1_1, clinicId: CLINIC_1, patientId: PAT_C1_1, professionalId: PROF_ANA,
      serviceId: SVC_C1_AVAL, startsAt: futureDate(1, 9, 0), endsAt: futureDate(1, 9, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C1_2, clinicId: CLINIC_1, patientId: PAT_C1_2, professionalId: PROF_ANA,
      serviceId: SVC_C1_LIMP, startsAt: futureDate(2, 10, 0), endsAt: futureDate(2, 10, 45),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C1_3, clinicId: CLINIC_1, patientId: PAT_C1_3, professionalId: PROF_JOAO,
      serviceId: SVC_C1_CLAR, startsAt: futureDate(3, 14, 0), endsAt: futureDate(3, 15, 0),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C1_4, clinicId: CLINIC_1, patientId: PAT_C1_4, professionalId: PROF_JOAO,
      serviceId: SVC_C1_AVAL, startsAt: futureDate(4, 8, 0), endsAt: futureDate(4, 8, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },

    // Clinic 2 - 3 appointments
    {
      id: APT_C2_1, clinicId: CLINIC_2, patientId: PAT_C2_1, professionalId: PROF_BEA,
      serviceId: SVC_C2_AVAL, startsAt: futureDate(1, 11, 0), endsAt: futureDate(1, 11, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C2_2, clinicId: CLINIC_2, patientId: PAT_C2_2, professionalId: PROF_RAFAEL,
      serviceId: SVC_C2_ORTO, startsAt: futureDate(2, 14, 0), endsAt: futureDate(2, 14, 45),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C2_3, clinicId: CLINIC_2, patientId: PAT_C2_3, professionalId: PROF_BEA,
      serviceId: SVC_C2_MANUT, startsAt: futureDate(5, 9, 0), endsAt: futureDate(5, 9, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },

    // Clinic 3 - 5 appointments
    {
      id: APT_C3_1, clinicId: CLINIC_3, patientId: PAT_C3_1, professionalId: PROF_CAMILA,
      serviceId: SVC_C3_AVAL, startsAt: futureDate(1, 8, 0), endsAt: futureDate(1, 8, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C3_2, clinicId: CLINIC_3, patientId: PAT_C3_2, professionalId: PROF_CAMILA,
      serviceId: SVC_C3_IMPL, startsAt: futureDate(2, 9, 0), endsAt: futureDate(2, 10, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C3_3, clinicId: CLINIC_3, patientId: PAT_C3_3, professionalId: PROF_FELIPE,
      serviceId: SVC_C3_CANAL, startsAt: futureDate(3, 15, 0), endsAt: futureDate(3, 16, 0),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C3_4, clinicId: CLINIC_3, patientId: PAT_C3_4, professionalId: PROF_FELIPE,
      serviceId: SVC_C3_AVAL, startsAt: futureDate(5, 10, 0), endsAt: futureDate(5, 10, 30),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
    {
      id: APT_C3_5, clinicId: CLINIC_3, patientId: PAT_C3_5, professionalId: PROF_CAMILA,
      serviceId: SVC_C3_CANAL, startsAt: futureDate(6, 14, 0), endsAt: futureDate(6, 15, 0),
      status: 'CONFIRMED' as const, createdBy: 'SEED',
    },
  ];

  for (const a of appointments) {
    await prisma.appointment.upsert({
      where: { id: a.id },
      update: { startsAt: a.startsAt, endsAt: a.endsAt, status: a.status },
      create: a,
    });
  }

  console.log(`  Created ${appointments.length} appointments.`);
}

async function seedAvailabilityRules() {
  console.log('Seeding availability rules...');

  const rules: Array<{
    id: string;
    professionalId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }> = [];

  const profEntries = [
    { idx: 1, id: PROF_ANA },
    { idx: 2, id: PROF_JOAO },
    { idx: 3, id: PROF_BEA },
    { idx: 4, id: PROF_RAFAEL },
    { idx: 5, id: PROF_CAMILA },
    { idx: 6, id: PROF_FELIPE },
  ];

  for (const prof of profEntries) {
    // Monday (1) through Friday (5)
    for (let wd = 1; wd <= 5; wd++) {
      rules.push({
        id: availRuleId(prof.idx, wd, 1),
        professionalId: prof.id,
        weekday: wd,
        startTime: '08:00',
        endTime: '12:00',
      });
      rules.push({
        id: availRuleId(prof.idx, wd, 2),
        professionalId: prof.id,
        weekday: wd,
        startTime: '14:00',
        endTime: '18:00',
      });
    }
  }

  await prisma.professionalAvailabilityRule.createMany({ data: rules });

  console.log(`  Created ${rules.length} availability rules (${rules.length / 2} time blocks across ${profEntries.length} professionals).`);
}

// ─── Users + Permissions ───────────────────────────────────

const USER_SUPERADMIN = '00000000-0000-0000-0003-000000000001';
const USER_ADMIN      = '00000000-0000-0000-0003-000000000002';
const USER_ATTENDANT  = '00000000-0000-0000-0003-000000000003';

async function seedUsers() {
  console.log('Seeding users...');

  const passwordHash = await bcrypt.hash('DentziAdmin2026!', 12);

  // Superadmin
  await prisma.user.upsert({
    where: { email: 'dev@dentzi.ai' },
    update: {},
    create: {
      id: USER_SUPERADMIN,
      email: 'dev@dentzi.ai',
      name: 'Superadmin',
      role: 'SUPERADMIN',
      passwordHash,
      emailVerifiedAt: new Date(),
      active: true,
    },
  });

  // Admin (also a professional — Dra. Ana Souza)
  await prisma.user.upsert({
    where: { email: 'admin@dentzi.ai' },
    update: {},
    create: {
      id: USER_ADMIN,
      email: 'admin@dentzi.ai',
      name: 'Dra. Ana Souza',
      role: 'ADMIN',
      passwordHash,
      emailVerifiedAt: new Date(),
      active: true,
      professionalId: PROF_ANA,
    },
  });

  // Atendente
  await prisma.user.upsert({
    where: { email: 'atendente@dentzi.ai' },
    update: {},
    create: {
      id: USER_ATTENDANT,
      email: 'atendente@dentzi.ai',
      name: 'Maria Atendente',
      role: 'ATTENDANT',
      passwordHash,
      emailVerifiedAt: new Date(),
      active: true,
    },
  });

  console.log('  Created 3 users: superadmin (dev@dentzi.ai), admin (admin@dentzi.ai), atendente (atendente@dentzi.ai).');
  console.log('  All passwords: DentziAdmin2026!');
}

async function seedPermissions() {
  console.log('Seeding permissions...');

  await prisma.permission.deleteMany({});

  type P = { role: 'SUPERADMIN' | 'ADMIN' | 'PROFESSIONAL' | 'ATTENDANT'; resource: string; action: string; scope: 'OWN' | 'ORG' | 'ALL' };
  const perms: P[] = [];

  const resources = ['organizations', 'users', 'clinics', 'professionals', 'services', 'patients', 'appointments', 'conversations', 'settings', 'dashboard'];
  const actions = ['create', 'read', 'update', 'delete'];

  // SUPERADMIN: ALL on everything
  for (const resource of resources) {
    for (const action of actions) {
      perms.push({ role: 'SUPERADMIN', resource, action, scope: 'ALL' });
    }
  }

  // ADMIN: ORG on most things, no organizations
  const adminResources = ['users', 'clinics', 'professionals', 'services', 'patients', 'appointments', 'conversations', 'settings', 'dashboard'];
  for (const resource of adminResources) {
    for (const action of actions) {
      perms.push({ role: 'ADMIN', resource, action, scope: 'ORG' });
    }
  }

  // PROFESSIONAL: OWN read on limited resources
  perms.push({ role: 'PROFESSIONAL', resource: 'professionals', action: 'read', scope: 'OWN' });
  perms.push({ role: 'PROFESSIONAL', resource: 'services', action: 'read', scope: 'ORG' });
  perms.push({ role: 'PROFESSIONAL', resource: 'patients', action: 'read', scope: 'OWN' });
  perms.push({ role: 'PROFESSIONAL', resource: 'appointments', action: 'read', scope: 'OWN' });
  perms.push({ role: 'PROFESSIONAL', resource: 'dashboard', action: 'read', scope: 'OWN' });

  // ATTENDANT
  perms.push({ role: 'ATTENDANT', resource: 'patients', action: 'read', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'appointments', action: 'create', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'appointments', action: 'read', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'appointments', action: 'update', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'conversations', action: 'read', scope: 'ORG' });
  perms.push({ role: 'ATTENDANT', resource: 'dashboard', action: 'read', scope: 'OWN' });

  await prisma.permission.createMany({ data: perms });

  console.log(`  Created ${perms.length} permissions.`);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('=== Dentzi AI Seed Script ===\n');

  await cleanup();
  await seedClinics();
  await seedSpecialties();
  await seedProfessionals();
  await seedProfessionalSpecialties();
  await seedClinicProfessionals();
  await seedServices();
  await seedProfessionalServices();
  await seedPatients();
  await seedAppointments();
  await seedAvailabilityRules();
  await seedUsers();
  await seedPermissions();

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
