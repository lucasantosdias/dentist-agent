import { SERVICE_INTERROGATIVE_PATTERNS } from "@/shared/domain/constants";

/**
 * Backend safety guard for detecting service-informational queries.
 *
 * This runs AFTER LLM classification as a reclassification layer.
 * If the LLM misclassified a service info query as UNKNOWN/GREETING/SMALL_TALK,
 * this function catches it using deterministic pattern + catalog matching.
 *
 * This is NOT a replacement for LLM classification — it's a safety net.
 */

type CatalogService = { service_code: string; name: string };
type CatalogSnapshot = { services: CatalogService[] };

export type ServiceInfoDetection = {
  serviceCode: string | null;
} | null;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Detect if a message is an informational query about a service/procedure.
 *
 * Returns non-null if the message:
 * 1. Matches an interrogative pattern (como funciona, o que é, dói, etc.)
 * 2. References a known service from the catalog OR uses generic procedure terms
 *
 * Returns null if the message is not a service info query.
 */
export function detectServiceInfoIntent(
  text: string,
  catalog: CatalogSnapshot,
): ServiceInfoDetection {
  const n = normalize(text);
  const original = text.toLowerCase();

  // Step 1: Check for interrogative patterns
  const hasInterrogative = SERVICE_INTERROGATIVE_PATTERNS.some(
    (pattern) => pattern.test(original) || pattern.test(n),
  );
  if (!hasInterrogative) return null;

  // Step 2: Match against catalog services
  let matchedServiceCode: string | null = null;
  for (const service of catalog.services) {
    const normalizedCode = normalize(service.service_code);
    const normalizedName = normalize(service.name);
    if (n.includes(normalizedCode) || n.includes(normalizedName)) {
      matchedServiceCode = service.service_code;
      break;
    }
  }

  if (matchedServiceCode) {
    return { serviceCode: matchedServiceCode };
  }

  // Step 3: Check for generic procedural terms
  const hasGenericTerm =
    n.includes("procedimento") ||
    n.includes("tratamento") ||
    n.includes("servico");

  if (hasGenericTerm) {
    return { serviceCode: null };
  }

  return null;
}
