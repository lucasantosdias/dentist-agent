import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed knowledge documents for RAG v1.
 *
 * These are universal documents (clinicId = null) that apply to all clinics.
 * Clinics can override any document by creating a clinic-specific version
 * with the same documentType + category.
 *
 * Run: npx tsx prisma/seed-knowledge.ts
 */

type KnowledgeDoc = {
  documentType: string;
  category: string;
  title: string;
  content: string;
};

const UNIVERSAL_DOCUMENTS: KnowledgeDoc[] = [
  // ─── LIMPEZA ─────────────────────────────────────────────

  {
    documentType: "PROCEDURE",
    category: "LIMPEZA",
    title: "O que é a limpeza dental",
    content:
      "A limpeza dental, também chamada de profilaxia, é um procedimento preventivo " +
      "que remove a placa bacteriana e o tártaro acumulados nos dentes e na linha da gengiva. " +
      "O dentista utiliza instrumentos como ultrassom e curetas para fazer a remoção, " +
      "seguido de polimento com pasta profilática. O procedimento é indolor na maioria " +
      "dos casos e dura em média de 30 a 45 minutos.",
  },
  {
    documentType: "PREPARATION",
    category: "LIMPEZA",
    title: "Preparo para limpeza dental",
    content:
      "Não é necessário nenhum preparo especial. Recomendamos escovar os dentes " +
      "normalmente antes da consulta. Caso tenha sensibilidade nos dentes, avise " +
      "o profissional antes do início do procedimento.",
  },
  {
    documentType: "FAQ",
    category: "LIMPEZA",
    title: "Perguntas frequentes sobre limpeza dental",
    content:
      "A limpeza dental não dói. Em casos de sensibilidade ou tártaro muito acumulado, " +
      "pode haver um leve desconforto, mas nada que impeça o procedimento. " +
      "A frequência recomendada é a cada 6 meses, mas o dentista pode indicar intervalos " +
      "menores dependendo da saúde bucal do paciente. Após a limpeza, é normal sentir " +
      "os dentes mais lisos e sensíveis por algumas horas.",
  },
  {
    documentType: "RETURN_CYCLE",
    category: "LIMPEZA",
    title: "Retorno recomendado para limpeza",
    content:
      "O retorno recomendado para limpeza dental é a cada 6 meses. Pacientes com " +
      "histórico de doença periodontal ou acúmulo rápido de tártaro podem precisar " +
      "retornar a cada 3 ou 4 meses, conforme orientação do dentista.",
  },

  // ─── CLAREAMENTO ─────────────────────────────────────────

  {
    documentType: "PROCEDURE",
    category: "CLAREAMENTO",
    title: "O que é o clareamento dental",
    content:
      "O clareamento dental é um procedimento estético que clareia a cor dos dentes " +
      "utilizando agentes clareadores à base de peróxido. Pode ser feito em consultório " +
      "(com concentrações mais altas e resultado mais rápido) ou com moldeiras de uso " +
      "caseiro supervisionado. O clareamento em consultório dura cerca de 60 a 90 minutos " +
      "e pode precisar de 1 a 3 sessões dependendo do resultado desejado.",
  },
  {
    documentType: "PREPARATION",
    category: "CLAREAMENTO",
    title: "Preparo para clareamento dental",
    content:
      "Antes do clareamento, é necessário fazer uma avaliação bucal e uma limpeza. " +
      "Dentes com cáries ou restaurações expostas precisam ser tratados antes do " +
      "procedimento. Recomenda-se evitar alimentos e bebidas com corantes fortes " +
      "(café, vinho, açaí) nas 48 horas seguintes ao clareamento.",
  },
  {
    documentType: "FAQ",
    category: "CLAREAMENTO",
    title: "Perguntas frequentes sobre clareamento",
    content:
      "O clareamento pode causar sensibilidade temporária nos dentes, que normalmente " +
      "desaparece em poucos dias. O resultado dura de 1 a 3 anos dependendo dos hábitos " +
      "alimentares e de higiene. Gestantes e menores de 16 anos não devem realizar o " +
      "procedimento. Restaurações e próteses não clareiam junto com os dentes naturais.",
  },

  // ─── AVALIAÇÃO ───────────────────────────────────────────

  {
    documentType: "PROCEDURE",
    category: "AVALIACAO",
    title: "O que é a avaliação odontológica",
    content:
      "A avaliação odontológica é uma consulta inicial onde o dentista examina " +
      "a saúde bucal do paciente, verifica dentes, gengivas, mordida e possíveis " +
      "problemas. Pode incluir radiografias se necessário. A avaliação dura em " +
      "média 20 a 30 minutos e serve como base para o plano de tratamento.",
  },
  {
    documentType: "FAQ",
    category: "AVALIACAO",
    title: "Perguntas frequentes sobre avaliação",
    content:
      "A avaliação é o primeiro passo recomendado para qualquer tratamento dentário. " +
      "Não dói e não requer preparo especial. É ideal para quem não vai ao dentista " +
      "há muito tempo ou está sentindo algum incômodo. A avaliação ajuda a identificar " +
      "problemas precocemente, evitando tratamentos mais complexos no futuro.",
  },

  // ─── CANAL ───────────────────────────────────────────────

  {
    documentType: "PROCEDURE",
    category: "CANAL",
    title: "O que é o tratamento de canal",
    content:
      "O tratamento de canal (endodontia) é realizado quando a polpa do dente está " +
      "inflamada ou infectada. O dentista remove o tecido comprometido, limpa e " +
      "desinfeta os canais radiculares e preenche com material obturador. O procedimento " +
      "é feito com anestesia local e pode levar de 1 a 3 sessões, com duração média " +
      "de 60 a 90 minutos cada.",
  },
  {
    documentType: "FAQ",
    category: "CANAL",
    title: "Perguntas frequentes sobre canal",
    content:
      "O tratamento de canal é realizado com anestesia local, então o paciente " +
      "não sente dor durante o procedimento. Após o tratamento, pode haver " +
      "sensibilidade por alguns dias, controlada com medicação. O dente tratado " +
      "geralmente precisa receber uma coroa para proteção. Sem tratamento, a " +
      "infecção pode se espalhar e levar à perda do dente.",
  },
  {
    documentType: "PREPARATION",
    category: "CANAL",
    title: "Preparo para tratamento de canal",
    content:
      "Não é necessário jejum. Se estiver tomando antibióticos, continue conforme " +
      "prescrição médica. Informe o dentista sobre medicamentos em uso, alergias " +
      "e condições de saúde. Evite consumir álcool nas 24 horas anteriores.",
  },

  // ─── IMPLANTE ────────────────────────────────────────────

  {
    documentType: "PROCEDURE",
    category: "IMPLANTE",
    title: "O que é o implante dentário",
    content:
      "O implante dentário é um pino de titânio que substitui a raiz de um dente " +
      "perdido. É fixado cirurgicamente no osso da mandíbula ou maxila, e sobre ele " +
      "é colocada uma coroa protética que imita o dente natural. O procedimento " +
      "cirúrgico dura de 1 a 2 horas e a cicatrização óssea (osseointegração) " +
      "leva de 3 a 6 meses.",
  },
  {
    documentType: "FAQ",
    category: "IMPLANTE",
    title: "Perguntas frequentes sobre implante",
    content:
      "O implante é feito com anestesia local e o paciente não sente dor durante " +
      "a cirurgia. A recuperação pós-operatória envolve inchaço leve por alguns dias " +
      "e restrição alimentar temporária. A taxa de sucesso dos implantes é superior " +
      "a 95%. Pacientes fumantes ou com diabetes descontrolada precisam de avaliação " +
      "mais cuidadosa. O implante pode durar a vida inteira com cuidados adequados.",
  },
  {
    documentType: "PREPARATION",
    category: "IMPLANTE",
    title: "Preparo para implante dentário",
    content:
      "Antes do implante, é necessário fazer uma avaliação completa com radiografia " +
      "panorâmica ou tomografia. O dentista avaliará a qualidade e quantidade de osso " +
      "disponível. Pode ser necessário realizar enxerto ósseo antes do implante. " +
      "No dia da cirurgia, faça uma refeição leve e evite jejum prolongado.",
  },
];

async function seedKnowledge() {
  console.log("Seeding knowledge documents...");

  // Delete existing universal knowledge documents
  await prisma.knowledgeDocument.deleteMany({
    where: { clinicId: null },
  });

  // Insert all universal documents
  for (const doc of UNIVERSAL_DOCUMENTS) {
    await prisma.knowledgeDocument.create({
      data: {
        clinicId: null,
        documentType: doc.documentType,
        category: doc.category,
        title: doc.title,
        content: doc.content,
        metadata: {},
        active: true,
      },
    });
  }

  console.log(`Seeded ${UNIVERSAL_DOCUMENTS.length} universal knowledge documents.`);
}

seedKnowledge()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Failed to seed knowledge:", e);
    prisma.$disconnect();
    process.exit(1);
  });
