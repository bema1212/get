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

    // Build the API URLs
    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&srsname=EPSG:28992&bbox=${target2}`;

    // Fetch both APIs concurrently
    const [response0, response1, response2] = await Promise.all([
      fetch(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetch(apiUrl1, { headers: { "Authorization": process.env.AUTH_TOKEN, 'Content-Type': 'application/json' } }),
      fetch(apiUrl2, { headers: { 'Content-Type': 'application/json' } }),
    ]);

    // Check if all requests succeeded
    if (response0.ok && response1.ok && response2.ok) {
      const data0 = await response0.json();

      // Log the received data0 for debugging
      console.log('Data from API 0:', data0);

      // Ensure centroide_rd exists in data0
      if (!data0.centroide_rd) {
        return res.status(400).json({ error: "centroide_rd not found in data0" });
      }

      const centroide_rd = data0.centroide_rd; // Corrected variable name
      const coordinates = centroide_rd.match(/POINT\(([^ ]+) ([^ ]+)\)/);

      if (coordinates) {
        const x = parseFloat(coordinates[1]); // First coordinate
        const y = parseFloat(coordinates[2]); // Second coordinate
        
        // Build the apiUrl3 using the coordinates with a small buffer for BBOX
        const buffer = 0.01; // Adjust this buffer as necessary
        const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG%3A28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${x - buffer},${y - buffer},${x + buffer},${y + buffer}`;

        // Fetch apiUrl3
        const response3 = await fetch(apiUrl3, {
          headers: { 'Content-Type': 'application/json' },
        });

        // Log the response3 status for debugging
        console.log('Response from API 3:', response3.status);

        // Check if response3 is OK
        if (!response3.ok) {
          return res.status(500).json({ error: "Error fetching data from apiUrl3" });
        }

        const data1 = await response1.json();
        const data2 = await response2.json();
        const data3 = await response3.json(); // Fetch data3

        // Combine the results into one JSON object
        const combinedData = {
          data0: data0,
          data1: data1,
          data2: data2,
          data3: data3,
        };

        // Send the combined data back to the client
        res.status(200).json(combinedData);
      } else {
        res.status(400).json({ error: "Invalid format for centroide_rd" });
      }
    } else {
      // Handle errors if any of the responses are not OK
      res.status(500).json({ error: "Error fetching data from one or more APIs" });
    }
  } catch (error) {
    console.error('Error in handler:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
