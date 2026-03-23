export type KnowledgeQuery = {
  clinicId: string;
  documentType?: string;
  category?: string;
  searchText?: string;
  limit?: number;
};

export type KnowledgeResult = {
  id: string;
  title: string;
  content: string;
  documentType: string;
  category: string | null;
  isUniversal: boolean;
};

export interface KnowledgeRetrievalPort {
  findRelevant(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
}
