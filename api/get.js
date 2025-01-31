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
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=%3Cfes:Filter%3E%3Cfes:PropertyIsEqualTo%3E%3Cfes:PropertyName%3Eidentificatie%3C/fes:PropertyName%3E%3Cfes:Literal%3E${encodedTarget1}%3C/fes:Literal%3E%3C/fes:PropertyIsEqualTo%3E%3C/fes:Filter%3E`;

    const [x, y] = target2.split(',').map(coord => parseFloat(coord));
    const apiUrl6 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=100&outputFormat=application/json&srsName=EPSG:28992&typeName=bag:pand&Filter=%3CFilter%3E%3CDWithin%3E%3CPropertyName%3EGeometry%3C/PropertyName%3E%3Cgml:Point%3E%3Cgml:coordinates%3E${x},${y}%3C/gml:coordinates%3E%3C/gml:Point%3E%3CDistance%20units='m'%3E50%3C/Distance%3E%3C/DWithin%3E%3C/Filter%3E`;

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

    const [data0, data1, data2, data5, data6] = await Promise.all([
      fetchWithErrorHandling(apiUrl0),
      fetchWithErrorHandling(apiUrl1, { headers: { "Authorization": process.env.AUTH_TOKEN } }),
      fetchWithErrorHandling(apiUrl2),
      fetchWithErrorHandling(apiUrl5),
      fetchWithErrorHandling(apiUrl6)
    ]);

    const mergedData = (data5.features || []).map(feature => {
      const pandIdentificatie = feature.properties?.pandidentificatie;
      if (!pandIdentificatie) return feature;
      
      const matchingPand = (data6.features || []).find(pand => 
        pand.properties?.identificatie === pandIdentificatie
      );
      
      if (matchingPand && matchingPand.geometry) {
        return { ...feature, pand_geometry: matchingPand.geometry };
      }
      return feature;
    });

    const combinedData = {
      LOOKUP: data0,
      EPON: data1,
      NETB: data2,
      OBJECT: data5,
      PAND: data6,
      MERGED: mergedData
    };

    res.status(200).json(combinedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
