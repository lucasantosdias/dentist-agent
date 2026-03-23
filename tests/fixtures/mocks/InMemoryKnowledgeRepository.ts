import type {
  KnowledgeRetrievalPort,
  KnowledgeQuery,
  KnowledgeResult,
} from "@/modules/knowledge/application/ports/KnowledgeRetrievalPort";

type StoredDocument = KnowledgeResult & { clinicId: string | null };

export class InMemoryKnowledgeRepository implements KnowledgeRetrievalPort {
  private documents: StoredDocument[] = [];

  async findRelevant(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    let results = this.documents.filter((doc) => {
      // Tenant isolation: clinic-specific + universal
      if (doc.clinicId !== null && doc.clinicId !== query.clinicId) return false;
      return true;
    });

    if (query.documentType) {
      results = results.filter((d) => d.documentType === query.documentType);
    }

    if (query.category) {
      results = results.filter(
        (d) => d.category?.toLowerCase() === query.category!.toLowerCase(),
      );
    }

    if (query.searchText) {
      const term = query.searchText.toLowerCase();
      results = results.filter(
        (d) =>
          d.title.toLowerCase().includes(term) ||
          d.content.toLowerCase().includes(term),
      );
    }

    // Clinic-specific first
    results.sort((a, b) => {
      if (a.clinicId && !b.clinicId) return -1;
      if (!a.clinicId && b.clinicId) return 1;
      return 0;
    });

    return results.slice(0, query.limit ?? 3);
  }

  /** Test helper: add a document */
  addDocument(doc: {
    clinicId: string | null;
    documentType: string;
    category?: string | null;
    title: string;
    content: string;
  }): void {
    this.documents.push({
      id: `doc-${this.documents.length + 1}`,
      clinicId: doc.clinicId,
      title: doc.title,
      content: doc.content,
      documentType: doc.documentType,
      category: doc.category ?? null,
      isUniversal: doc.clinicId === null,
    });
  }

  clear(): void {
    this.documents = [];
  }
}
