import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import crypto from "crypto";

function loadProjectDocs(): string {
  const docs: string[] = [];
  const filesToRead = [
    "ARCHITECTURE.md",
    "ARCHITECTURE.vi.md",
    "ARCHITECTURE.en.md",
    "MATURITY.md",
    "MATURITY.vi.md",
    "MATURITY.en.md",
    "CONTRIBUTING.md",
    "CONTRIBUTING.vi.md",
    "CONTRIBUTING.en.md",
    "HOST_LEGAL_REALITY.md",
    "HOST_LEGAL_REALITY.vi.md",
    "HOST_LEGAL_REALITY.en.md",
    "POSITIONING.md",
    "POSITIONING.vi.md",
    "POSITIONING.en.md",
    "HANDOFF_NOTES.md"
  ];

  for (const relPath of filesToRead) {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        docs.push(`=== FILE: ${relPath} ===\n${content}`);
      } catch (err) {
        console.error(`Error reading ${relPath}:`, err);
      }
    }
  }

  const rfcDir = path.join(process.cwd(), "RFC");
  if (fs.existsSync(rfcDir)) {
    try {
      const rfcFiles = fs.readdirSync(rfcDir);
      for (const file of rfcFiles) {
        if (file.endsWith(".md")) {
          const fullPath = path.join(rfcDir, file);
          const content = fs.readFileSync(fullPath, "utf-8");
          docs.push(`=== FILE: RFC/${file} ===\n${content}`);
        }
      }
    } catch (err) {
      console.error("Error reading RFC dir:", err);
    }
  }

  return docs.join("\n\n");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));

  // CORS middleware for API endpoints
  app.use("/api", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API endpoint for Documentation Lookup Assistant (RFC-0005)
  const docsQueryHandler = async (req: express.Request, res: express.Response) => {
    try {
      const question = req.body?.question || req.query?.question;
      const locale = req.body?.locale || req.query?.locale;

      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Missing or invalid question parameter." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          answer: locale === 'en'
            ? "Error: GEMINI_API_KEY environment variable is not set on server."
            : "Lỗi: GEMINI_API_KEY chưa được thiết lập trong hằng số môi trường của server. Vui lòng kiểm tra lại cấu hình Settings > Secrets.",
          success: false
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const docsContent = loadProjectDocs();
      const userLocale = locale === 'en' ? 'en' : 'vi';

      const systemInstruction = `You are the Cypher Guide Documentation Lookup Assistant (Trợ Lý Tra Cứu Tài Liệu Cypher Guide).
Your ONLY task is to look up and answer questions based strictly on the official project documentation provided below.

STRICT MANDATORY RULES YOU MUST FOLLOW WITHOUT EXCEPTION:
1. Answer strictly and only based on the provided official documentation context.
2. IF A QUESTION CANNOT BE ANSWERED DIRECTLY FROM THE PROVIDED DOCUMENTATION (or asks about features, policies, code, or topics not mentioned in the documentation), YOU MUST RESPOND EXACTLY WITH:
${userLocale === 'en' ? '"There is no documentation about this yet"' : '"Chưa có tài liệu về việc này"'}
3. DO NOT speculate, assume, guess, or invent any features, protocols, algorithms, dates, policies, or mechanisms that are not explicitly documented.
4. DO NOT present yourself as an official representative, spokesperson, or decision-maker of the Cypher Guide project. You are purely an automated document lookup index tool.
5. Provide clear, direct, concise, and truthful answers with reference to the specific RFCs or Architecture section where applicable.
6. LANGUAGE MANDATE: ${userLocale === 'en' ? 'Respond in English.' : 'ALWAYS respond in Vietnamese (Tiếng Việt). Translate concepts into clear Vietnamese where appropriate while keeping RFC citations in English filenames.'}

--- OFFICIAL PROJECT DOCUMENTATION CONTEXT ---
${docsContent}`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: question,
        config: {
          systemInstruction
        }
      });

      // Post-process model output using the agreed JSON-marker protocol.
      // Design: model MUST append a single-line JSON marker on the last line of its output.
      // The server will take the last non-empty, non-code-fence line only and attempt to JSON.parse it.
      // - If parsing succeeds and marker.grounded === true: return the model answer with the marker line removed.
      // - If parsing fails or marker.grounded !== true: return the strict fallback phrase (do not return model text).
      // NOTE: the JSON marker MUST NOT be leaked to the client.

      const rawOutput = (response as any).text ?? "";
      const fallback = userLocale === 'en' ? "There is no documentation about this yet" : "Chưa có tài liệu về việc này";

      let finalAnswer = fallback;

      try {
        const normalized = rawOutput.replace(/\r\n/g, "\n").trimEnd();
        if (normalized.length > 0) {
          const lines = normalized.split(/\n/);

          // Find last non-empty line index
          let idx = lines.length - 1;
          while (idx >= 0 && lines[idx].trim() === "") idx--;

          // Skip trailing code-fence closers/backticks if present
          // This handles cases where model wraps the JSON marker in a code fence:
          // ```json\n{...}\n``` --> lines end with ``` so we skip those markers to reach JSON line.
          if (idx >= 0 && lines[idx].trim().startsWith('```')) {
            // skip the closing fence
            idx--;
            // skip any additional empty lines
            while (idx >= 0 && lines[idx].trim() === "") idx--;
          }

          if (idx >= 0) {
            const candidate = lines[idx].trim();

            let marker: any = null;
            try {
              marker = JSON.parse(candidate);
            } catch (e) {
              marker = null;
            }

            if (marker && typeof marker.grounded !== 'undefined') {
              if (marker.grounded === true) {
                // Remove the marker line (and any trailing empty lines/fences) from the output
                const answerLines = lines.slice(0, idx).join('\n').trim();
                finalAnswer = answerLines.length > 0 ? answerLines : fallback;
              } else {
                // Explicitly ungrounded
                finalAnswer = fallback;
              }
            } else {
              // Marker missing or not parsable
              finalAnswer = fallback;
            }
          } else {
            finalAnswer = fallback;
          }
        } else {
          finalAnswer = fallback;
        }
      } catch (err) {
        console.error('Error processing model output marker:', err);
        finalAnswer = fallback;
      }

      return res.json({
        answer: finalAnswer,
        success: true
      });
    } catch (error: any) {
      console.error("Error in /api/docs-assistant/query:", error);
      return res.status(500).json({
        error: "Internal server error during documentation query.",
        message: error.message || String(error)
      });
    }
  };

  app.all("/api/docs-assistant/query", docsQueryHandler);
  app.all("/api/docs-assistant/query/", docsQueryHandler);

  // Protocol Config file path
  const configFilePath = path.join(process.cwd(), "data", "protocol_config.json");
  const MARKETING_NPUB = "npub1jm0uzazghhqn9s3xy0rla0ufckr6303xn4qaj4e2jrutzpdh83usafqxmh";

  const getProtocolConfig = () => {
    try {
      if (fs.existsSync(configFilePath)) {
        const raw = fs.readFileSync(configFilePath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error reading protocol config:", e);
    }
    return {
      devLnAddress: "cypherguide@zaps.lol",
      updatedAt: Date.now(),
      updatedBy: "system"
    };
  };

  const saveProtocolConfig = (config: any) => {
    try {
      const dir = path.dirname(configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf-8");
      return true;
    } catch (e) {
      console.error("Error saving protocol config:", e);
      return false;
    }
  };

  // API: Get protocol config (devLnAddress, etc.)
  app.get("/api/protocol/config", (req, res) => {
    const config = getProtocolConfig();
    res.json(config);
  });

  // API: Update protocol config (devLnAddress) - Restricted to authorized admins
  app.post("/api/protocol/config", (req, res) => {
    try {
      const { devLnAddress, npub } = req.body;

      if (!devLnAddress || typeof devLnAddress !== "string") {
        return res.status(400).json({ success: false, error: "Invalid devLnAddress" });
      }

      const trimmedAddress = devLnAddress.trim().toLowerCase();
      // Allow valid email/lightning address format
      const lnRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
      if (!lnRegex.test(trimmedAddress) && !trimmedAddress.startsWith("lnurl")) {
        return res.status(400).json({ success: false, error: "Invalid Lightning Address format. Example: user@domain.com" });
      }

      // Check admin authorization - only official dev/guardian npub
      const isAuthorized = npub === MARKETING_NPUB || 
        npub === "npub17nldrj8qkk2hj6cn5xu3st256wknp2sad7g2mv70a3nv2kv9l9qs5l4cc6";

      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: "Unauthorized: Only official admin/guardians can update network donation wallet." });
      }

      const current = getProtocolConfig();
      const updated = {
        ...current,
        devLnAddress: trimmedAddress,
        updatedAt: Date.now(),
        updatedBy: npub || "admin"
      };

      const saved = saveProtocolConfig(updated);
      if (!saved) {
        return res.status(500).json({ success: false, error: "Failed to persist config to server disk." });
      }

      return res.json({
        success: true,
        ...updated
      });
    } catch (e: any) {
      console.error("Error updating protocol config:", e);
      return res.status(500).json({ success: false, error: e.message || "Internal server error" });
    }
  });

  // API: Resolve Lightning Address to real BOLT11 invoice via LNURL-pay
  app.get("/api/lightning/resolve-invoice", async (req, res) => {
    try {
      const address = (req.query.address as string || "").trim().toLowerCase();
      const amountSats = parseInt(req.query.amount as string) || 21000;

      if (!address || !address.includes("@")) {
        return res.status(400).json({ success: false, error: "Invalid Lightning Address (must be user@domain.com)" });
      }

      const [username, domain] = address.split("@");
      if (!username || !domain) {
        return res.status(400).json({ success: false, error: "Malformed Lightning Address" });
      }

      // 1. Fetch LNURL metadata from domain
      const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      const metaRes = await fetch(lnurlEndpoint, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "CypherGuide-App/1.1"
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!metaRes.ok) {
        return res.status(502).json({
          success: false,
          error: `Lightning domain ${domain} returned HTTP ${metaRes.status}`,
          fallback: true
        });
      }

      const metadata: any = await metaRes.json();
      if (metadata.status === "ERROR") {
        return res.status(400).json({
          success: false,
          error: metadata.reason || "LNURL error returned by wallet provider",
          fallback: true
        });
      }

      const callback = metadata.callback;
      const minSendable = metadata.minSendable || 1000; // millisats
      const maxSendable = metadata.maxSendable || 100000000000; // millisats
      const millisats = amountSats * 1000;

      if (millisats < minSendable || millisats > maxSendable) {
        return res.status(400).json({
          success: false,
          error: `Amount must be between ${Math.ceil(minSendable / 1000)} and ${Math.floor(maxSendable / 1000)} Sats`,
          fallback: true
        });
      }

      // 2. Fetch invoice from callback
      const callbackUrl = new URL(callback);
      callbackUrl.searchParams.set("amount", millisats.toString());
      callbackUrl.searchParams.set("comment", "Donation V4V Cypher Guide");

      const invoiceRes = await fetch(callbackUrl.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "CypherGuide-App/1.1"
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!invoiceRes.ok) {
        return res.status(502).json({
          success: false,
          error: `Callback provider ${domain} failed to create invoice`,
          fallback: true
        });
      }

      const invoiceData: any = await invoiceRes.json();
      if (invoiceData.status === "ERROR" || !invoiceData.pr) {
        return res.status(400).json({
          success: false,
          error: invoiceData.reason || "No invoice returned from provider",
          fallback: true
        });
      }

      return res.json({
        success: true,
        invoice: invoiceData.pr,
        isReal: true,
        address,
        amountSats
      });
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
      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed."));
      }
    }
  });

  // Serve static media files
  app.use("/media", express.static(uploadDir, { maxAge: "30d" }));

  // In-memory rate limiter for media uploads: max 30 uploads per 15 minutes per IP
  const uploadRateLimitWindowMs = 15 * 60 * 1000;
  const maxUploadsPerWindow = 30;
  const uploadCounts = new Map<string, { count: number; resetTime: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of uploadCounts.entries()) {
      if (now > record.resetTime) {
        uploadCounts.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref();

  const uploadRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress) || "unknown";
    const now = Date.now();
    const record = uploadCounts.get(ip);

    if (!record || now > record.resetTime) {
      uploadCounts.set(ip, { count: 1, resetTime: now + uploadRateLimitWindowMs });
      return next();
    }

    if (record.count >= maxUploadsPerWindow) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        error: "Too many upload requests. Please try again later to prevent disk abuse.",
        retryAfter: retryAfterSeconds
      });
    }

    record.count++;
    next();
  };

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
    uploadRateLimiter,
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

        // Compute SHA256 of file from disk stream without loading entire file into memory buffer
        const hash = await new Promise<string>((resolve, reject) => {
          const hashGenerator = crypto.createHash("sha256");
          const stream = fs.createReadStream(tempFilePath);
          stream.on("data", (chunk) => hashGenerator.update(chunk));
          stream.on("end", () => resolve(hashGenerator.digest("hex")));
          stream.on("error", (err) => reject(err));
        });

        const ext = path.extname(req.file.originalname) || ".jpg";
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
              ["m", req.file.mimetype]
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
    app.get('/vi*', (req, res) => {
      const viIndexPath = path.join(distPath, 'vi', 'index.html');
      if (fs.existsSync(viIndexPath)) {
        res.sendFile(viIndexPath);
      } else {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
