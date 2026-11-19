// Build the API's trusted gazetteer from the static place choices shipped to clients.
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../../../', import.meta.url);
const definitions = [['provinces','PROVINCES'],['southLocations','SOUTH_LOCATIONS'],['centralLocations','CENTRAL_LOCATIONS'],['mekongLocations','MEKONG_LOCATIONS'],['airportLocations','AIRPORT_LOCATIONS']];
const places = new Map();
const provinceBySlug = new Map();
for (const base of ['apps/web/src/data','apps/rider-mobile/constants']) {
  for (const [file,key] of definitions) {
    const source = fs.readFileSync(new URL(`${base}/${file}.js`, root), 'utf8')
      .replaceAll('export const', 'const').replace(/^export default .*;?$/gm, '');
    for (const place of vm.runInNewContext(source + `; ${key}`)) {
      if (key === 'PROVINCES') provinceBySlug.set(place.placeId.split(':')[2], place.name);
      const previous = places.get(place.placeId);
      if (previous && previous.fullAddress !== place.fullAddress) throw new Error(`Conflicting local place: ${place.placeId}`);
      places.set(place.placeId, { fullAddress: place.fullAddress, province: provinceBySlug.get(place.placeId.split(':')[2]) || String(place.maskedAddress || '').split(',').at(-1)?.trim() || '' });
    }
  }
}
fs.writeFileSync(new URL('apps/api/src/data/regional-pricing-places.json', root), JSON.stringify(Object.fromEntries(places), null, 2) + '\n');
console.log(`Saved ${places.size} trusted local places.`);
