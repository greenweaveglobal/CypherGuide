import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("Vercel Serverless ESM Module Resolution & Smoke Test (Round 4)", () => {
  const outDir = path.resolve(process.cwd(), ".test-vercel-esm");

  beforeAll(() => {
    // Compile api/ and lib/ and constants files to ESM without bundling, matching Vercel's Node ESM execution
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
    execSync(
      `npx esbuild api/**/*.ts lib/**/*.ts src/constants/adminPubkeys.ts --format=esm --platform=node --packages=external --outdir="${outDir}"`,
      { stdio: "pipe" }
    );
  });

  afterAll(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("loads api/protocol/config.js in native Node ESM without ERR_MODULE_NOT_FOUND and GET returns 200", async () => {
    const configPath = path.join(outDir, "api/protocol/config.js");
    const mod = await import(configPath);
    expect(typeof mod.default).toBe("function");

    // Execute GET handler
    let statusCode = 0;
    let responseData: any = null;
    const req = { method: "GET", headers: {} };
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
      setHeader() {}
    };

    await mod.default(req, res);
    expect(statusCode).toBe(200);
    expect(responseData).toHaveProperty("baseFeeRatePcm");
  });

  it("loads api/protocol/fee.js in native Node ESM without ERR_MODULE_NOT_FOUND", async () => {
    const feePath = path.join(outDir, "api/protocol/fee.js");
    const mod = await import(feePath);
    expect(typeof mod.default).toBe("function");
  });

  it("loads api/docs-assistant/query.js in native Node ESM and handles empty body with 400", async () => {
    const queryPath = path.join(outDir, "api/docs-assistant/query.js");
    const mod = await import(queryPath);
    expect(typeof mod.default).toBe("function");

    let statusCode = 0;
    let responseData: any = null;
    const req = { method: "POST", headers: { "x-forwarded-for": "127.0.0.1" }, body: {} };
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
      setHeader() {}
    };

    await mod.default(req, res);
    expect(statusCode).toBe(400);
    expect(responseData?.error).toContain("Missing or invalid question");
  });

  it("loads api/lightning/resolve-invoice.js in native Node ESM without ERR_MODULE_NOT_FOUND", async () => {
    const resolvePath = path.join(outDir, "api/lightning/resolve-invoice.js");
    const mod = await import(resolvePath);
    expect(typeof mod.default).toBe("function");
  });

  it("strictly ensures zero relative imports in api/ and lib/ lack the .js extension", () => {
    const output = execSync(
      `grep -rnE 'from\\s+["'"'"']\\.[^"'"'"']+' api/ lib/ | grep -v '\\.js["'"'"']' || true`,
      { encoding: "utf8" }
    ).trim();
    expect(output).toBe("");
  });
});
