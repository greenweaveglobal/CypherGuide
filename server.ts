import express from "express";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import crypto from "crypto";
import { verifyEvent, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import { queryDocsAssistant } from "./lib/docsAssistant";
import { resolveLightningInvoice } from "./lib/lnurlResolver";
import { corsMiddleware } from "./lib/cors";
import { docsRateLimiter, uploadRateLimiter, lnurlRateLimiter } from "./lib/rateLimit";
import { verifyNip98Auth, validateNip98Auth } from "./lib/adminAuth";
import { getProtocolConfig, saveProtocolConfig, validateBaseFeeRatePcm } from "./lib/configStore";

const PROTOCOL_RELAYS = [
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
  "wss://offchain.pub"
];

// Re-export validateNip98Auth for backward compatibility if imported elsewhere
export { validateNip98Auth };

/**
 * Validates authentic image binary signatures (magic bytes) to prevent Stored XSS and non-image payloads
 */
interface ImageValidationResult {
  valid: boolean;
  mime?: string;
  ext?: string;
  error?: string;
}

function validateImageMagicBytes(filePath: string): ImageValidationResult {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      return { valid: false, error: "File too small to inspect binary header." };
    }

    // JPEG / JPG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true, mime: "image/jpeg", ext: ".jpg" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytesRead >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    ) {
      return { valid: true, mime: "image/png", ext: ".png" };
    }

    // GIF: "GIF87a" (47 49 46 38 37 61) or "GIF89a" (47 49 46 38 39 61)
    if (
      bytesRead >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return { valid: true, mime: "image/gif", ext: ".gif" };
    }

    // WEBP: RIFF .... WEBP
    if (
      bytesRead >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { valid: true, mime: "image/webp", ext: ".webp" };
    }

    return {
      valid: false,
      error: "Invalid file format. Only authentic binary JPEG, PNG, WEBP, and GIF images are allowed. SVG and non-images are strictly prohibited."
    };
  } catch (err: any) {
    return { valid: false, error: err.message || "Failed to inspect file magic bytes." };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for reverse proxy IP extraction (Rate limiters & audit logs)
  app.set('trust proxy', 1);

  // Security Headers via Helmet (relaxed CSP for Vite SPA client)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(express.json({ limit: "2mb" }));

  // Strict CORS configuration for API endpoints via lib/cors
  app.use("/api", corsMiddleware());

  // API endpoint for Documentation Lookup Assistant (RFC-0005) - Unified via lib/docsAssistant
  const docsQueryHandler = async (req: express.Request, res: express.Response) => {
    try {
      const question = req.body?.question || req.query?.question;
      const locale = req.body?.locale || req.query?.locale;

      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Missing or invalid question parameter." });
      }

      if (question.length > 500) {
        return res.status(400).json({ error: "Question exceeds maximum allowed length of 500 characters." });
      }

      const result = await queryDocsAssistant(question, locale);
      return res.json(result);
    } catch (error: any) {
      console.error("Error in /api/docs-assistant/query:", error);
      return res.status(500).json({
        error: "Internal server error during documentation query.",
        message: error.message || String(error)
      });
    }
  };

  app.all("/api/docs-assistant/query", docsRateLimiter.middleware(), docsQueryHandler);
  app.all("/api/docs-assistant/query/", docsRateLimiter.middleware(), docsQueryHandler);

  // API: Get protocol config (devLnAddress, infraIncentiveTreasuryLightningAddress, baseFeeRatePcm, etc.)
  app.get("/api/protocol/config", async (_req, res) => {
    const config = await getProtocolConfig();
    res.json({
      ...config,
      baseFeeRatePcm: typeof config.baseFeeRatePcm === "number" ? config.baseFeeRatePcm : 20,
      configAuditNostrEventId: config.configAuditNostrEventId || ""
    });
  });

  // API: Update protocol dynamic fee rate (baseFeeRatePcm) - Strictly guarded by NIP-98 authentication
  app.patch("/api/protocol/fee", async (req, res) => {
    try {
      // 1. Strict NIP-98 Auth check (Kind 27235 signed by authorized admin key)
      const auth = await verifyNip98Auth(req, "/api/protocol/fee", "PATCH");
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { baseFeeRatePcm, auditEvent } = req.body || {};

      const validation = validateBaseFeeRatePcm(baseFeeRatePcm);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error || "baseFeeRatePcm must be an integer between 0 and 5000 (0.0% - 50.0%)."
        });
      }

      const current = await getProtocolConfig();
      const oldFeeRatePcm = typeof current.baseFeeRatePcm === "number" ? current.baseFeeRatePcm : 20;
      const now = Date.now();
      const feeUpdatedBy = auth.pubkey || "";

      // 2. Validate and broadcast audit Nostr event if provided
      let auditEventId = "";
      if (auditEvent && typeof auditEvent === "object") {
        try {
          const isValidAuditSig = verifyEvent(auditEvent);
          if (isValidAuditSig && auditEvent.pubkey === auth.pubkey) {
            auditEventId = auditEvent.id;
            // Broadcast to Nostr protocol relays asynchronously (best-effort)
            const pool = new SimplePool();
            try {
              const pubPromises = pool.publish(PROTOCOL_RELAYS, auditEvent);
              Promise.allSettled(pubPromises).then(() => {
                pool.close(PROTOCOL_RELAYS);
              }).catch(() => {});
            } catch (pErr) {
              console.warn("Failed to broadcast audit event to relays:", pErr);
            }
          } else {
            console.warn("Audit event signature invalid or pubkey mismatch with NIP-98 event.");
          }
        } catch (vErr) {
          console.warn("Failed to verify audit event:", vErr);
        }
      }

      const updated = {
        ...current,
        baseFeeRatePcm: validation.pcm!,
        feeUpdatedAt: now,
        feeUpdatedBy,
        feeAuditNostrEventId: auditEventId || current.feeAuditNostrEventId || "",
        updatedAt: now,
        updatedBy: feeUpdatedBy
      };

      const saved = await saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist protocol fee configuration to storage." });
      }

      console.log(`[Protocol Fee] Updated baseFeeRatePcm from ${oldFeeRatePcm} to ${validation.pcm} by ${feeUpdatedBy}. Audit Event: ${auditEventId || "N/A"}`);

      return res.json({
        success: true,
        ...updated
      });
    } catch (e: any) {
      console.error("Error updating protocol fee:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  });

  // API: Update protocol config (devLnAddress, infraIncentiveTreasuryLightningAddress) - Strictly guarded by NIP-98 authentication & Audited on Nostr
  app.post("/api/protocol/config", async (req, res) => {
    try {
      // 1. Enforce strict NIP-98 HTTP Auth check (Kind 27235 signed by authorized admin key)
      const auth = await verifyNip98Auth(req, "/api/protocol/config", "POST");
      if (!auth.authorized) {
        return res.status(auth.status).json({
          success: false,
          error: auth.error
        });
      }

      const { devLnAddress, infraIncentiveTreasuryLightningAddress, auditEvent } = req.body || {};

      if (!devLnAddress && !infraIncentiveTreasuryLightningAddress) {
        return res.status(400).json({ success: false, error: "No configuration fields provided to update" });
      }

      const lnRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

      let trimmedDevAddress: string | undefined;
      if (devLnAddress) {
        if (typeof devLnAddress !== "string") {
          return res.status(400).json({ success: false, error: "Invalid devLnAddress format" });
        }
        trimmedDevAddress = devLnAddress.trim().toLowerCase();
        if (!lnRegex.test(trimmedDevAddress) && !trimmedDevAddress.startsWith("lnurl")) {
          return res.status(400).json({ success: false, error: "Invalid Lightning Address format for devLnAddress. Example: user@domain.com" });
        }
      }

      let trimmedTreasuryAddress: string | undefined;
      if (infraIncentiveTreasuryLightningAddress) {
        if (typeof infraIncentiveTreasuryLightningAddress !== "string") {
          return res.status(400).json({ success: false, error: "Invalid infraIncentiveTreasuryLightningAddress format" });
        }
        trimmedTreasuryAddress = infraIncentiveTreasuryLightningAddress.trim().toLowerCase();
        if (!lnRegex.test(trimmedTreasuryAddress) && !trimmedTreasuryAddress.startsWith("lnurl")) {
          return res.status(400).json({ success: false, error: "Invalid Lightning Address format for infraIncentiveTreasuryLightningAddress. Example: user@domain.com" });
        }
      }

      // 2. Validate and broadcast audit Nostr event if provided (best-effort)
      let auditEventId = "";
      if (auditEvent && typeof auditEvent === "object") {
        try {
          const isValidAuditSig = verifyEvent(auditEvent);
          if (isValidAuditSig && auditEvent.pubkey === auth.pubkey) {
            auditEventId = auditEvent.id;
            // Broadcast to Nostr protocol relays asynchronously (best-effort)
            const pool = new SimplePool();
            try {
              const pubPromises = pool.publish(PROTOCOL_RELAYS, auditEvent);
              Promise.allSettled(pubPromises).then(() => {
                pool.close(PROTOCOL_RELAYS);
              }).catch(() => {});
            } catch (pErr) {
              console.warn("Failed to broadcast config audit event to relays:", pErr);
            }
          } else {
            console.warn("Config audit event signature invalid or pubkey mismatch with NIP-98 event.");
          }
        } catch (vErr) {
          console.warn("Failed to verify config audit event:", vErr);
        }
      }

      const current = await getProtocolConfig();
      const updated = {
        ...current,
        ...(trimmedDevAddress ? { devLnAddress: trimmedDevAddress } : {}),
        ...(trimmedTreasuryAddress ? { infraIncentiveTreasuryLightningAddress: trimmedTreasuryAddress } : {}),
        configAuditNostrEventId: auditEventId || current.configAuditNostrEventId || "",
        updatedAt: Date.now(),
        updatedBy: auth.pubkey ? nip19.npubEncode(auth.pubkey) : "admin"
      };

      const saved = await saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist config to storage." });
      }

      console.log(`[Protocol Config] Updated addresses by ${auth.pubkey}. Audit Event: ${auditEventId || "N/A"}`);

      return res.json({
        success: true,
        ...updated
      });
    } catch (e: any) {
      console.error("Error updating protocol config:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  });

  // API: Resolve Lightning Address to real BOLT11 invoice via LNURL-pay (SSRF-safe, LUD-06 validated)
  // Protected with rate limiter (30 req / min / IP)
  app.get("/api/lightning/resolve-invoice", lnurlRateLimiter.middleware(), async (req, res) => {
    try {
      const address = (req.query.address as string || "").trim().toLowerCase();
      const amountSats = parseInt(req.query.amount as string) || 21000;

      const result = await resolveLightningInvoice(address, amountSats);
      if (!result.success) {
        const statusCode = result.fallback ? 502 : 400;
        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to resolve Lightning Address",
        fallback: true
      });
    }
  });

  // Media Server (NIP-96 style minimalist upload with diskStorage & rate-limiting)
  const uploadDir = path.join(process.cwd(), "dist", "media");
  const tempUploadDir = path.join(uploadDir, ".tmp");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (!fs.existsSync(tempUploadDir)) {
    fs.mkdirSync(tempUploadDir, { recursive: true });
  }

  // Disk storage: streams directly to disk to prevent OOM on 1GB RAM VPS
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, tempUploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `tmp-${uniqueSuffix}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit matching frontend & suited for 25GB disk
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed. SVG is strictly prohibited."));
      }
    }
  });

  // Serve static media files with security headers against Stored XSS
  app.use(
    "/media",
    (_req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      next();
    },
    express.static(uploadDir, { maxAge: "30d" })
  );

  app.get(["/api/media", "/api/media/health", "/api/media-fallback", "/api/media-fallback/health"], (req, res) => {
    const isFallback = req.path.includes("fallback");
    res.json({
      status: "ok",
      service: isFallback ? "CypherGuide Backup Media Node" : "CypherGuide Primary Media Server",
      timestamp: new Date().toISOString()
    });
  });

  app.post(
    ["/api/media/upload", "/api/media-fallback/upload"],
    uploadRateLimiter.middleware(),
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "File size exceeds 15MB limit." });
          }
          return res.status(400).json({ error: err.message || "File upload failed." });
        }
        next();
      });
    },
    async (req, res) => {
      const tempFilePath = req.file?.path;
      try {
        if (!req.file || !tempFilePath) {
          return res.status(400).json({ error: "no file" });
        }

        // Strict Magic Bytes binary validation: prevent SVG, HTML, and disguised executables
        const validation = validateImageMagicBytes(tempFilePath);
        if (!validation.valid) {
          if (fs.existsSync(tempFilePath)) {
            try {
              fs.unlinkSync(tempFilePath);
            } catch {}
          }
          return res.status(400).json({ error: validation.error || "File binary signature does not match allowed image types." });
        }

        // SHA-256 content addressing
        const fileBuffer = fs.readFileSync(tempFilePath);
        const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        // Enforce extension and MIME derived STRICTLY from verified magic bytes
        const ext = validation.ext || ".jpg";
        const verifiedMime = validation.mime || "image/jpeg";
        const filename = `${hash}${ext}`;
        const finalFilePath = path.join(uploadDir, filename);

        // Deduplication: if target exists, delete temp file; otherwise move to permanent storage
        if (fs.existsSync(finalFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch {}
        } else {
          fs.renameSync(tempFilePath, finalFilePath);
        }

        // Generate the public URL
        const publicUrl = `${req.protocol}://${req.get("host")}/media/${filename}`;

        // Return strictly in NIP-96 format as requested
        return res.json({
          status: "success",
          nip94_event: {
            tags: [
              ["url", publicUrl],
              ["ox", hash],
              ["m", verifiedMime]
            ]
          }
        });
      } catch (error: any) {
        console.error("Media upload error:", error);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch {}
        }
        return res.status(500).json({ error: error.message || "Internal Server Error" });
      }
    }
  );

  // Health check endpoints for monitoring and systemd
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: "Cypher Guide Server"
    });
  });

  // NIP-05 Identity Endpoint (.well-known/nostr.json)
  app.get("/.well-known/nostr.json", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    const pubPath = path.join(process.cwd(), "public", ".well-known", "nostr.json");
    if (fs.existsSync(pubPath)) {
      return res.sendFile(pubPath);
    }
    const distPath = path.join(process.cwd(), "dist", ".well-known", "nostr.json");
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    }
    res.status(404).json({ error: "nostr.json not found" });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/vi*', (_req, res) => {
      const viIndexPath = path.join(distPath, 'vi', 'index.html');
      if (fs.existsSync(viIndexPath)) {
        res.sendFile(viIndexPath);
      } else {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
