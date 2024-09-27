export default async function handler(req, res) {
  try {
    // Allow all origins (you can restrict to specific domains if needed)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    // Handle preflight requests (OPTIONS)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Get the TARGET parameter from the query string
    const { target } = req.query;

    if (!target) {
      return res.status(400).json({ error: "TARGET parameter is required" });
    }

    // Build the URL with the dynamic TARGET
    const apiUrl = `https://yxorp-pi.vercel.app/api/handler?url=https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target}`;

    // Send the request to the external API
    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      res.status(response.status).json({ error: "Error fetching data from API" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
