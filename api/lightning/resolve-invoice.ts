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
        "User-Agent": "CypherGuide-Vercel/1.1"
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
        "User-Agent": "CypherGuide-Vercel/1.1"
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

    return res.status(200).json({
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
}
