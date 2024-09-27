export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    // Handle preflight request (OPTIONS)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Get target1 and target2 from the query string
    const { target1, target2 } = req.query;

    // Validate both target1 and target2
    if (!target1 || !target2) {
      return res.status(400).json({ error: "Both target1 and target2 parameters are required" });
    }

  

    // Build the first API URL using target1
    const apiUrl1 = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target1}`;

    // Example: Pass target2 as a query parameter to the second API
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&srsname=EPSG:28992&bbox=${target2}`;

    // Fetch both APIs concurrently
    const [response1, response2] = await Promise.all([
      fetch(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token
          'Content-Type': 'application/json',
        }
      }),
      fetch(apiUrl2, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token (if needed)
          'Content-Type': 'application/json',
        }
      })
    ]);

    // Check if both requests succeeded
    if (response1.ok && response2.ok) {
      const data1 = await response1.json();
      const data2 = await response2.json();

      // Combine the results into one JSON object
      const combinedData = {
        data1: data1,
        data2: data2,
      };

      // Send the combined data back to the client
      res.status(200).json(combinedData);
    } else {
      // Handle errors if any of the responses are not OK
      res.status(500).json({ error: "Error fetching data from one or more APIs" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
