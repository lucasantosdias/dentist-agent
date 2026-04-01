import type { CatalogSnapshot } from "@/modules/conversations/application/ports/IntentHandlerPorts";

export const CLINIC_A_ID = "00000000-0000-0000-0000-000000000001";
export const CLINIC_B_ID = "00000000-0000-0000-0000-000000000002";

export const defaultCatalog: CatalogSnapshot = {
  services: [
    { id: "a0000000-0000-0000-0000-000000000001", service_code: "LIMPEZA", name: "Limpeza", duration_min: 30 },
    { id: "a0000000-0000-0000-0000-000000000002", service_code: "CLAREAMENTO", name: "Clareamento", duration_min: 60 },
    { id: "a0000000-0000-0000-0000-000000000003", service_code: "AVALIACAO", name: "Avaliação", duration_min: 20 },
    { id: "a0000000-0000-0000-0000-000000000004", service_code: "CANAL", name: "Canal", duration_min: 90 },
    { id: "a0000000-0000-0000-0000-000000000005", service_code: "IMPLANTE", name: "Implante", duration_min: 120 },
  ],
  professionals: [
    { id: "b0000000-0000-0000-0000-000000000001", name: "Dr. João" },
    { id: "b0000000-0000-0000-0000-000000000002", name: "Dra. Marina" },
    { id: "b0000000-0000-0000-0000-000000000003", name: "Dr. Pedro" },
  ],
};

export const clinicBCatalog: CatalogSnapshot = {
  services: [
    { id: "a0000000-0000-0000-0000-000000000011", service_code: "LIMPEZA", name: "Limpeza", duration_min: 30 },
    { id: "a0000000-0000-0000-0000-000000000012", service_code: "AVALIACAO", name: "Avaliação", duration_min: 20 },
  ],
  professionals: [
    { id: "b0000000-0000-0000-0000-000000000011", name: "Dr. Carlos" },
    { id: "b0000000-0000-0000-0000-000000000012", name: "Dra. Ana" },
  ],
};
