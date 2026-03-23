import { buildConversation } from "../../factories/ConversationFactory";

describe("Conversation domain entity", () => {
  describe("transition", () => {
    it("transitions from AUTO to WAITING", () => {
      const conv = buildConversation({ state: "AUTO" });
      conv.transition("WAITING");
      expect(conv.state).toBe("WAITING");
    });

    it("transitions from AUTO to HUMAN", () => {
      const conv = buildConversation({ state: "AUTO" });
      conv.transition("HUMAN");
      expect(conv.state).toBe("HUMAN");
    });

    it("transitions from AUTO to FINALIZADA", () => {
      const conv = buildConversation({ state: "AUTO" });
      conv.transition("FINALIZADA");
      expect(conv.state).toBe("FINALIZADA");
    });

    it("throws when transitioning from FINALIZADA to active state", () => {
      const conv = buildConversation({ state: "FINALIZADA" });
      expect(() => conv.transition("AUTO")).toThrow("FINALIZADA");
    });

    it("allows FINALIZADA to FINALIZADA (idempotent)", () => {
      const conv = buildConversation({ state: "FINALIZADA" });
      conv.transition("FINALIZADA");
      expect(conv.state).toBe("FINALIZADA");
    });
  });

  describe("touchMessage", () => {
    it("increments attempts and sets lastMessageAt", () => {
      const conv = buildConversation({ attempts: 0 });
      conv.touchMessage();
      expect(conv.attempts).toBe(1);
      expect(conv.lastMessageAt).toBeInstanceOf(Date);
    });
  });

  describe("setCurrentIntent", () => {
    it("sets the current intent", () => {
      const conv = buildConversation();
      conv.setCurrentIntent("BOOK_APPOINTMENT");
      expect(conv.currentIntent).toBe("BOOK_APPOINTMENT");
    });
  });

  describe("setCollectedData", () => {
    it("sets collected data", () => {
      const conv = buildConversation();
      conv.setCollectedData({ full_name: "Lucas" });
      expect(conv.collectedData).toEqual({ full_name: "Lucas" });
    });
  });

  describe("resetContext", () => {
    it("clears all transient conversation data", () => {
      const conv = buildConversation({
        currentIntent: "BOOK_APPOINTMENT",
        collectedData: { full_name: "Lucas" },
        missingRequirements: ["care_type"],
        currentFunnelStep: "COLLECTING_DATA",
      });
      conv.resetContext();
      expect(conv.currentIntent).toBeNull();
      expect(conv.collectedData).toEqual({});
      expect(conv.missingRequirements).toEqual([]);
      expect(conv.currentFunnelStep).toBeNull();
    });
  });
});
