// api/games.js
import crypto from 'crypto';

async function sha256(msg) {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(msg)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function solvePow(challenge, difficulty) {
  let nonce = 0;
  const maxAttempts = 10_000_000; // Adjust if needed

  while (nonce < maxAttempts) {
    const hash = await sha256(challenge + nonce);
    if (hash.startsWith('0'.repeat(difficulty))) {
      return nonce;
    }
    nonce++;
    // Yield every 100k attempts to prevent blocking
    if (nonce % 100000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  throw new Error(`Failed to solve PoW after ${maxAttempts} attempts`);
}

const HEADER_STRATEGIES = [
  // Strategy 1: Common x-pow headers
  (nonce, challenge, timestamp) => ({
    'x-pow-nonce': nonce.toString(),
    'x-pow-challenge': challenge,
    'x-pow-timestamp': timestamp?.toString(),
  }),
  // Strategy 2: Simple nonce only
  (nonce) => ({
    'x-nonce': nonce.toString(),
  }),
  // Strategy 3: Solution header
  (nonce) => ({
    'x-pow-solution': nonce.toString(),
  }),
  // Strategy 4: Authorization-like
  (nonce, challenge) => ({
    'x-challenge': challenge,
    'x-solution': nonce.toString(),
  }),
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  const COOKIE =
    "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI1MTM3LCJlbWFpbCI6InJlZHdpbmdzc2ZvbGxvd2VyQGdtYWlsLmNvbSIsInJhbmsiOiJzdGFuZGFyZCIsImlhdCI6MTc3OTk3MDA2NSwiZXhwIjoxNzgwNTc0ODY1fQ.kfkBJdwxGUcA1Omt9dJKR1UocWeyzE9XBo1zE3k__bg";

  try {
    const baseUrl = "https://builderx.fun";

    // === First Request ===
    let response = await fetch(`${baseUrl}/api/games`, {
      headers: {
        accept: "*/*",
        cookie: COOKIE,
        referer: "https://builderx.fun/dashboard/games",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    // === Handle Proof of Work ===
    if (data?.requiresPow === true || data?.success === false) {
      console.log("🔐 PoW Required. Solving... Difficulty:", data.difficulty);

      const nonce = await solvePow(data.challenge, data.difficulty);
      console.log("✅ PoW Solved! Nonce:", nonce);

      // Try multiple header strategies
      let success = false;
      let finalData = null;

      for (let i = 0; i < HEADER_STRATEGIES.length; i++) {
        const headers = HEADER_STRATEGIES[i](nonce, data.challenge, data.timestamp);

        console.log(`Trying header strategy ${i + 1}...`);

        response = await fetch(`${baseUrl}/api/games`, {
          method: "GET",
          headers: {
            accept: "*/*",
            cookie: COOKIE,
            referer: "https://builderx.fun/dashboard/games",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ...headers,
          },
        });

        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData?.success !== false) {
          success = true;
          console.log(`✅ Strategy ${i + 1} worked!`);
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "All PoW header strategies failed",
          lastResponse: finalData,
        });
      }

      data = finalData;
    }

    // === Return Final Response ===
    if (typeof data === 'string') {
      return res.status(response.status).send(data);
    } else {
      return res.status(response.status).json(data);
    }

  } catch (err) {
    console.error("Games API error:", err);
    return res.status(500).json({ 
      error: err.message,
      details: "Failed during request or PoW solving"
    });
  }
}
