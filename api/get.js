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

    // Validate all required parameters
    if (!target0 || !target1 || !target2) {
      return res.status(400).json({ error: "Both target1 and target2 parameters are required" });
    }

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&srsname=EPSG:28992&bbox=${target2}`;

    // Fetch all three APIs concurrently
    const [response0, response1, response2] = await Promise.all([
      fetch(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetch(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN, // Use environment variable for the token
          'Content-Type': 'application/json',
        }
      }),
      fetch(apiUrl2, { headers: { 'Content-Type': 'application/json' } })
    ]);

    // Check if all requests succeeded
    if (response0.ok && response1.ok && response2.ok) {
      const data0 = await response0.json();
      const data1 = await response1.json();
      const data2 = await response2.json();

      // Construct the new URL with the bounding box
      const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG:28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${target2}`;

      // Fetch the new URL
      const response3 = await fetch(apiUrl3, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Check if the new request succeeded
      if (response3.ok) {
        const data3 = await response3.json();

        // Initialize array to hold identificatie and coordinates
        const identificatieCoordinates = [];

        // Loop through each feature to extract identificatie and coordinates
        const features = data3.features || [];
        features.forEach(feature => {
          const identificatie = feature.properties.identificatie;
          const coordinates = feature.geometry.coordinates;
          identificatieCoordinates.push({
            identificatie,
            coordinates
          });
        });

        // Add identificatieCoordinates to combinedData
        const combinedData = {
          data0: data0,
          data1: data1,
          data2: data2,
          data3: data3, // Add data3 from the new fetch
          identificatieCoordinates // New property added here
        };

        // Send the combined data back to the client
        res.status(200).json(combinedData);
      } else {
        // Handle errors if the new request is not OK
        res.status(500).json({ error: "Error fetching data from the bbox API" });
      }
    } else {
      // Handle errors if any of the responses are not OK
      res.status(500).json({ error: "Error fetching data from one or more APIs" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
