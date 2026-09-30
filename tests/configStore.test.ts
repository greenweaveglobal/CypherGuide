import { describe, it, expect, beforeEach } from "vitest";
import { getProtocolConfig, saveProtocolConfig, validateBaseFeeRatePcm, DEFAULT_PROTOCOL_CONFIG } from "../lib/configStore";

describe("Protocol Config Store & Validation (Nhiệm vụ 5)", () => {
  it("validates baseFeeRatePcm within protocol bounds (0 to 5000)", () => {
    // Valid cases (0.00% to 50.00%)
    expect(validateBaseFeeRatePcm(0).valid).toBe(true);
    expect(validateBaseFeeRatePcm(20).valid).toBe(true);
    expect(validateBaseFeeRatePcm(5000).valid).toBe(true);
    expect(validateBaseFeeRatePcm("50").valid).toBe(true);
    expect(validateBaseFeeRatePcm("50").pcm).toBe(50);

    // Invalid bounds
    expect(validateBaseFeeRatePcm(-1).valid).toBe(false);
    expect(validateBaseFeeRatePcm(5001).valid).toBe(false);
    expect(validateBaseFeeRatePcm(-500).valid).toBe(false);

    // Invalid types / floats
    expect(validateBaseFeeRatePcm(12.5).valid).toBe(false);
    expect(validateBaseFeeRatePcm("abc").valid).toBe(false);
    expect(validateBaseFeeRatePcm(null).valid).toBe(false);
    expect(validateBaseFeeRatePcm(undefined).valid).toBe(false);
  });

  it("reads and parses protocol config with fallback defaults", async () => {
    const config = await getProtocolConfig();
    expect(config).toHaveProperty("devLnAddress");
    expect(config).toHaveProperty("infraIncentiveTreasuryLightningAddress");
    expect(config).toHaveProperty("baseFeeRatePcm");
    expect(typeof config.baseFeeRatePcm).toBe("number");
    expect(config.baseFeeRatePcm).toBeGreaterThanOrEqual(0);
    expect(config.baseFeeRatePcm).toBeLessThanOrEqual(5000);
  });

  it("persists and reads back updated protocol config", async () => {
    const current = await getProtocolConfig();
    const updated = {
      ...current,
      baseFeeRatePcm: 28,
      updatedAt: Date.now()
    };

    const saved = await saveProtocolConfig(updated);
    expect(saved).toBe(true);

    const reloaded = await getProtocolConfig();
    expect(reloaded.baseFeeRatePcm).toBe(28);

    // Restore original
    await saveProtocolConfig(current);
  });
});
