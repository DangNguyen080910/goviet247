// Editors register a save gate so approval and closing cannot discard a draft.
const gates = new Map();
const inFlight = new Map();
export function registerDriverNoteDraft(tripId, save) {
  gates.set(tripId, save);
  return () => { if (gates.get(tripId) === save) gates.delete(tripId); };
}
export async function flushDriverNoteDraft(tripId) {
  if(inFlight.has(tripId))return inFlight.get(tripId);
  const pending=Promise.resolve().then(()=>gates.get(tripId)?.());
  inFlight.set(tripId,pending);
  try{return await pending;}finally{if(inFlight.get(tripId)===pending)inFlight.delete(tripId);}
}
