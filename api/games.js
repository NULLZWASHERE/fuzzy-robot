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
  const maxAttempts = 15_000_000;

  while (nonce < maxAttempts) {
    const hash = await sha256(challenge + nonce);
    if (hash.startsWith('0'.repeat(difficulty))) {
      return nonce;
    }
    nonce++;
    if (nonce % 200000 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
  throw new Error("PoW solve timeout");
}

// === NEW STRATEGIES ===
const HEADER_STRATEGIES = [
  // 1. Standard
  (n, c, t) => ({ 'x-pow-nonce': n.toString(), 'x-pow-challenge': c }),
  // 2. 
  (n) => ({ 'x-nonce': n.toString() }),
  // 3.
  (n) => ({ 'pow-nonce': n.toString() }),
  // 4.
  (n, c) => ({ 'challenge': c, 'solution': n.toString() }),
  // 5. Query params version (most important new one)
  (n, c) => null, // special case - handled separately
  // 6.
  (n) => ({ 'x-solution': n.toString() }),
  // 7.
  (n, c, t) => ({ 'x-pow': `${c}:${n}` }),
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET allowed' });

  const COOKIE = "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI1MTM3LCJlbWFpbCI6InJlZHdpbmdzc2ZvbGxvd2VyQGdtYWlsLmNvbSIsInJhbmsiOiJzdGFuZGFyZCIsImlhdCI6MTc3OTk3MDA2NSwiZXhwIjoxNzgwNTc0ODY1fQ.kfkBJdwxGUcA1Omt9dJKR1UocWeyzE9XBo1zE3k__bg";

  try {
    const baseUrl = "https://builderx.fun";

    // First request
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
      console.log("PoW Required → Solving...");

      const nonce = await solvePow(data.challenge, data.difficulty);
      console.log("Nonce solved:", nonce);

      let success = false;
      let finalData = null;

      for (let i = 0; i < HEADER_STRATEGIES.length; i++) {
        const strategy = HEADER_STRATEGIES[i];
        let url = `${baseUrl}/api/games`;
        let headers = {
          accept: "*/*",
          cookie: COOKIE,
          referer: "https://builderx.fun/dashboard/games",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };

        if (strategy === null) {
          // Special Query Param Strategy
          url += `?nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}`;
        } else {
          Object.assign(headers, strategy(nonce, data.challenge, data.timestamp));
        }

        console.log(`Trying strategy ${i + 1}...`);

        response = await fetch(url, { method: "GET", headers });

        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData?.success !== false && !finalData?.requiresPow) {
          success = true;
          console.log(`✅ Strategy ${i + 1} SUCCESS!`);
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "All strategies failed",
          nonce,
          challenge: data.challenge,
          lastResponse: finalData
        });
      }

      data = finalData;
    }

    // Return result
    return typeof data === 'string' 
      ? res.status(response.status).send(data)
      : res.status(response.status).json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
