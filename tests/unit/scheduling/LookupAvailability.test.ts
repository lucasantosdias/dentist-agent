import { jest } from "@jest/globals";
import { LookupAvailabilityUseCase } from "@/modules/scheduling/application/usecases/LookupAvailabilityUseCase";
import type { CatalogRepositoryPort } from "@/modules/catalog/application/ports/CatalogRepositoryPort";
import type { ProposeSlotsInput } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import { ProposeSlotsUseCase } from "@/modules/scheduling/application/usecases/ProposeSlotsUseCase";
import { SchedulingPolicies } from "@/modules/scheduling/domain/SchedulingPolicies";
import type { TimeSlot } from "@/modules/scheduling/application/dto/SchedulingDtos";

// ─── Test helpers ──────────────────────────────────────────

const policies = new SchedulingPolicies({
  holdTtlMinutes: 10,
  stepMinutes: 30,
  workingHourStart: 8,
  workingHourEnd: 19,
  timezoneOffsetMinutes: -180,
});

function makeDate(day: number, hour: number, minute = 0): Date {
  // 2026-03-{day}T{hour}:{minute}:00 in UTC (which is +3 from São Paulo)
  return new Date(Date.UTC(2026, 2, day, hour + 3, minute, 0));
}

const now = makeDate(20, 10); // March 20, 10:00 São Paulo

type SlotConfig = Record<string, TimeSlot[]>; // professionalId → slots

function buildMocks(slotsByProfessional: SlotConfig) {
  const professionals = Object.keys(slotsByProfessional).map((id, i) => ({
    id,
    displayName: `Dr. Test ${i + 1}`,
    name: `Dr. Test ${i + 1}`,
    email: null,
    phone: null,
    timezone: "America/Sao_Paulo",
    active: true,
  }));

  const catalogRepo = {
    listActiveProfessionalsForService: jest.fn<() => Promise<typeof professionals>>().mockResolvedValue(professionals),
  } as unknown as CatalogRepositoryPort;

  const proposeSlotsUseCase = {
    execute: jest.fn<(input: ProposeSlotsInput) => Promise<TimeSlot[]>>().mockImplementation((input) => {
      const slots = slotsByProfessional[input.professionalId] ?? [];
      return Promise.resolve(slots.slice(0, input.limit ?? 3));
    }),
  } as unknown as ProposeSlotsUseCase;

  const useCase = new LookupAvailabilityUseCase(catalogRepo, proposeSlotsUseCase, policies);

  return { useCase, catalogRepo, proposeSlotsUseCase };
}

// ─── Tests ─────────────────────────────────────────────────

describe("LookupAvailabilityUseCase", () => {
  describe("Mode 1 — target date provided", () => {
    it("returns slots grouped by professional for a specific date", async () => {
      const tomorrow = makeDate(21, 0);
      const { useCase } = buildMocks({
        "prof-1": [
          { startsAt: makeDate(21, 8), endsAt: makeDate(21, 8, 30) },
          { startsAt: makeDate(21, 9), endsAt: makeDate(21, 9, 30) },
        ],
        "prof-2": [
          { startsAt: makeDate(21, 10), endsAt: makeDate(21, 10, 30) },
        ],
      });

      const result = await useCase.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: tomorrow,
        now,
      });

      expect(result.availability).toHaveLength(2);
      expect(result.availability[0].professionalName).toBe("Dr. Test 1");
      expect(result.availability[0].slots).toHaveLength(2);
      expect(result.availability[1].professionalName).toBe("Dr. Test 2");
      expect(result.availability[1].slots).toHaveLength(1);
      expect(result.searchedDate).toEqual(tomorrow);
    });

    it("excludes professionals with no availability on the target date", async () => {
      const tomorrow = makeDate(21, 0);
      const { useCase } = buildMocks({
        "prof-1": [
          { startsAt: makeDate(21, 8), endsAt: makeDate(21, 8, 30) },
        ],
        "prof-2": [], // No availability
      });

      const result = await useCase.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: tomorrow,
        now,
      });

      expect(result.availability).toHaveLength(1);
      expect(result.availability[0].professionalName).toBe("Dr. Test 1");
    });

    it("returns empty when no professionals have availability", async () => {
      const tomorrow = makeDate(21, 0);
      const { useCase } = buildMocks({
        "prof-1": [],
        "prof-2": [],
      });

      const result = await useCase.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: tomorrow,
        now,
      });

      expect(result.availability).toHaveLength(0);
    });
  });

  describe("Mode 2 — forward search (no date)", () => {
    it("finds earliest slot per professional across multiple days", async () => {
      const { useCase, proposeSlotsUseCase } = buildMocks({});

      // Override the mock to simulate day-by-day search
      let callCount = 0;
      (proposeSlotsUseCase.execute as jest.Mock<(input: ProposeSlotsInput) => Promise<TimeSlot[]>>).mockImplementation((input) => {
        callCount++;
        if (input.professionalId === "prof-1") {
          if (input.requestedStartsAt && input.requestedStartsAt.getUTCDate() === 22) {
            return Promise.resolve([{ startsAt: makeDate(22, 9), endsAt: makeDate(22, 9, 30) }]);
          }
          return Promise.resolve([]);
        }
        if (input.professionalId === "prof-2") {
          if (input.requestedStartsAt && input.requestedStartsAt.getUTCDate() === 21) {
            return Promise.resolve([{ startsAt: makeDate(21, 14), endsAt: makeDate(21, 14, 30) }]);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const profs = [
        { id: "prof-1", name: "Dra. Ana", displayName: "Dra. Ana", email: null, phone: null, timezone: "America/Sao_Paulo", active: true },
        { id: "prof-2", name: "Dr. João", displayName: "Dr. João", email: null, phone: null, timezone: "America/Sao_Paulo", active: true },
      ];

      const catalogRepo = {
        listActiveProfessionalsForService: jest.fn<() => Promise<typeof profs>>().mockResolvedValue(profs),
      } as unknown as CatalogRepositoryPort;

      const uc = new LookupAvailabilityUseCase(catalogRepo, proposeSlotsUseCase, policies);

      const result = await uc.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: null,
        now,
      });

      // Forward search finds the FIRST day with availability (March 21)
      // Only prof-2 has slots on March 21; prof-1 has slots on March 22 but
      // the search stops at the first available day.
      expect(result.availability).toHaveLength(1);
      expect(result.availability[0].professionalName).toBe("Dr. João");
      expect(result.searchedDate).not.toBeNull();
    });

    it("skips professionals with no availability in forward search window", async () => {
      const { useCase, proposeSlotsUseCase } = buildMocks({});

      (proposeSlotsUseCase.execute as jest.Mock<() => Promise<TimeSlot[]>>).mockResolvedValue([]);

      const profList = [
        { id: "prof-1", name: "Dr. X", displayName: "Dr. X", email: null, phone: null, timezone: "America/Sao_Paulo", active: true },
      ];

      const catalogRepo = {
        listActiveProfessionalsForService: jest.fn<() => Promise<typeof profList>>().mockResolvedValue(profList),
      } as unknown as CatalogRepositoryPort;

      const uc = new LookupAvailabilityUseCase(catalogRepo, proposeSlotsUseCase, policies);

      const result = await uc.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: null,
        now,
        maxForwardDays: 3,
      });

      expect(result.availability).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("returns empty when no professionals can perform the service", async () => {
      const emptyList: never[] = [];
      const catalogRepo = {
        listActiveProfessionalsForService: jest.fn<() => Promise<typeof emptyList>>().mockResolvedValue(emptyList),
      } as unknown as CatalogRepositoryPort;

      const proposeSlotsUseCase = {
        execute: jest.fn<() => Promise<TimeSlot[]>>(),
      } as unknown as ProposeSlotsUseCase;

      const uc = new LookupAvailabilityUseCase(catalogRepo, proposeSlotsUseCase, policies);

      const result = await uc.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: makeDate(21, 0),
        now,
      });

      expect(result.availability).toHaveLength(0);
      expect(proposeSlotsUseCase.execute).not.toHaveBeenCalled();
    });

    it("filters by professionalId when provided", async () => {
      const tomorrow = makeDate(21, 0);
      const { useCase } = buildMocks({
        "prof-1": [
          { startsAt: makeDate(21, 8), endsAt: makeDate(21, 8, 30) },
        ],
        "prof-2": [
          { startsAt: makeDate(21, 14), endsAt: makeDate(21, 14, 30) },
        ],
      });

      const result = await useCase.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: tomorrow,
        now,
        professionalId: "prof-1",
      });

      // Only prof-1 slots should be returned
      expect(result.availability).toHaveLength(1);
      expect(result.availability[0].professionalId).toBe("prof-1");
    });

    it("respects maxSlotsPerProfessional", async () => {
      const { useCase } = buildMocks({
        "prof-1": [
          { startsAt: makeDate(21, 8), endsAt: makeDate(21, 8, 30) },
          { startsAt: makeDate(21, 9), endsAt: makeDate(21, 9, 30) },
          { startsAt: makeDate(21, 10), endsAt: makeDate(21, 10, 30) },
          { startsAt: makeDate(21, 11), endsAt: makeDate(21, 11, 30) },
        ],
      });

      const result = await useCase.execute({
        clinicId: "clinic-1",
        serviceId: "svc-1",
        serviceDurationMin: 30,
        targetDate: makeDate(21, 0),
        now,
        maxSlotsPerProfessional: 2,
      });

      expect(result.availability[0].slots).toHaveLength(2);
    });
  });
});
