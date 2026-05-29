export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const COOKIE =
      "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI1MTM3LCJlbWFpbCI6InJlZHdpbmdzc2ZvbGxvd2VyQGdtYWlsLmNvbSIsInJhbmsiOiJzdGFuZGFyZCIsImlhdCI6MTc3OTk3MDA2NSwiZXhwIjoxNzgwNTc0ODY1fQ.kfkBJdwxGUcA1Omt9dJKR1UocWeyzE9XBo1zE3k__bg";

    const response = await fetch("https://builderx.fun/api/games", {
      method: "GET",
      headers: {
        accept: "*/*",
        cookie: COOKIE,
        referer: "https://builderx.fun/dashboard/games"
      }
    });

    const data = await response.text();

    return res.status(response.status).send(data);

  } catch (err) {
    console.error("Games API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
