export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { target0, target1, target2 } = req.query;

    if (!target0 || !target1 || !target2) {
      return res.status(400).json({ error: "Both target1 and target2 parameters are required" });
    }

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&srsname=EPSG:28992&bbox=${target2}`;
    const encodedTarget1 = encodeURIComponent(target1);
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=%3Cfes:Filter%20xmlns:fes=%22http://www.opengis.net/fes/2.0%22%20xmlns:xsi=%22http://www.w3.org/2001/XMLSchema-instance%22%20xsi:schemaLocation=%22http://www.opengis.net/wfs/2.0%20http://schemas.opengis.net/wfs/2.0/wfs.xsd%22%3E%3Cfes:PropertyIsEqualTo%3E%3Cfes:PropertyName%3Eidentificatie%3C/fes:PropertyName%3E%3Cfes:Literal%3E${encodedTarget1}%3C/fes:Literal%3E%3C/fes:PropertyIsEqualTo%3E%3C/fes:Filter%3E`;

    const fetchWithErrorHandling = async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        return { error: "error" }; // Return an object with just "error" as the result
      }
    };

    const [data0, data1, data2, data5, data6] = await Promise.all([
      fetchWithErrorHandling(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetchWithErrorHandling(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN,
          'Content-Type': 'application/json',
        }
      }),
      fetchWithErrorHandling(apiUrl2, { headers: { 'Content-Type': 'application/json' } }),
      fetchWithErrorHandling(apiUrl5, { headers: { 'Content-Type': 'application/json' } }),
      fetchWithErrorHandling(apiUrl6, { headers: { 'Content-Type': 'application/json' } })
    ]);

    if (!response3 || !response4 || !data6) {
      return res.status(500).json({ error: "Error fetching data from the bbox or WFS API" });
    }

    const data3 = response3;
    const data4 = response4;

    const data6Map = new Map();
    // Create a map from data6 using identificatie as the key
    data6.features?.forEach(feature => {
      const identificatie = feature.properties?.identificatie;
      if (identificatie && feature.geometry) {
        data6Map.set(identificatie, feature.geometry); // Store the geometry from data6
      }
    });

    const data4Features = data4.features || [];

    const additionalData = await Promise.all(data4Features.map(async (feature) => {
      const identificatie = feature.properties?.identificatie;
      if (!identificatie) return null;

      const apiUrl = `https://yxorp-pi.vercel.app/api/handler?url=https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${identificatie}`;

      try {
        const response = await fetch(apiUrl, {
          headers: {
            "Authorization": process.env.AUTH_TOKEN,
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          return { identificatie, data };
        } else {
          return { identificatie, error: response.statusText };
        }
      } catch (error) {
        return { identificatie, error: error.message };
      }
    }));

    const additionalDataFiltered = additionalData.filter(item => item !== null);

    const additionalDataMap = new Map();
    additionalDataFiltered.forEach(item => {
      additionalDataMap.set(item.identificatie, item);
    });

    const mergedData = data4Features
      .map(feature => {
        const identificatie = feature.properties?.identificatie;
        const additionalInfo = additionalDataMap.get(identificatie);

        // Only include the feature if there is no error in the additional data
        if (!additionalInfo || additionalInfo.error) {
          return null; // Skip this feature if there's an error or no additional data
        }

        // Find matching geometry from data6 based on identificatie (pandidentificatie in mergedData)
        const geometry = data6Map.get(feature.properties?.pandidentificatie);
        if (geometry) {
          feature.geometry = geometry; // Add geometry from data6 to the feature
        }

        return {
          ...feature,
          additionalData: additionalInfo.data, // Only include the successful data
        };
      })
      .filter(item => item !== null); // Remove any null (error or missing) entries

    const combinedData = {
      LOOKUP: data0,
      EPON: data1,
      NETB: data2,
      KADAS: data3,
      OBJECT: data5,
      MERGED: mergedData, // Only includes successful data
    };

    res.status(200).json(combinedData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
