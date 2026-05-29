export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const robloxUsername = body?.robloxUsername;
    const oldUsername = body?.oldUsername || "unknown";

    if (!robloxUsername) {
      return res.status(400).json({ error: "Missing robloxUsername" });
    }

 const WEBHOOK_URL = "https://discord.com/api/webhooks/1509553153685585982/13HjEAUORgFGhvJ74rKevUfd2Ixx0OPCg9H-spUQ6dEGAlLhvREbC96zwIY8Yc3XkvUz"; // <-- put your webhook here

    const COOKIE =
      "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI1MTM3LCJlbWFpbCI6InJlZHdpbmdzc2ZvbGxvd2VyQGdtYWlsLmNvbSIsInJhbmsiOiJzdGFuZGFyZCIsImlhdCI6MTc3OTk3MDA2NSwiZXhwIjoxNzgwNTc0ODY1fQ.kfkBJdwxGUcA1Omt9dJKR1UocWeyzE9XBo1zE3k__bg";

    // ---------------- API REQUEST ----------------
    const response = await fetch("https://builderx.fun/api/user", {
      method: "PUT",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        cookie: COOKIE,
        referer: "https://builderx.fun/dashboard",
        origin: "https://builderx.fun"
      },
      body: JSON.stringify({
        robloxUsername
      })
    });

    const data = await response.text();

    // ---------------- WEBHOOK LOGGING ----------------
    try {
      const isChange = oldUsername !== robloxUsername;

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "🔄 Username Update Log",
              color: response.ok ? 3066993 : 15158332,
              fields: [
                {
                  name: "Old Username",
                  value: `\`${oldUsername}\``,
                  inline: true
                },
                {
                  name: "New Username",
                  value: `\`${robloxUsername}\``,
                  inline: true
                },
                {
                  name: "Changed?",
                  value: isChange ? "Yes" : "No",
                  inline: true
                },
                {
                  name: "Status Code",
                  value: String(response.status),
                  inline: true
                },
                {
                  name: "API Response",
                  value: "```" + data.slice(0, 1500) + "```"
                }
              ],
              timestamp: new Date().toISOString()
            }
          ]
        })
      });
    } catch (e) {
      console.log("Webhook failed:", e.message);
    }

    return res.status(response.status).send(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
