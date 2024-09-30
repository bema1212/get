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

    // Check if all initial requests succeeded
    if (response0.ok && response1.ok && response2.ok) {
      const data0 = await response0.json();
      const data1 = await response1.json();
      const data2 = await response2.json();

      // Fetch data from the bbox URL
      const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG:28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${target2}`;
      const response3 = await fetch(apiUrl3, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response3.ok) {
        const data3 = await response3.json();

        // Fetch from the API using the response from apiUrl3
        const apiUrl4 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=100&outputFormat=json&srsName=EPSG:28992&typeName=bag:verblijfsobject&Filter=%3CFilter%3E%20%3CDWithin%3E%3CPropertyName%3EGeometry%3C/PropertyName%3E%3Cgml:Point%3E%20%3Cgml:coordinates%3E${target2}%3C/gml:coordinates%3E%20%3C/gml:Point%3E%3CDistance%20units=%27m%27%3E50%3C/Distance%3E%3C/DWithin%3E%3C/Filter%3E`;
        const response4 = await fetch(apiUrl4, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (response4.ok) {
          const data4 = await response4.json();

          // Now we process the features from data4 and fetch additional data for each "identificatie"
          const fetchPromises = data4.features.map(async (feature) => {
            const identificatie = feature.properties.identificatie;
            const [x, y] = feature.geometry.coordinates;

            // Construct the target3 value using the coordinates
            const target3 = `${x},${y}`;

            // Create the URL with the target3 coordinates for additional fetches
            const apiUrlForIdentificatie = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=100&outputFormat=application/json&srsName=EPSG:28992&typeName=bag:pand&Filter=%3CFilter%3E%20%3CDWithin%3E%3CPropertyName%3EGeometry%3C/PropertyName%3E%3Cgml:Point%3E%20%3Cgml:coordinates%3E${target3}%3C/gml:coordinates%3E%20%3C/gml:Point%3E%3CDistance%20units=%27m%27%3E1%3C/Distance%3E%3C/DWithin%3E%3C/Filter%3E`;

            // Fetch the data for this specific "identificatie"
            const identificatieResponse = await fetch(apiUrlForIdentificatie, {
              headers: { 'Content-Type': 'application/json' },
            });

            if (identificatieResponse.ok) {
              const identificatieData = await identificatieResponse.json();
              return { identificatie, identificatieData };
            } else {
              return { identificatie, error: 'Failed to fetch data' };
            }
          });

          // Wait for all fetch requests for identificaties to complete
          const identificatieResults = await Promise.all(fetchPromises);

          // Combine all the data into one JSON object
          const combinedData = {
            data0, // apiUrl0 response
            data1, // apiUrl1 response
            data2, // apiUrl2 response
            data3, // apiUrl3 response (bbox)
            data4, // apiUrl4 response (verblijfsobjecten)
            identificatieResults // Results from fetching for each identificatie
          };

          // Send the combined data back to the client
          res.status(200).json(combinedData);
        } else {
          res.status(500).json({ error: 'Error fetching data from apiUrl4 (verblijfsobject)' });
        }
      } else {
        res.status(500).json({ error: 'Error fetching data from apiUrl3 (bbox)' });
      }
    } else {
      res.status(500).json({ error: "Error fetching data from one or more initial APIs" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
