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

    const results = await Promise.allSettled([
      fetch(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetch(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN,
          'Content-Type': 'application/json',
        }
      }),
      fetch(apiUrl2, { headers: { 'Content-Type': 'application/json' } }),
      fetch(apiUrl5, { headers: { 'Content-Type': 'application/json' } })
    ]);

    const [result0, result1, result2, result5] = results;
    const data = {};

    if (result0.status === "fulfilled" && result0.value.ok) {
      data.LOOKUP = await result0.value.json();
    } else {
      data.LOOKUP = { error: "Failed to fetch data from LOOKUP API" };
    }

    if (result1.status === "fulfilled" && result1.value.ok) {
      data.EPON = await result1.value.json();
    } else {
      data.EPON = { error: "Failed to fetch data from EPON API" };
    }

    if (result2.status === "fulfilled" && result2.value.ok) {
      data.NETB = await result2.value.json();
    } else {
      data.NETB = { error: "Failed to fetch data from NETB API" };
    }

    if (result5.status === "fulfilled" && result5.value.ok) {
      data.OBJECT = await result5.value.json();
    } else {
      data.OBJECT = { error: "Failed to fetch data from OBJECT API" };
    }

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

      const data4Features = data4.features;

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

      const mergedData = data4Features.map(feature => {
        const identificatie = feature.properties?.identificatie;
        const additionalInfo = additionalDataMap.get(identificatie);

        return {
          ...feature,
          additionalData: additionalInfo ? additionalInfo.data : null,
          error: additionalInfo ? additionalInfo.error : null
        };
      });

      data.KADAS = data3;
      data.MERGED = mergedData;
    } else {
      data.KADAS = { error: "Failed to fetch data from Kadastral API" };
    }

    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
