// api/games.js
import crypto from 'crypto';

async function sha256(msg) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(msg)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function solvePow(challenge, difficulty) {
  let nonce = 0;
  while (true) {
    const hash = await sha256(challenge + nonce);           // Original
    if (hash.startsWith("0".repeat(difficulty))) {
      return nonce;
    }
    nonce++;
    if (nonce % 150000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  const COOKIE = "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI1MTM3LCJlbWFpbCI6InJlZHdpbmdzc2ZvbGxvd2VyQGdtYWlsLmNvbSIsInJhbmsiOiJzdGFuZGFyZCIsImlhdCI6MTc3OTk3MDA2NSwiZXhwIjoxNzgwNTc0ODY1fQ.kfkBJdwxGUcA1Omt9dJKR1UocWeyzE9XBo1zE3k__bg";

  try {
    const baseUrl = "https://builderx.fun";

    // 1. Get challenge
    let response = await fetch(`${baseUrl}/api/games`, {
      headers: {
        accept: "*/*",
        cookie: COOKIE,
        referer: "https://builderx.fun/dashboard/games",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });

    let data = await response.json().catch(() => null);
    if (!data) data = await response.text();

    if (data?.requiresPow === true) {
      console.log("🔐 Solving PoW... Difficulty:", data.difficulty);

      const nonce = await solvePow(data.challenge, data.difficulty);
      console.log("✅ Nonce found:", nonce);

      // Multiple submission formats
      const strategies = [
        // A. Query params
        { url: `${baseUrl}/api/games?nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}` },
        { url: `${baseUrl}/api/games?pow_nonce=${nonce}&pow_challenge=${encodeURIComponent(data.challenge)}` },
        
        // B. Headers (different names)
        { headers: { "x-pow-nonce": nonce.toString(), "x-pow-challenge": data.challenge } },
        { headers: { "x-nonce": nonce.toString(), "x-challenge": data.challenge } },
        { headers: { "x-solution": nonce.toString() } },
        { headers: { "pow-nonce": nonce.toString() } },
        
        // C. Combined in one header (common)
        { headers: { "x-pow": `${data.challenge}:${nonce}` } },
      ];

      let success = false;
      let finalData = null;

      for (let strat of strategies) {
        const fetchUrl = strat.url || `${baseUrl}/api/games`;
        const headers = {
          accept: "*/*",
          cookie: COOKIE,
          referer: "https://builderx.fun/dashboard/games",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ...(strat.headers || {})
        };

        response = await fetch(fetchUrl, { headers });

        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData?.success !== false && !finalData?.requiresPow) {
          success = true;
          console.log("✅ PoW Accepted!");
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "PoW rejected (Invalid proof)",
          nonce,
          lastResponse: finalData
        });
      }

      data = finalData;
    }

    return typeof data === "string"
      ? res.status(response.status).send(data)
      : res.status(response.status).json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
