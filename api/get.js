export default async function handler(req, res) {
    try {
        const { x, y } = req.query; // Coordinates

        const apiUrl1 = `https://example.com/api1?x=${x}&y=${y}`;
        const apiUrl2 = `https://example.com/api2?x=${x}&y=${y}`;
        const apiUrl3 = `https://example.com/api3?x=${x}&y=${y}`;
        const apiUrl4 = `https://example.com/api4?x=${x}&y=${y}`;
        const apiUrl5 = `https://example.com/api5?x=${x}&y=${y}`;

        // PAND API (New)
        const apiUrl6 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=100&outputFormat=application/json&srsName=EPSG:28992&typeName=bag:pand&Filter=%3CFilter%3E%20%3CDWithin%3E%3CPropertyName%3EGeometry%3C/PropertyName%3E%3Cgml:Point%3E%20%3Cgml:coordinates%3E${x},${y}%3C/gml:coordinates%3E%20%3C/gml:Point%3E%3CDistance%20units=%27m%27%3E50%3C/Distance%3E%3C/DWithin%3E%3C/Filter%3E`;

        // Fetch all API data in parallel
        const [data1, data2, data3, data4, data5, data6] = await Promise.all([
            fetch(apiUrl1).then((res) => res.json()),
            fetch(apiUrl2).then((res) => res.json()),
            fetch(apiUrl3).then((res) => res.json()),
            fetch(apiUrl4).then((res) => res.json()),
            fetch(apiUrl5).then((res) => res.json()),
            fetch(apiUrl6).then((res) => res.json()), // Fetch PAND data
        ]);

        // Merge the fetched data (Assuming `data4` is the primary dataset containing MERGED)
        const mergedData = data4.MERGED || [];

        // Attach geometry from PAND data to matching entries in MERGED
        mergedData.forEach((mergedItem) => {
            const pandId = mergedItem.properties.pandidentificatie;
            const matchedPand = data6.features.find(
                (pand) => pand.properties.identificatie === pandId
            );

            if (matchedPand) {
                // Ensure additionalData2 exists
                if (!mergedItem.additionalData2) {
                    mergedItem.additionalData2 = [];
                }

                // Push the geometry object properly formatted
                mergedItem.additionalData2.push({
                    geometry: matchedPand.geometry
                });
            }
        });

        // Send the response
        res.status(200).json({
            MERGED: mergedData,
            PAND: data6, // Keep the PAND data for reference if needed
        });

    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
