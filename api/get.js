export default async function handler(req, res) {
  try {
    // Get the TARGET parameter from the query string
    const { target } = req.query;

    if (!target) {
      return res.status(400).json({ error: "TARGET parameter is required" });
    }

    // Build the URL with the dynamic TARGET
    const apiUrl = `https://yxorp-pi.vercel.app/api/handler?url=https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target}`;

    // Forward the request to the external API using the fetch API on the server side
    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token
        'Content-Type': 'application/json',
      }
    });

    // Handle the response
    if (response.ok) {
      const data = await response.json();
      // Return the data from the API to the client
      res.status(200).json(data);
    } else {
      res.status(response.status).json({ error: "Error fetching data from API" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
