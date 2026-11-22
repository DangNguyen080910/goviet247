export function chatMapLinks(latitude,longitude) {
  if (latitude==null || longitude==null || latitude==='' || longitude==='') throw new Error('Định vị không hợp lệ.');
  const lat=Number(latitude),lon=Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw new Error('Định vị không hợp lệ.');
  const query=encodeURIComponent(`${lat},${lon}`);
  return {google:`https://www.google.com/maps/search/?api=1&query=${query}`,
    googleIos:`comgooglemaps://?q=${query}&center=${query}&zoom=16`,
    apple:`https://maps.apple.com/?ll=${query}&q=${query}`,
    geo:`geo:${lat},${lon}?q=${query}`};
}

// Native apps can reliably query installation; websites use the HTTPS link.
export async function openChatMap(latitude,longitude,{os,canOpenURL,openURL}) {
  const links=chatMapLinks(latitude,longitude);
  if (os==='ios') {
    try {if (await canOpenURL('comgooglemaps://')) {await openURL(links.googleIos);return;}} catch { /* Fall back to the phone's map. */ }
    try {await openURL(links.apple);return;} catch { /* Apple Maps can also be unavailable. */ }
  }
  try {await openURL(links.google);} catch (error) {
    if (os!=='android') throw error;
    await openURL(links.geo);
  }
}
