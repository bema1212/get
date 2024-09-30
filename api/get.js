if (response3.ok && response4.ok) {
    const data3 = await response3.json();
    const data4 = await response4.json();

    // Initialize data5
    const data5 = [];

    // Create an array to hold all 'identificatie' values for data6
    const data6 = [];

    // Fetch additional data for each feature in data4
    for (const feature of data4.features) {
        // Extract the identificatie and add it to data6
        if (feature.properties && feature.properties.identificatie) {
            data6.push(feature.properties.identificatie);
        }

        // Get coordinates directly from the feature's geometry
        const coords = feature.geometry.coordinates.join(','); // Create a string from the coordinates

        // Construct the API URL for fetching additional data for each feature
        const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=100&outputFormat=application/json&srsName=EPSG:28992&typeName=bag:pand&count=1&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${coords}</gml:coordinates></gml:Point><Distance units='m'>0.5</Distance></DWithin></Filter>`;

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
        data6: data6, // Add data6 which is the array of identificatie values
    };

    // Send the combined data back to the client
    res.status(200).json(combinedData);
}
