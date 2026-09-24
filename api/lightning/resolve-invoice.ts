import { resolveLightningInvoice } from "../../lib/lnurlResolver";

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const address = (req.query.address as string || "").trim().toLowerCase();
    const amountSats = parseInt(req.query.amount as string) || 21000;

    const result = await resolveLightningInvoice(address, amountSats);
    if (!result.success) {
      const statusCode = result.fallback ? 502 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to resolve Lightning Address",
      fallback: true
    });
  }
}
