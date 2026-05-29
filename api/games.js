// api/games.js  (or app/api/games/route.js)
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
    const hash = await sha256(challenge + nonce);
    if (hash.startsWith("0".repeat(difficulty))) {
      return nonce;
    }
    nonce++;
    // Prevent Vercel timeout / blocking
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

    // === Step 1: Get Challenge ===
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

    // === Step 2: Solve PoW if required ===
    if (data?.requiresPow === true) {
      console.log("PoW Required → Solving... Difficulty:", data.difficulty);

      const nonce = await solvePow(data.challenge, data.difficulty);
      console.log("✅ Solved Nonce:", nonce);

      // === Step 3: Retry with solution (multiple common methods) ===
      const strategies = [
        // 1. Headers
        () => ({
          headers: {
            ...{ accept: "*/*", cookie: COOKIE, referer: "https://builderx.fun/dashboard/games", "user-agent": "Mozilla/5.0..." },
            "x-pow-nonce": nonce.toString(),
            "x-pow-challenge": data.challenge,
            "x-pow-timestamp": data.timestamp?.toString(),
          }
        }),
        // 2. Query Parameters (very common)
        () => ({
          url: `${baseUrl}/api/games?nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}`,
          headers: { accept: "*/*", cookie: COOKIE, referer: "https://builderx.fun/dashboard/games", "user-agent": "Mozilla/5.0..." }
        }),
        // 3. Solution header
        () => ({
          headers: {
            ...{ accept: "*/*", cookie: COOKIE, referer: "https://builderx.fun/dashboard/games", "user-agent": "Mozilla/5.0..." },
            "x-solution": nonce.toString(),
            "x-challenge": data.challenge,
          }
        }),
      ];

      let finalResponse = null;
      let finalData = null;

      for (const strat of strategies) {
        const config = strat();
        const fetchUrl = config.url || `${baseUrl}/api/games`;

        finalResponse = await fetch(fetchUrl, {
          method: "GET",
          headers: config.headers || {}
        });

        try {
          finalData = await finalResponse.json();
        } catch {
          finalData = await finalResponse.text();
        }

        if (finalResponse.ok && finalData?.success !== false && !finalData?.requiresPow) {
          console.log("✅ Success with strategy");
          break;
        }
      }

      data = finalData;
      response = finalResponse;
    }

    // === Return final result ===
    if (typeof data === "string") {
      return res.status(response.status).send(data);
    } else {
      return res.status(response.status).json(data);
    }

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
