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

    // Get target0, target1, and target2 from the query string
    const { target0, target1, target2 } = req.query;

    // Validate both target1 and target2
    if (!target0 || !target1 || !target2) {
      return res.status(400).json({ error: "Both target0, target1, and target2 parameters are required" });
    }

    // Define API URLs using the target parameters
    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&srsname=EPSG:28992&bbox=${target2}`;

    // Fetch both APIs concurrently
    const [response0, response1, response2] = await Promise.all([
      fetch(apiUrl0, {
        headers: { 'Content-Type': 'application/json' },
      }),
      fetch(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token
          'Content-Type': 'application/json',
        },
      }),
      fetch(apiUrl2, {
        headers: { 'Content-Type': 'application/json' },
      }),
    ]);

    // Check if the first request succeeded
    if (!response0.ok) {
      return res.status(500).json({ error: "Error fetching data from the first API" });
    }

    const data0 = await response0.json();
    console.log(data0); // Log the response for debugging

    // Check if centroide_rd exists in data0
    if (!data0 || !data0.centroide_rd) {
      return res.status(400).json({ error: "Invalid or missing centroide_rd in data0" });
    }

    // Extract the coordinates from centroide_rd
    const centroide_rd = data0.centroide_rd; // Access centroide_rd directly
    const coordinates = centroide_rd.match(/POINT\(([^ ]+) ([^ ]+)\)/);

    if (!coordinates || coordinates.length < 3) {
      return res.status(400).json({ error: "Invalid coordinates format in centroide_rd" });
    }

    // Extract x and y coordinates
    const x = coordinates[1]; // First coordinate (X)
    const y = parseFloat(coordinates[2]) + 1; // Second coordinate (Y), add 1

    // Construct the URL for the next API call using the coordinates
    const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application%2Fjson&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG%3A28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${x},${y},${x},${y}`;

    // Fetch the third API
    const response3 = await fetch(apiUrl3, {
      headers: { 'Content-Type': 'application/json' },
    });

    // Check if the third request succeeded
    if (!response3.ok) {
      return res.status(500).json({ error: "Error fetching data from the third API" });
    }

    const data1 = await response1.json();
    const data2 = await response2.json();
    const data3 = await response3.json();

    // Combine the results into one JSON object
    const combinedData = {
      data0: data0,
      data1: data1,
      data2: data2,
      data3: data3,
    };

    // Send the combined data back to the client
    res.status(200).json(combinedData);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
