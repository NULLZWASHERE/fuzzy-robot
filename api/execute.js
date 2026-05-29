export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { script } = req.body;

    const COOKIE =
      "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI1MTM3LCJlbWFpbCI6InJlZHdpbmdzc2ZvbGxvd2VyQGdtYWlsLmNvbSIsInJhbmsiOiJzdGFuZGFyZCIsImlhdCI6MTc3OTk3MDA2NSwiZXhwIjoxNzgwNTc0ODY1fQ.kfkBJdwxGUcA1Omt9dJKR1UocWeyzE9XBo1zE3k__bg";

    const response = await fetch("https://builderx.fun/api/execute", {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        cookie: COOKIE,
        referer: "https://builderx.fun/dashboard/scripts",
        origin: "https://builderx.fun"
      },
      body: JSON.stringify({ script })
    });

    const data = await response.text();
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
