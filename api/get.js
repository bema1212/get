// Create a map from data6 for fast lookup
const data6Map = new Map();
(data6.features || []).forEach(feature => {
  if (feature.properties && feature.properties.identificatie) {
    data6Map.set(feature.properties.identificatie, feature.geometry);
  }
});

// Merge geometry into mergedData
const updatedMergedData = mergedData.map(feature => {
  const pandIdentificatie = feature.properties?.pandidentificatie;

  if (pandIdentificatie && data6Map.has(pandIdentificatie)) {
    return {
      ...feature,
      geometry: data6Map.get(pandIdentificatie), // Add geometry from data6
    };
  }
  return feature; // Keep feature unchanged if no match found
});

// Ensure mergedData is not empty
if (updatedMergedData.length === 0) {
  console.warn("Warning: mergedData is empty after merging with data6.");
}

mergedData = updatedMergedData;
