import { InMemoryKnowledgeRepository } from "../../fixtures/mocks/InMemoryKnowledgeRepository";

describe("Knowledge retrieval (SQL-first strategy)", () => {
  let repo: InMemoryKnowledgeRepository;

  beforeEach(() => {
    repo = new InMemoryKnowledgeRepository();

    // Universal documents
    repo.addDocument({
      clinicId: null,
      documentType: "PROCEDURE",
      category: "limpeza",
      title: "Limpeza dental",
      content: "A limpeza dental (profilaxia) é um procedimento preventivo.",
    });
    repo.addDocument({
      clinicId: null,
      documentType: "PROCEDURE",
      category: "canal",
      title: "Tratamento de canal",
      content: "O tratamento de canal é realizado com anestesia local.",
    });
    repo.addDocument({
      clinicId: null,
      documentType: "FAQ",
      category: "geral",
      title: "Dói fazer canal?",
      content: "O paciente pode sentir leve desconforto após o procedimento.",
    });

    // Clinic-specific override
    repo.addDocument({
      clinicId: "clinic-A",
      documentType: "POLICY",
      category: "agendamento",
      title: "Política de cancelamento",
      content: "Cancelamentos devem ser feitos com 24h de antecedência.",
    });

    // Clinic-specific procedure override
    repo.addDocument({
      clinicId: "clinic-A",
      documentType: "PROCEDURE",
      category: "limpeza",
      title: "Limpeza dental (customizado)",
      content: "Na Clínica A, a limpeza inclui avaliação periodontal.",
    });

    // Different clinic's document
    repo.addDocument({
      clinicId: "clinic-B",
      documentType: "POLICY",
      category: "agendamento",
      title: "Política Clínica B",
      content: "Clínica B permite cancelamentos em até 1h antes.",
    });
  });

  it("returns universal documents when no clinic-specific exists", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-C",
      documentType: "PROCEDURE",
      category: "canal",
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Tratamento de canal");
    expect(results[0].isUniversal).toBe(true);
  });

  it("returns clinic-specific document before universal", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-A",
      documentType: "PROCEDURE",
      category: "limpeza",
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    // Clinic-specific should come first
    expect(results[0].title).toContain("customizado");
    expect(results[0].isUniversal).toBe(false);
  });

  it("filters by document_type", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-A",
      documentType: "POLICY",
    });

    expect(results).toHaveLength(1);
    expect(results[0].documentType).toBe("POLICY");
    expect(results[0].content).toContain("24h");
  });

  it("enforces tenant isolation — clinic-B docs not visible to clinic-A", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-A",
      documentType: "POLICY",
    });

    for (const doc of results) {
      expect(doc.content).not.toContain("Clínica B");
    }
  });

  it("keyword search matches title and content", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-C",
      searchText: "anestesia",
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Tratamento de canal");
  });

  it("respects limit parameter", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-A",
      limit: 1,
    });

    expect(results).toHaveLength(1);
  });

  it("returns empty for non-matching query", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-A",
      documentType: "RETURN_CYCLE",
    });

    expect(results).toHaveLength(0);
  });

  it("category filter is case-insensitive", async () => {
    const results = await repo.findRelevant({
      clinicId: "clinic-C",
      documentType: "PROCEDURE",
      category: "LIMPEZA",
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toContain("Limpeza");
  });
});
