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

      // Fetch the new URL (bbox request)
      const response3 = await fetch(apiUrl3, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Extract X and Y coordinates from target2
      const [x, y] = target2.split(',').map(coord => parseFloat(coord));

      // Create the URL for the additional request to the WFS service with the target2 coordinates
      const apiUrl4 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&propertyname=&count=200&outputFormat=json&srsName=EPSG:28992&typeName=bag:verblijfsobject&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${x},${y}</gml:coordinates></gml:Point><Distance units='m'>50</Distance></DWithin></Filter>`;

      // Fetch the WFS service URL
      const response4 = await fetch(apiUrl4, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Check if both new requests succeeded
      if (response3.ok && response4.ok) {
        const data3 = await response3.json();
        const data4 = await response4.json();

        // Initialize data5
        const data5 = [];

        // Fetch additional data for each feature in data4
        for (const feature of data4.features) {
          // Get coordinates directly from the feature's geometry
          const coords = feature.geometry.coordinates.join(','); // Create a string from the coordinates

          // Construct the API URL for fetching additional data for each feature
          const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=1&outputFormat=application/json&srsName=EPSG:28992&typeName=bag:pand&count=1&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${coords}</gml:coordinates></gml:Point><Distance units='m'>1</Distance></DWithin></Filter>`;

          // Fetch data for the current feature
          const response5 = await fetch(apiUrl5, {
            headers: { 'Content-Type': 'application/json' },
          });

          if (response5.ok) {
            const dataFeature = await response5.json();
            data5.push(dataFeature); // Add to data5 array
          } else {
            console.error(`Error fetching data for coordinates ${coords}: ${response5.statusText}`);
          }
        }

        // Combine the results into one JSON object
        const combinedData = {
          data0: data0,
          data1: data1,
          data2: data2,
          data3: data3, // Add data3 from the bbox fetch
          data4: data4, // Add data4 from the WFS fetch
          data5: data5, // Add data5 from additional feature requests
        };

        // Send the combined data back to the client
        res.status(200).json(combinedData);
      } else {
        // Handle errors if one of the new requests is not OK
        res.status(500).json({ error: "Error fetching data from the bbox or WFS API" });
      }
    } else {
      // Handle errors if any of the first three responses are not OK
      res.status(500).json({ error: "Error fetching data from one or more APIs" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
