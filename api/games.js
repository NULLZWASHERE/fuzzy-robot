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
    const hash = await sha256(challenge + nonce);
    if (hash.startsWith("0".repeat(difficulty))) {
      return nonce;
    }
    nonce++;
    if (nonce % 200000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10)); // prevent Vercel timeout
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

    // First request - get challenge
    let response = await fetch(`${baseUrl}/api/games`, {
      headers: {
        accept: "*/*",
        cookie: COOKIE,
        referer: "https://builderx.fun/dashboard/games",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    // Solve PoW if required
    if (data?.requiresPow === true) {
      console.log("🔐 PoW Required. Difficulty:", data.difficulty, "Challenge:", data.challenge);

      const nonce = await solvePow(data.challenge, data.difficulty);
      console.log("✅ Nonce Solved:", nonce);

      // Try different ways to send the solution
      const attempts = [
        // 1. Query parameters (very common for these PoW)
        `${baseUrl}/api/games?nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}`,

        // 2. Query with pow_ prefix
        `${baseUrl}/api/games?pow_nonce=${nonce}&pow_challenge=${encodeURIComponent(data.challenge)}`,

        // 3. Headers
        null, // special case for headers below
      ];

      let finalData = null;
      let success = false;

      for (let attempt of attempts) {
        let fetchUrl = `${baseUrl}/api/games`;
        let headers = {
          accept: "*/*",
          cookie: COOKIE,
          referer: "https://builderx.fun/dashboard/games",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };

        if (typeof attempt === "string") {
          fetchUrl = attempt; // query param version
        } else {
          // Header version
          headers["x-pow-nonce"] = nonce.toString();
          headers["x-pow-challenge"] = data.challenge;
          headers["x-pow-timestamp"] = data.timestamp?.toString() || "";
        }

        response = await fetch(fetchUrl, { headers });

        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData?.success !== false && !finalData?.requiresPow) {
          success = true;
          console.log("✅ Request succeeded with solution");
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "Failed to bypass PoW - all methods tried",
          nonce,
          lastResponse: finalData
        });
      }

      data = finalData;
    }

    // Return the final data
    return typeof data === "string" 
      ? res.status(response.status).send(data)
      : res.status(response.status).json(data);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
