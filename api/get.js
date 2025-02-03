export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { target0, target1, target2, target3 } = req.query;

    if (!target0 || !target1 || !target2 || !target3) {
      return res.status(400).json({ error: "Both target1 and target2 parameters are required" });
    }

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&&SRSNAME=urn:ogc:def:crs:EPSG::28992&bbox=${target3}`;
    const apiUrl7 = `https://pico.geodan.nl/cgi-bin/qgis_mapserv.fcgi?DPI=120&map=/usr/lib/cgi-bin/projects/gebouw_woningtype.qgs&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&CRS=EPSG%3A28992&WIDTH=937&HEIGHT=842&LAYERS=gebouw&STYLES=&FORMAT=image%2Fjpeg&QUERY_LAYERS=gebouw&INFO_FORMAT=text/xml&I=611&J=469&FEATURE_COUNT=10&bbox==${target3}`;
    
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

    const fetchXMLWithRetry = async (url, options = {}, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        try {
          const response = await fetch(url, options);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return await response.text(); // Return raw XML
        } catch (error) {
          console.error(`Error fetching ${url}:`, error.message);
        }
      }
      return "<error>error</error>"; // Return XML formatted error
    };

    const [data0, data1Initial, data2, data5] = await Promise.all([
      fetchWithErrorHandling(apiUrl0, { headers: { 'Content-Type': 'application/json' } }),
      fetchWithErrorHandling(apiUrl1, {
        headers: {
          "Authorization": process.env.AUTH_TOKEN,
          'Content-Type': 'application/json',
        }
      }),
      fetchWithErrorHandling(apiUrl2, { headers: { 'Content-Type': 'application/json' } }),
      fetchWithErrorHandling(apiUrl5, { headers: { 'Content-Type': 'application/json' } })
    ]);

    const data1 = data1Initial.error ? await fetchXMLWithRetry(apiUrl7, {
      headers: {
        "Authorization": process.env.AUTH_TOKEN,
        'Content-Type': 'application/json',
      }
    }, 2) : data1Initial;

    // Restore MERGED data logic
    const data4Features = data5.features || [];
    const mergedData = data4Features.map(feature => ({
      ...feature
    }));

    const combinedData = {
      LOOKUP: data0,
      EPON: data1, // Now returns raw XML if apiUrl1 fails
      NETB: data2,
      OBJECT: data5,
      MERGED: mergedData, // Restored MERGED data
    };

    res.status(200).json(combinedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
