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

  it("validates early host enrollment per RFC-0002 / Round 13", () => {
    // Valid npub with authentic bech32 checksum
    const validNpub = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqshp52w2";
    const res = validateEarlyHostEnrollment(validNpub, []);
    expect(res.valid).toBe(true);
    expect(res.cleanNpub).toBe(validNpub);
    expect(res.cleanHex).toBeTruthy();

    // Valid 64-char hex pubkey
    const validHex = "0000000000000000000000000000000000000000000000000000000000000000";
    const hexRes = validateEarlyHostEnrollment(validHex, []);
    expect(hexRes.valid).toBe(true);
    expect(hexRes.cleanHex).toBe(validHex);

    // Invalid npub (bad checksum or invalid format)
    expect(validateEarlyHostEnrollment("invalid", []).valid).toBe(false);
    expect(validateEarlyHostEnrollment("npub10qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqx", []).valid).toBe(false);
    expect(validateEarlyHostEnrollment("", []).valid).toBe(false);
    expect(validateEarlyHostEnrollment(null, []).valid).toBe(false);

    // Duplicate enrollment: matching hex or matching npub
    const existing: EarlyHostEnrollment[] = [{ npub: res.cleanHex!, enrolledAt: Date.now(), enrolledBy: "admin" }];
    // Re-enrolling with npub or hex is recognized as duplicate
    expect(validateEarlyHostEnrollment(validNpub, existing).valid).toBe(false);
    expect(validateEarlyHostEnrollment(res.cleanHex!, existing).valid).toBe(false);
    expect(validateEarlyHostEnrollment(validNpub, existing).error).toContain("already enrolled");

    // Max 20 early hosts: active limit enforced, expired does not consume quota
    const now = Date.now();
    const twentyActiveHosts: EarlyHostEnrollment[] = Array.from({ length: 20 }, (_, i) => ({
      npub: `00000000000000000000000000000000000000000000000000000000000000${i.toString(16).padStart(2, '0')}`,
      enrolledAt: now - 1000,
      enrolledBy: "admin"
    }));
    const newHost = "1111111111111111111111111111111111111111111111111111111111111111";
    expect(validateEarlyHostEnrollment(newHost, twentyActiveHosts, { maxEnrolled: 20, now }).valid).toBe(false);

    // If 1 host is expired (> 365 days), active quota is 19 -> new host is accepted!
    const hostsWithOneExpired = [
      ...twentyActiveHosts.slice(0, 19),
      {
        npub: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        enrolledAt: now - 400 * 24 * 60 * 60 * 1000, // 400 days ago
        enrolledBy: "admin"
      }
    ];
    expect(validateEarlyHostEnrollment(newHost, hostsWithOneExpired, { maxEnrolled: 20, durationDays: 365, now }).valid).toBe(true);
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
