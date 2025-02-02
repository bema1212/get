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
      return res.status(400).json({ error: "target0, target1, and target2 parameters are required" });
    }

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?bbox=${target2}&outputformat=application/json`;
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=<fes:Filter><fes:PropertyIsEqualTo><fes:PropertyName>identificatie</fes:PropertyName><fes:Literal>${encodeURIComponent(target1)}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;

    const eponUrl2 = `https://pico.geodan.nl/cgi-bin/qgis_mapserv.fcgi?map=/usr/lib/cgi-bin/projects/gebouw_woningtype.qgs&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=gebouw&QUERY_LAYERS=gebouw&INFO_FORMAT=text/xml&FEATURE_COUNT=10&filter=<Filter><PropertyIsEqualTo><PropertyName>gebouw_id</PropertyName><Literal>${target1}</Literal></PropertyIsEqualTo></Filter>`;

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

    const fetchEponWithFallback = async () => {
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

    const apiUrl6 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=200&outputFormat=application/json&srsName=EPSG:4326&typeName=bag:pand&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${x},${y}</gml:coordinates></gml:Point><Distance units='m'>70</Distance></DWithin></Filter>`;
    const data6 = await fetchWithErrorHandling(apiUrl6);

    if (!data5.features || data5.features.length === 0) {
      console.warn("Warning: data5 (Verblijfsobject) is empty. This may affect MERGED results.");
    }

    if (!data6.features || data6.features.length === 0) {
      console.warn("Warning: data6 (PAND) is empty. This may affect MERGED results.");
    }

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

        if (!additionalInfo || additionalInfo.error || !pandData) {
          console.log(`Skipping feature: ${identificatie}, no matching Pand or additional data.`);
          return null;
        }

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
      MERGED: mergedData.length > 0 ? mergedData : "No valid MERGED data found",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
