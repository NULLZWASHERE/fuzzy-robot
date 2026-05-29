// api/games.js
import crypto from 'crypto';

function sha256(msg) {
  return crypto
    .createHash('sha256')
    .update(msg, 'utf8')
    .digest('hex');
}

async function solvePow(challenge, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;

  while (true) {
    const hash = sha256(challenge + nonce);
    
    if (hash.startsWith(target)) {
      return nonce;
    }

    nonce++;

    // Keep it responsive on Vercel
    if (nonce % 250000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
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

    // === First Request ===
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

    // === Solve PoW ===
    if (data?.requiresPow === true) {
      console.log(`🔐 PoW Required | Difficulty: ${data.difficulty}`);

      const startTime = Date.now();
      const nonce = await solvePow(data.challenge, data.difficulty);
      const solveTime = Date.now() - startTime;

      console.log(`✅ Solved in ${solveTime}ms → Nonce: ${nonce}`);

      // Use the method that worked before
      response = await fetch(
        `${baseUrl}/api/games?nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}`,
        {
          headers: {
            accept: "*/*",
            cookie: COOKIE,
            referer: "https://builderx.fun/dashboard/games",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          }
        }
      );

      data = await response.json().catch(() => null);
      if (!data) data = await response.text();
    }

    // Return result
    return typeof data === "string"
      ? res.status(response.status).send(data)
      : res.status(response.status).json(data);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
