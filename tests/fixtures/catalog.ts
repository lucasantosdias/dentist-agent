import type { CatalogSnapshot } from "@/modules/conversations/application/ports/IntentHandlerPorts";

export const CLINIC_A_ID = "00000000-0000-0000-0000-000000000001";
export const CLINIC_B_ID = "00000000-0000-0000-0000-000000000002";

export const defaultCatalog: CatalogSnapshot = {
  services: [
    { service_code: "LIMPEZA", name: "Limpeza", duration_min: 30 },
    { service_code: "CLAREAMENTO", name: "Clareamento", duration_min: 60 },
    { service_code: "AVALIACAO", name: "Avaliação", duration_min: 20 },
    { service_code: "CANAL", name: "Canal", duration_min: 90 },
    { service_code: "IMPLANTE", name: "Implante", duration_min: 120 },
  ],
  professionals: [
    { name: "Dr. João" },
    { name: "Dra. Marina" },
    { name: "Dr. Pedro" },
  ],
};

export const clinicBCatalog: CatalogSnapshot = {
  services: [
    { service_code: "LIMPEZA", name: "Limpeza", duration_min: 30 },
    { service_code: "AVALIACAO", name: "Avaliação", duration_min: 20 },
  ],
  professionals: [
    { name: "Dr. Carlos" },
    { name: "Dra. Ana" },
  ],
};
