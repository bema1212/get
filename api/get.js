const data0 = await response0.json();
console.log(data0); // Log the response

if (!data0 || !data0.centroide_rd) {
  return res.status(400).json({ error: "Invalid or missing centroide_rd in data0" });
}

const centroide_rd = data0.centroide_rd; // or adjust based on actual structure
const coordinates = centroide_rd.match(/POINT\(([^ ]+) ([^ ]+)\)/);
if (!coordinates || coordinates.length < 3) {
  return res.status(400).json({ error: "Invalid coordinates format" });
}

const x = coordinates[1];
const y = parseFloat(coordinates[2]) + 1; // Ensure y is a number and add 1

const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application%2Fjson&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG%3A28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${x},${y},${x},${y}`;
