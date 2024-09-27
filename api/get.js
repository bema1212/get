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

    // Validate all targets
    if (!target0 || !target1 || !target2) {
      return res.status(400).json({ error: "Both target0, target1, and target2 parameters are required" });
    }

    console.log("Targets:", { target0, target1, target2 }); // Log targets for debugging

    // Build the API URLs
    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&srsname=EPSG:28992&bbox=${target2}`;

    // Initialize responses
    let data0, data1, data2;

    // Fetch APIs with error handling
    try {
      const response0 = await fetch(apiUrl0, { headers: { 'Content-Type': 'application/json' } });
      if (!response0.ok) throw new Error(`API 0 failed: ${response0.status} ${response0.statusText}`);
      data0 = await response0.json();
      console.log("Data from API 0:", data0); // Log API 0 data
    } catch (error) {
      console.error("Error fetching from API 0:", error);
      return res.status(500).json({ error: "Error fetching from API 0" });
    }

    try {
      const response1 = await fetch(apiUrl1, { headers: { "Authorization": process.env.AUTH_TOKEN, 'Content-Type': 'application/json' } });
      if (!response1.ok) throw new Error(`API 1 failed: ${response1.status} ${response1.statusText}`);
      data1 = await response1.json();
      console.log("Data from API 1:", data1); // Log API 1 data
    } catch (error) {
      console.error("Error fetching from API 1:", error);
      return res.status(500).json({ error: "Error fetching from API 1" });
    }

    try {
      const response2 = await fetch(apiUrl2, { headers: { 'Content-Type': 'application/json' } });
      if (!response2.ok) throw new Error(`API 2 failed: ${response2.status} ${response2.statusText}`);
      data2 = await response2.json();
      console.log("Data from API 2:", data2); // Log API 2 data
    } catch (error) {
      console.error("Error fetching from API 2:", error);
      return res.status(500).json({ error: "Error fetching from API 2" });
    }

    // Extract coordinates from centroide_rd
    if (!data0 || !data0.centroide_rd) {
      return res.status(400).json({ error: "Invalid or missing centroide_rd in data0" });
    }

    const centroide_rd = data0.centroide_rd;
    const coordinates = centroide_rd.match(/POINT\(([^ ]+) ([^ ]+)\)/);

    if (!coordinates) {
      return res.status(400).json({ error: "Invalid coordinates format in centroide_rd" });
    }

    const x = coordinates[1]; // First coordinate (longitude)
    const y = coordinates[2]; // Second coordinate (latitude)

    // Construct the new URL using the extracted coordinates
    const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG:28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${x},${y},${parseFloat(x) + 1},${parseFloat(y) + 1}`;

    // Fetch the new URL with error handling
    let data3;
    try {
      const response3 = await fetch(apiUrl3, { headers: { 'Content-Type': 'application/json' } });
      if (!response3.ok) throw new Error(`API 3 failed: ${response3.status} ${response3.statusText}`);
      data3 = await response3.json();
      console.log("Data from API 3:", data3); // Log API 3 data
    } catch (error) {
      console.error("Error fetching from API 3:", error);
      return res.status(500).json({ error: "Error fetching from API 3" });
    }

    // Combine the results into one JSON object
    const combinedData = {
      data0: data0,
      data1: data1,
      data2: data2,
      data3: data3, // Include data3 from the new fetch
    };

    // Send the combined data back to the client
    res.status(200).json(combinedData);
    
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
