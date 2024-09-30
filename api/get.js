// Throttling and delay helper functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithThrottling(identificaties, limit = 5) {
  const results = [];

  for (let i = 0; i < identificaties.length; i += limit) {
    const batch = identificaties.slice(i, i + limit);

    const batchResults = await Promise.all(
      batch.map(identificatie => 
        fetch(`https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${identificatie}`, {
          headers: {
            "Authorization": process.env.AUTH_TOKEN,
            'Content-Type': 'application/json',
          }
        })
        .then(response => response.json())
        .catch(error => {
          console.error(`Error fetching data for identificatie ${identificatie}:`, error);
          return null; // Handle the error, return null for failed requests
        })
      )
    );

    results.push(...batchResults);

    // Delay between batches to prevent overloading the API
    await delay(500); // Adjust delay if needed
  }
  return results;
}

// Main handler
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

    const { target0, target1, target2 } = req.query;

    if (!target0 || !target1 || !target2) {
      return res.status(400).json({ error: "Both target1 and target2 parameters are required" });
    }

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?...&bbox=${target2}`;

    // Fetch all three APIs concurrently
    const [response0, response1, response2] = await Promise.all([
      fetch(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetch(apiUrl1, { headers: { 'Authorization': process.env.AUTH_TOKEN, 'Content-Type': 'application/json' } }),
      fetch(apiUrl2, { headers: { 'Content-Type': 'application/json' } })
    ]);

    if (response0.ok && response1.ok && response2.ok) {
      const data0 = await response0.json();
      const data1 = await response1.json();
      const data2 = await response2.json();

      const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&...&BBOX=${target2}`;
      const response3 = await fetch(apiUrl3, { headers: { 'Content-Type': 'application/json' } });

      const [x, y] = target2.split(',').map(coord => parseFloat(coord));
      const apiUrl4 = `https://service.pdok.nl/lv/bag/wfs/v2_0?...<coordinates>${x},${y}</coordinates>...`;

      const response4 = await fetch(apiUrl4, { headers: { 'Content-Type': 'application/json' } });

      if (response3.ok && response4.ok) {
        const data3 = await response3.json();
        const data4 = await response4.json();

        // Extract all 'identificatie' values from data4
        const identificaties = data4.features.map(feature => feature.properties.identificatie);

        // Use fetchWithThrottling to fetch for each identificatie with throttling
        const data6 = await fetchWithThrottling(identificaties);

        // Combine the results into one JSON object
        const combinedData = {
          data0: data0,
          data1: data1,
          data2: data2,
          data3: data3,
          data4: data4,
          data6: data6, // Add fetched data for identificatie values
        };

        res.status(200).json(combinedData);
      } else {
        res.status(500).json({ error: "Error fetching data from the bbox or WFS API" });
      }
    } else {
      res.status(500).json({ error: "Error fetching data from one or more APIs" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
