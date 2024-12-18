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

    const [response0, response1, response2] = await Promise.all([
      fetch(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetch(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN,
          'Content-Type': 'application/json',
        }
      }),
      fetch(apiUrl2, { headers: { 'Content-Type': 'application/json' } })
    ]);

    if (response0.ok && response1.ok && response2.ok) {
      const data0 = await response0.json();
      const data1 = await response1.json();
      const data2 = await response2.json();

      const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG:28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${target2}`;
      const response3 = await fetch(apiUrl3, {
        headers: { 'Content-Type': 'application/json' },
      });

      const [x, y] = target2.split(',').map(coord => parseFloat(coord));

      const apiUrl4 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&propertyname=&count=200&outputFormat=json&srsName=EPSG:28992&typeName=bag:verblijfsobject&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${x},${y}</gml:coordinates></gml:Point><Distance units='m'>50</Distance></DWithin></Filter>`;
      const response4 = await fetch(apiUrl4, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response3.ok && response4.ok) {
        const data3 = await response3.json();
        const data4 = await response4.json();

        // Use all features from data4 without filtering for properties only
        const data4Features = data4.features;

        const additionalData = await Promise.all(data4Features.map(async (feature) => {
          const identificatie = feature.properties?.identificatie;
          if (!identificatie) return null; // Skip if no identificatie

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

        // Filter out null results due to missing identificatie
        const additionalDataFiltered = additionalData.filter(item => item !== null);

        // Map additional data based on identificatie for merging
        const additionalDataMap = new Map();
        additionalDataFiltered.forEach(item => {
          additionalDataMap.set(item.identificatie, item);
        });

        // Merge additionalData with each feature in data4
        const mergedData = data4Features.map(feature => {
          const identificatie = feature.properties?.identificatie;
          const additionalInfo = additionalDataMap.get(identificatie);

          return {
            ...feature,
            additionalData: additionalInfo ? additionalInfo.data : null,
            error: additionalInfo ? additionalInfo.error : null
          };
        });

        const combinedData = {
          data0,
          data1,
          data2,
          data3,
          mergedData
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
