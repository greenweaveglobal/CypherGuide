import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  getProtocolConfig,
  saveProtocolConfig,
  validateBaseFeeRatePcm,
  validateEarlyHostEnrollment,
  DEFAULT_PROTOCOL_CONFIG,
  EarlyHostEnrollment
} from "../lib/configStore";

describe("Protocol Config Store & Validation (RFC-0002 / RFC-0016)", () => {
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-"));
    tempConfigFile = path.join(tempDir, "protocol_config.json");
    const realConfigPath = path.join(process.cwd(), "data", "protocol_config.json");
    if (fs.existsSync(realConfigPath)) {
      fs.copyFileSync(realConfigPath, tempConfigFile);
    }
    process.env.PROTOCOL_CONFIG_PATH = tempConfigFile;
  });

  afterEach(() => {
    delete process.env.PROTOCOL_CONFIG_PATH;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("validates baseFeeRatePcm within protocol bounds (0 to 5000)", () => {
    // Valid cases (0.00% to 50.00%)
    expect(validateBaseFeeRatePcm(0).valid).toBe(true);
    expect(validateBaseFeeRatePcm(200).valid).toBe(true);
    expect(validateBaseFeeRatePcm(5000).valid).toBe(true);
    expect(validateBaseFeeRatePcm("200").valid).toBe(true);
    expect(validateBaseFeeRatePcm("200").pcm).toBe(200);

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

  it("validates early host enrollment per RFC-0002", () => {
    const validNpub = "npub10qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    expect(validateEarlyHostEnrollment(validNpub, []).valid).toBe(true);
    expect(validateEarlyHostEnrollment(validNpub, []).cleanNpub).toBe(validNpub);

    // Invalid npub
    expect(validateEarlyHostEnrollment("invalid", []).valid).toBe(false);
    expect(validateEarlyHostEnrollment("", []).valid).toBe(false);
    expect(validateEarlyHostEnrollment(null, []).valid).toBe(false);

    // Duplicate enrollment
    const existing: EarlyHostEnrollment[] = [{ npub: validNpub, enrolledAt: Date.now(), enrolledBy: "admin" }];
    expect(validateEarlyHostEnrollment(validNpub, existing).valid).toBe(false);
    expect(validateEarlyHostEnrollment(validNpub, existing).error).toContain("already enrolled");

    // Max 20 early hosts
    const twentyHosts: EarlyHostEnrollment[] = Array.from({ length: 20 }, (_, i) => ({
      npub: `npub1host${i}qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq`,
      enrolledAt: Date.now(),
      enrolledBy: "admin"
    }));
    const newHost = "npub1newhostqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    expect(validateEarlyHostEnrollment(newHost, twentyHosts).valid).toBe(false);
    expect(validateEarlyHostEnrollment(newHost, twentyHosts).error).toContain("maximum 20 hosts");
  });

  it("reads and parses protocol config with 200 pcm default and early host fields", async () => {
    expect(DEFAULT_PROTOCOL_CONFIG.baseFeeRatePcm).toBe(200);
    expect(DEFAULT_PROTOCOL_CONFIG.earlyHostFeeRatePcm).toBe(100);
    expect(DEFAULT_PROTOCOL_CONFIG.earlyHosts).toEqual([]);

    const config = await getProtocolConfig();
    expect(config).toHaveProperty("devLnAddress");
    expect(config).toHaveProperty("infraIncentiveTreasuryLightningAddress");
    expect(config).toHaveProperty("baseFeeRatePcm");
    expect(typeof config.baseFeeRatePcm).toBe("number");
    expect(config.baseFeeRatePcm).toBe(200);
    expect(config.earlyHostFeeRatePcm).toBe(100);
    expect(Array.isArray(config.earlyHosts)).toBe(true);
  });

  it("persists and reads back updated protocol config including earlyHosts", async () => {
    const current = await getProtocolConfig();
    const updated = {
      ...current,
      baseFeeRatePcm: 200,
      earlyHosts: [
        { npub: "npub1testqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq", enrolledAt: 1234567, enrolledBy: "admin" }
      ],
      updatedAt: Date.now()
    };

    const saved = await saveProtocolConfig(updated);
    expect(saved).toBe(true);

    const reloaded = await getProtocolConfig();
    expect(reloaded.baseFeeRatePcm).toBe(200);
    expect(reloaded.earlyHosts.length).toBe(1);
    expect(reloaded.earlyHosts[0].npub).toBe("npub1testqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");

    // Restore original
    await saveProtocolConfig(current);
  });
});
