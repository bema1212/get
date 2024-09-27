import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    // Get the TARGET parameter from the query string
    const { target } = req.query;

    if (!target) {
      return res.status(400).json({ error: "TARGET parameter is required" });
    }

    // Build the URL with the dynamic TARGET
    const url = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target}`;

    // Send the request to the API with the Authorization header
    const response = await fetch(url, {
      headers: {
        "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token
        'Content-Type': 'application/json',
      }
    });

    // Handle the response
    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      res.status(response.status).json({ error: "Error fetching data" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
