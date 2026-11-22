// Event evidence is saved in the same transaction as the trip change.
export function tripChanges(before, after, fields) {
  const value = item => item == null ? null : item instanceof Date ? item.toISOString() : typeof item === 'bigint' ? String(item) : typeof item?.toJSON === 'function' ? item.toJSON() : item;
  return Object.entries(fields).flatMap(([key,label]) => {
    const previous = value(before[key]), next = value(after[key]);
    return JSON.stringify(previous) === JSON.stringify(next) ? [] : [{label,before:previous,after:next}];
  });
}
export function makeTripEvent(trip, options) {
  const driver = options.driver || trip.driver || {};
  const profile = driver.driverProfile || {};
  return {
    version: 1, kind: options.kind, driverId: trip.driverId || null,
    driverProfileId: profile.id || null,
    driverName: profile.fullName || driver.displayName || null,
    driverPhone: driver.phones?.[0]?.e164 || null,
    assignmentId: trip.walletHoldId || null,
    acceptedAt: trip.acceptedAt ? new Date(trip.acceptedAt).toISOString() : null,
    actorId: options.actorId == null ? null : String(options.actorId),
    reason: options.reason || null,
    resolution: options.resolution || null,
    changes: options.changes || [],
  };
}

export async function recordTripEvent(tx, trip, options) {
  const eventData = makeTripEvent(trip, options);
  return tx.adminTripActionLog.create({ data: {
    tripId: trip.id, fromStatus: options.fromStatus, toStatus: options.toStatus,
    actorRole: options.actorRole,
    actorId: ['ADMIN','STAFF'].includes(options.actorRole) ? Number(options.actorId) || null : null,
    actorUsername: options.actorName || eventData.driverName || trip.driverId || String(options.actorId || options.actorRole),
    note: options.reason || null, eventData,
  } });
}

const millis = value => new Date(value).getTime();
const isEnd = item => ['DRIVER_CANCELLED','CUSTOMER_CANCELLED','ADMIN_CANCELLED','RELEASED','CANCELLATION_RECORDED'].includes(item.kind);
const sameEnd = (a, b) => isEnd(a) && isEnd(b) && a.driverId === b.driverId && Math.abs(millis(a.createdAt) - millis(b.createdAt)) < 2000;

// Older data is shown with its actual source, never presented as a new audit record.
export function mergeTripHistory({trip, logs = [], wallets = [], penalties = [], archives = [], drivers = [], partnerLogs = []}) {
  const identities = new Map(drivers.map(driver => [driver.id, driver]));
  const identity = (driverId, saved = {}) => {
    const driver = identities.get(driverId) || (trip.driverId === driverId ? trip.driver : null);
    return {driverId: driverId || null,
      driverName: saved.driverName || saved.driverNameSnapshot || driver?.driverProfile?.fullName || driver?.displayName || null,
      driverPhone: saved.driverPhone || saved.driverPhoneSnapshot || driver?.phones?.[0]?.e164 || null};
  };
  const items = logs.filter(log => log.eventData?.version === 1).map(log => ({
    id: `log:${log.id}`, createdAt: log.createdAt, ...log.eventData,
    fromStatus:log.fromStatus,toStatus:log.toStatus, reason:log.eventData.reason || log.note || null,
    actorRole: log.actorRole, actorName: log.actorRole === 'DRIVER' ? log.eventData.driverName || log.actorUsername : log.actorUsername, source: 'RECORDED',
  }));
  for (const log of logs.filter(log => !log.eventData)) {
    const driverId = log.actorRole === 'DRIVER' ? log.actorUsername : null;
    items.push({id:`legacy-log:${log.id}`,kind:log.toStatus === 'CANCELLED' ? 'ADMIN_CANCELLED' : log.fromStatus !== log.toStatus ? 'STATUS_CHANGED' : 'TRIP_UPDATED',
      createdAt:log.createdAt,...identity(driverId),actorRole:log.actorRole,actorName:driverId ? identity(driverId).driverName || driverId : log.actorUsername,
      fromStatus:log.fromStatus,toStatus:log.toStatus,reason:log.note || null,source:'ADMIN_LOG'});
  }
  const assignments = new Set(items.filter(item => item.kind === 'ACCEPTED' && item.assignmentId).map(item => item.assignmentId));
  const seenWallets = new Set();
  for (const wallet of wallets) {
    if (!['COMMISSION_HOLD','DRIVER_VAT_HOLD','DRIVER_PIT_HOLD'].includes(wallet.type)) {
      if (wallet.type === 'TRIP_CANCEL_PENALTY') continue;
      items.push({id:`wallet:${wallet.id}`,kind:'WALLET_UPDATED',createdAt:wallet.createdAt,
        ...identity(wallet.driverProfile?.userId,{driverName:wallet.driverProfile?.fullName,driverPhone:wallet.driverProfile?.user?.phones?.[0]?.e164}),
        actorRole:null,actorName:null,reason:wallet.note || null,amount:Number(wallet.amount),source:'WALLET'});
      continue;
    }
    const driverId = wallet.driverProfile?.userId;
    if (!driverId) continue;
    const key = wallet.walletHoldId || `${wallet.driverProfileId}:${new Date(wallet.createdAt).toISOString()}`;
    if (assignments.has(key) || seenWallets.has(key)) continue;
    seenWallets.add(key);
    const driver = wallet.driverProfile?.user;
    items.push({id: `wallet:${wallet.id}`, kind:'ACCEPTED', createdAt:wallet.createdAt,
      ...identity(driverId, {driverName:wallet.driverProfile.fullName || driver?.displayName,driverPhone:driver?.phones?.[0]?.e164}),
      assignmentId: wallet.walletHoldId || null, actorRole:'DRIVER', actorName:null,
      reason:'Lần nhận được đối chiếu từ giao dịch khấu trừ ví.', source:'WALLET'});
  }
  for (const penalty of penalties) {
    const item = {id:`penalty:${penalty.id}`,kind:'PENALTY_RECORDED',
      createdAt:penalty.createdAt,...identity(penalty.driverId, penalty),assignmentId:null,amount:Number(penalty.penaltyAmount || 0),
      actorRole:null,actorName:null,
      reason:'Có bản ghi phạt huỷ; dữ liệu cũ không xác định chắc người bấm huỷ.',source:'PENALTY'};
    items.push(item);
  }
  for (const archive of archives) {
    const driverId = /^Kết thúc lượt tài xế ([^\s.]+)\./.exec(archive.text || '')?.[1];
    if (!driverId) continue;
    const item = {id:`archive:${archive.id}`,kind:'RELEASED',createdAt:archive.createdAt,
      ...identity(driverId),assignmentId:null,actorRole:null,actorName:null,
      reason:archive.text.split('Lý do: ').slice(1).join('Lý do: ') || null,source:'ARCHIVE'};
    if (!items.some(existing => sameEnd(existing,item))) items.push(item);
  }
  if (trip.driverId && trip.acceptedAt && !items.some(item => item.kind === 'ACCEPTED' &&
    (trip.walletHoldId ? item.assignmentId === trip.walletHoldId : item.driverId === trip.driverId && Math.abs(millis(item.createdAt)-millis(trip.acceptedAt)) < 2000))) {
    items.push({id:'current-assignment',kind:'ACCEPTED',createdAt:trip.acceptedAt,...identity(trip.driverId),
      assignmentId:trip.walletHoldId || null,actorRole:'DRIVER',actorName:null,reason:null,source:'CURRENT_TRIP'});
  }
  for (const log of partnerLogs.filter(log=>log.action !== 'CREATE_TRIP')) {
    items.push({id:`partner:${log.id}`,kind:log.action === 'CANCEL_TRIP' ? 'CUSTOMER_CANCELLED' : 'PARTNER_UPDATED',
      createdAt:log.createdAt,driverId:null,actorRole:'PARTNER',actorName:log.actorLabel,source:'PARTNER_LOG',
      reason:log.action === 'ASSIGN_TRIP' ? 'Đối tác đổi điều phối viên phụ trách.' : log.action === 'CANCEL_TRIP' ? 'Đối tác huỷ chuyến chờ duyệt.' : log.action,
      changes:log.detail?.from !== undefined || log.detail?.to !== undefined ? [{label:'Điều phối viên (mã)',before:log.detail.from || null,after:log.detail.to || null}] : []});
  }
  if (trip.createdAt && !items.some(item=>item.kind==='CREATED')) items.push({id:'created-trip',kind:'CREATED',createdAt:trip.createdAt,driverId:null,
    actorRole:trip.partnerCompanyId?'PARTNER':'RIDER',actorName:trip.partnerBookerName || trip.rider?.displayName || null,
    reason:'Tạo yêu cầu đặt chuyến.',source:'CURRENT_TRIP'});
  if (trip.cancelledAt && !items.some(item=>['ADMIN_CANCELLED','DRIVER_CANCELLED','CUSTOMER_CANCELLED'].includes(item.kind) && Math.abs(millis(item.createdAt)-millis(trip.cancelledAt))<2000)) {
    items.push({id:'cancelled-trip',kind:'CANCELLED',createdAt:trip.cancelledAt,driverId:null,actorRole:null,actorName:null,reason:trip.cancelReason,source:'CURRENT_TRIP'});
  }
  if (trip.verifiedAt && !items.some(item=>['APPROVED','RESENT'].includes(item.kind) && Math.abs(millis(item.createdAt)-millis(trip.verifiedAt))<2000)) {
    items.push({id:'verified-trip',kind:'APPROVED',createdAt:trip.verifiedAt,driverId:null,
      actorRole:'ADMIN',actorName:trip.verifiedBy?.username || null,reason:trip.verifiedNote || null,source:'CURRENT_TRIP'});
  }
  return items.sort((a,b) => millis(b.createdAt)-millis(a.createdAt) || a.id.localeCompare(b.id));
}

export function makeTripHistoryController(db) {
  return async (req, res) => {
    const tripId = String(req.params.id || '').trim();
    if (!tripId || tripId.length > 160) return res.status(400).json({success:false,message:'Mã chuyến không hợp lệ.'});
    try {
      const userSelect = {id:true,displayName:true,phones:{orderBy:{createdAt:'desc'},take:1,select:{e164:true}},driverProfile:{select:{id:true,fullName:true}}};
      const trip = await db.trip.findUnique({where:{id:tripId},select:{id:true,createdAt:true,partnerCompanyId:true,partnerBookerName:true,
        rider:{select:{displayName:true}},driverId:true,acceptedAt:true,walletHoldId:true,cancelReason:true,cancelledAt:true,
        verifiedAt:true,verifiedNote:true,verifiedBy:{select:{username:true}},driver:{select:userSelect}}});
      if (!trip) return res.status(404).json({success:false,message:'Không tìm thấy chuyến.'});
      const [logs, wallets, penalties, archives, partnerLogs] = await Promise.all([
        db.adminTripActionLog.findMany({where:{tripId},orderBy:[{createdAt:'desc'},{id:'desc'}],take:501}),
        db.driverWalletTransaction.findMany({where:{tripId},
          orderBy:[{createdAt:'desc'},{id:'desc'}],take:501,include:{driverProfile:{select:{userId:true,fullName:true,user:{select:userSelect}}}}}),
        db.driverTripPenaltyLog.findMany({where:{tripId},orderBy:[{createdAt:'desc'},{id:'desc'}],take:501}),
        db.tripChatMessage.findMany({where:{tripId,senderId:'system-assignment',audience:'ADMIN'},select:{id:true,text:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:501}),
        trip.partnerCompanyId ? db.partnerAuditLog.findMany({where:{companyId:trip.partnerCompanyId,targetId:tripId},orderBy:[{createdAt:'desc'},{id:'desc'}],take:501}) : [],
      ]);
      const driverIds = [...new Set([...logs.filter(log=>log.actorRole==='DRIVER'&&!log.eventData).map(log=>log.actorUsername),...penalties.map(p=>p.driverId),...archives.map(a=>/^Kết thúc lượt tài xế ([^\s.]+)\./.exec(a.text||'')?.[1])].filter(Boolean))];
      const drivers = driverIds.length ? await db.user.findMany({where:{id:{in:driverIds}},select:userSelect}) : [];
      res.setHeader('Cache-Control','no-store');
      return res.json({success:true,tripId,items:mergeTripHistory({trip,logs,wallets,penalties,archives,drivers,partnerLogs}),
        limited:[logs,wallets,penalties,archives,partnerLogs].some(rows=>rows.length>500),
        notice:'Lịch sử cũ tổng hợp từ các bản ghi còn lưu, có thể thiếu thay đổi chưa được ghi nhận. Những thay đổi mới lưu ngày giờ, người thực hiện và nội dung trước/sau; thông tin từ dữ liệu hiện tại được ghi rõ nguồn.'});
    } catch (error) {
      console.error('[TripDriverHistory]',error?.code || 'ERROR');
      return res.status(503).json({success:false,message:'Chưa tải được lịch sử nhận/huỷ chuyến. Vui lòng kiểm tra cập nhật API/migration và thử lại.'});
    }
  };
}
