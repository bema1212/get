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
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&&SRSNAME=urn:ogc:def:crs:EPSG::4326&bbox=${target2}`;
    const encodedTarget1 = encodeURIComponent(target1);
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=%3Cfes:Filter%3E%3Cfes:PropertyIsEqualTo%3E%3Cfes:PropertyName%3Eidentificatie%3C/fes:PropertyName%3E%3Cfes:Literal%3E${encodedTarget1}%3C/fes:Literal%3E%3C/fes:PropertyIsEqualTo%3E%3C/fes:Filter%3E`;

    const fetchWithErrorHandling = async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        return { error: "error" };
      }
    };

    // Retry function for eponUrl2
    const fetchWithRetry = async (url, options = {}, retries = 2, delay = 3000) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url, options);
          if (response.ok) {
            return await response.text(); // Handle XML response
          }
          console.log(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
          console.error(`Error on attempt ${attempt}:`, error.message);
          if (attempt === retries) return { error: "error" };
        }
      }
    };

    // Fetch EPON with fallback
    const fetchEponWithFallback = async () => {
      const eponUrl2 = `https://pico.geodan.nl/cgi-bin/qgis_mapserv.fcgi?DPI=120&map=/usr/lib/cgi-bin/projects/gebouw_woningtype.qgs&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&CRS=EPSG%3A3857&WIDTH=937&HEIGHT=842&LAYERS=gebouw&STYLES=&FORMAT=image%2Fjpeg&QUERY_LAYERS=gebouw&INFO_FORMAT=text/xml&I=611&J=469&FEATURE_COUNT=10&bbox=${target2}`;

      let response = await fetchWithErrorHandling(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN,
          "Content-Type": "application/json",
        },
      });

      if (response.error) {
        console.log("EPON primary API failed, trying fallback...");
        response = await fetchWithRetry(eponUrl2, { headers: { "Content-Type": "application/xml" } }, 2, 3000);
      }

      return response;
    };

    const [data0, data1, data2, data5] = await Promise.all([
      fetchWithErrorHandling(apiUrl0),
      fetchEponWithFallback(),
      fetchWithErrorHandling(apiUrl2),
      fetchWithErrorHandling(apiUrl5),
    ]);

    const [x, y] = target2.split(',').map(coord => parseFloat(coord));

    const apiUrl6 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=200&outputFormat=application/json&srsName=EPSG:4326&typeName=bag:pand&Filter=%3CFilter%3E%3CDWithin%3E%3CPropertyName%3EGeometry%3C/PropertyName%3E%3Cgml:Point%3E%3Cgml:coordinates%3E${x},${y}%3C/gml:coordinates%3E%3C/gml:Point%3E%3CDistance%20units=%27m%27%3E70%3C/Distance%3E%3C/DWithin%3E%3C/Filter%3E`;
    const data6 = await fetchWithErrorHandling(apiUrl6);

    const data4Features = data5.features || [];

    const additionalData = await Promise.all(data4Features.map(async (feature) => {
      const identificatie = feature.properties?.identificatie;
      if (!identificatie) return null;

      const apiUrl = `https://yxorp-pi.vercel.app/api/handler?url=https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${identificatie}`;

      try {
        const response = await fetch(apiUrl, {
          headers: {
            "Authorization": process.env.AUTH_TOKEN,
            "Content-Type": "application/json",
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
    additionalDataFiltered.forEach(item => additionalDataMap.set(item.identificatie, item));

    const mergedData = data4Features
      .map(feature => {
        const identificatie = feature.properties?.identificatie;
        const additionalInfo = additionalDataMap.get(identificatie);
        const pandData = data6.features.find(pand => pand.properties?.identificatie === feature.properties?.pandidentificatie);

        if (!additionalInfo || additionalInfo.error || !pandData) return null;

        return {
          ...feature,
          additionalData: additionalInfo.data,
          additionalData2: [{ geometry: pandData.geometry }],
        };
      })
      .filter(item => item !== null);

    res.status(200).json({
      LOOKUP: data0,
      EPON: data1,
      NETB: data2,
      OBJECT: data5,
      MERGED: mergedData,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
