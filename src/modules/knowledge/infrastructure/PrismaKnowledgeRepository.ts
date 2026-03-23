import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  KnowledgeRetrievalPort,
  KnowledgeQuery,
  KnowledgeResult,
} from "@/modules/knowledge/application/ports/KnowledgeRetrievalPort";

/**
 * SQL-first knowledge retrieval.
 *
 * Strategy (in order):
 * 1. Filter by clinic_id IN (clinicId, NULL) — tenant isolation + universal fallback
 * 2. Filter by document_type (when provided)
 * 3. Filter by category (when provided)
 * 4. Keyword match on title+content via ILIKE (when searchText provided)
 * 5. ORDER BY clinic_id DESC NULLS LAST — clinic-specific overrides first
 *
 * Vector ranking (pgvector) is NOT used here — it will be added as a future
 * ranking improvement layer, never as a primary filter.
 */
export class PrismaKnowledgeRepository implements KnowledgeRetrievalPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findRelevant(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const limit = query.limit ?? 3;

    const conditions: Prisma.KnowledgeDocumentWhereInput[] = [
      { active: true },
      {
        OR: [
          { clinicId: query.clinicId },
          { clinicId: null },
        ],
      },
    ];

    if (query.documentType) {
      conditions.push({ documentType: query.documentType });
    }

    if (query.category) {
      conditions.push({ category: { equals: query.category, mode: "insensitive" } });
    }

    if (query.searchText) {
      const searchTerm = query.searchText;
      conditions.push({
        OR: [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { content: { contains: searchTerm, mode: "insensitive" } },
        ],
      });
    }

    const rows = await this.prisma.knowledgeDocument.findMany({
      where: { AND: conditions },
      orderBy: [
        // Clinic-specific first (non-null clinicId sorts before null in desc)
        { clinicId: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      documentType: row.documentType,
      category: row.category,
      isUniversal: row.clinicId === null,
    }));
  }
}
