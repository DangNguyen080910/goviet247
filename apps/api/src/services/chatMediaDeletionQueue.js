// Rotate past failed records so one broken object cannot block later deletions.
export function createChatMediaDeletionQueue() {
  let cursor = null;
  return async function drain(db, remove, logger = console) {
    const where = {OR: [{audioDeleteKey: {not: null}}, {imageDeleteKey: {not: null}}]};
    const query = {where: {...where, ...(cursor ? {id: {gt: cursor}} : {})}, orderBy: {id: "asc"}, take: 20,
      select: {id: true, audioDeleteKey: true, imageDeleteKey: true}};
    let rows = await db.tripChatMessage.findMany(query);
    if (!rows.length && cursor) rows = await db.tripChatMessage.findMany({...query, where});
    cursor = rows.length === 20 ? rows[rows.length - 1].id : null;
    for (const row of rows) {
      for (const field of ["audioDeleteKey", "imageDeleteKey"]) {
        if (!row[field]) continue;
        try {
          await remove(row[field]);
          await db.tripChatMessage.update({where: {id: row.id}, data: {[field]: null}});
        } catch (error) {
          logger.error("[TripChat] media deletion pending", row.id, error.message);
        }
      }
    }
  };
}
