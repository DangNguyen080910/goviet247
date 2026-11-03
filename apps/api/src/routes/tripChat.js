import {chatTripSummary} from '../shared/chatTripDetail.js';
import { prepareChatImage, CHAT_IMAGE_MAX_BYTES } from '../services/chatImage.js';
import { recordBlockedChatContact } from '../services/chatContactAlert.js';
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../utils/db.js';
import { chatAuth, chatAccess, chatTripWhere, messageWhere, createChatMessage, deleteChatMessage, storeAudio, removeAudio, audioUrl } from '../services/tripChatService.js';
import { chatCanSend, validateChatPayload, CHAT_QUICK_REPLIES, chatMessageForClient } from '../shared/tripChat.js';
const router = Router();
router.use(chatAuth);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const wrap = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error('[TripChat]', e.message);
    res.status(e.status || 400).json({
      success: false,
      code: e.code,
      message: e.status ? e.message : 'Không xử lý được yêu cầu. Vui lòng thử lại.'
    });
  }
};
const fields = {
  deletedAt: true,
  audience: true,
  id: true,
  tripId: true,
  senderId: true,
  senderRole: true,
  senderLabel: true,
  kind: true,
  text: true,
  durationMs: true,
  latitude: true,
  longitude: true,
  locationLabel: true,
  createdAt: true,
  clientId: true
};
router.get('/:id/trip',wrap(async(req,res)=>{
  const trip=await chatAccess(prisma,req.params.id,req.chatActor,{allowEnded:true});
  const stops=await prisma.tripStop.findMany({where:{tripId:trip.id},orderBy:{seq:'asc'},select:{address:true}});
  res.json({success:true,trip:chatTripSummary(trip,stops)});
}));
router.get('/conversations', wrap(async (req, res) => {
  const actor = req.chatActor;
  const trips = await prisma.trip.findMany({
    where: {
      AND: [await chatTripWhere(actor), {
        chatMessages: {
          some: {}
        }
      }]
    },
    select: {
      id: true,
      status: true,
      driverId: true,
      acceptedAt: true,
      riderId: true,
      riderPhone: true,
      pickupAddress: true,
      dropoffAddress: true
    },
    take: 200,
    orderBy: {
      updatedAt: 'desc'
    }
  });
  const items = [];
  for (const trip of trips) {
    const a = {
      ...actor
    };
    let authorizedTrip;
    try {
      authorizedTrip = await chatAccess(prisma, trip.id, a);
    } catch {
      continue;
    }
    const where = messageWhere(authorizedTrip, a);
    const read = await prisma.tripChatRead.findUnique({
      where: {
        tripId_actorId: {
          tripId: trip.id,
          actorId: a.id
        }
      }
    });
    const unread = await prisma.tripChatMessage.count({
      where: {
        ...where,
        senderId: {
          not: a.id
        },
        OR: [{
          createdAt: {
            gt: read?.readAt || new Date(0)
          }
        }, {
          createdAt: read?.readAt || new Date(0),
          id: {
            gt: read?.messageId || ''
          }
        }]
      }
    });
    const last = await prisma.tripChatMessage.findFirst({
      where,
      select: fields,
      orderBy: [{
        createdAt: 'desc'
      }, {
        id: 'desc'
      }]
    });
    if (last) items.push({
      tripId: trip.id,
      status: trip.status,
      unread,
      last: chatMessageForClient(last, req.query.media === 'images'),
      canSend: chatCanSend(trip, a)
    });
  }
  items.sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
  res.json({
    success: true,
    items,
    actorId: actor.id,
    unread: items.reduce((s, i) => s + i.unread, 0)
  });
}));
router.get('/:tripId/messages', wrap(async (req, res) => {
  const a = req.chatActor,
    trip = await chatAccess(prisma, req.params.tripId, a);
  const before = String(req.query.before || '');
  const cursor = before ? await prisma.tripChatMessage.findFirst({
    where: {
      ...messageWhere(trip, a),
      id: before
    },
    select: {
      createdAt: true,
      id: true
    }
  }) : null;
  if (before && !cursor) return res.status(400).json({
    success: false,
    message: 'Mốc tin nhắn không hợp lệ.'
  });
  const where = {
    AND: [messageWhere(trip, a), ...(cursor ? [{
      OR: [{
        createdAt: {
          lt: cursor.createdAt
        }
      }, {
        createdAt: cursor.createdAt,
        id: {
          lt: cursor.id
        }
      }]
    }] : [])]
  };
  const rows = await prisma.tripChatMessage.findMany({
    where,
    select: fields,
    orderBy: [{
      createdAt: 'desc'
    }, {
      id: 'desc'
    }],
    take: 51
  });
  const hasMore = rows.length > 50,
    items = rows.slice(0, 50).reverse();
  if (a.role === 'ADMIN' && !before) {
    const last = await prisma.tripChatAccess.findFirst({
      where: {
        tripId: trip.id,
        actorId: a.id,
        action: 'READ',
        createdAt: {
          gte: new Date(Date.now() - 300000)
        }
      }
    });
    if (!last) await prisma.tripChatAccess.create({
      data: {
        tripId: trip.id,
        actorId: a.id,
        action: 'READ'
      }
    });
  }
  res.set('Cache-Control', 'no-store').json({
    success: true,
    items: items.map(m => chatMessageForClient(m, req.query.media === 'images')),
    hasMore,
    actor: a,
    canSend: chatCanSend(trip, a),
    quickReplies: CHAT_QUICK_REPLIES[a.role],
    status: trip.status
  });
}));
router.post('/:tripId/read', wrap(async (req, res) => {
  const a = req.chatActor,
    trip = await chatAccess(prisma, req.params.tripId, a);
  const m = await prisma.tripChatMessage.findFirst({
    where: {
      ...messageWhere(trip, a),
      id: String(req.body.messageId || '')
    }
  });
  if (m) {
    const key = {
      tripId: trip.id,
      actorId: a.id
    };
    await prisma.tripChatRead.upsert({
      where: {
        tripId_actorId: key
      },
      create: {
        ...key,
        readAt: m.createdAt,
        messageId: m.id
      },
      update: {}
    });
    await prisma.tripChatRead.updateMany({
      where: {
        ...key,
        OR: [{
          readAt: {
            lt: m.createdAt
          }
        }, {
          readAt: m.createdAt,
          messageId: {
            lt: m.id
          }
        }]
      },
      data: {
        readAt: m.createdAt,
        messageId: m.id
      }
    });
  }
  res.json({
    success: true
  });
}));
router.post('/:tripId/messages', wrap(async (req, res) => {
  let data;
  try {
    data = validateChatPayload(req.body);
  } catch (e) {
    if (e.code === 'CHAT_CONTACT_BLOCKED') {
      try { await recordBlockedChatContact(prisma, req.params.tripId, req.chatActor, req.body, {io:req.app.get('io')}); }
      catch(error) {
        if (error.status) throw error;
        console.error('[ChatContactAlert] could not persist alert', error.message);
      }
    }
    return res.status(400).json({success:false, code:e.code, message:e.message});
  }
  const message = await createChatMessage(req.params.tripId, req.chatActor, data);
  res.status(201).json({
    success: true,
    id: message.id
  });
}));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 3
  },
  fileFilter: (req, file, cb) => cb(null, ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/mpeg'].includes(file.mimetype.split(';')[0]))
}).single('audio');
router.post('/:tripId/audio', async (req, res, next) => {
  try {
    const t = await chatAccess(prisma, req.params.tripId, req.chatActor);
    if (!chatCanSend(t, req.chatActor)) return res.status(403).json({
      success: false,
      message: 'Hội thoại chỉ đọc.'
    });
  } catch {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền gửi ghi âm.'
    });
  }
  upload(req, res, error => error ? res.status(400).json({
    success: false,
    message: 'Ghi âm tối đa 5 MB, định dạng âm thanh được hỗ trợ.'
  }) : next());
}, wrap(async (req, res) => {
  const durationMs = Number(req.body.durationMs),
    clientId = String(req.body.clientId || '');
  if (!req.file || !/^[a-zA-Z0-9_-]{8,100}$/.test(clientId) || !Number.isFinite(durationMs) || durationMs < 1 || durationMs > 61000) return res.status(400).json({
    success: false,
    message: 'Ghi âm tối đa 60 giây, 5 MB.'
  });
  const b = req.file.buffer;
  const mp4 = b.length > 12 && b.toString('ascii', 4, 8) === 'ftyp';
  const webm = b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const ogg = b.length > 4 && b.toString('ascii', 0, 4) === 'OggS';
  const mp3 = b.length > 3 && (b.toString('ascii', 0, 3) === 'ID3' || b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  if (!mp4 && !webm && !ogg && !mp3) return res.status(400).json({
    success: false,
    message: 'Tệp không phải định dạng ghi âm hỗ trợ.'
  });
  const recent = await prisma.tripChatMessage.count({
    where: {
      tripId: req.params.tripId,
      senderId: req.chatActor.id,
      createdAt: {
        gte: new Date(Date.now() - 60000)
      }
    }
  });
  if (recent >= 20) return res.status(429).json({
    success: false,
    message: 'Bạn gửi quá nhanh. Vui lòng chờ một phút.'
  });
  let key;
  try {
    key = await storeAudio(req.file, req.params.tripId);
    const m = await createChatMessage(req.params.tripId, req.chatActor, {
      kind: 'AUDIO',
      audioKey: key,
      audioMime: req.file.mimetype,
      durationMs: Math.round(durationMs),
      clientId
    });
    if (m.audioKey !== key) await removeAudio(key);
    res.status(201).json({
      success: true,
      id: m.id
    });
  } catch (e) {
    if (key) await removeAudio(key).catch(() => {});
    throw e;
  }
}));
// Authorize before buffering the upload; createChatMessage rechecks assignment/status under lock.
const uploadImage = multer({storage: multer.memoryStorage(), limits: {fileSize: CHAT_IMAGE_MAX_BYTES, files: 1, fields: 1, fieldSize: 200},
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
}).single('image');
router.post('/:tripId/image', async (req, res, next) => {
  try {
    const trip = await chatAccess(prisma, req.params.tripId, req.chatActor);
    if (!chatCanSend(trip, req.chatActor)) return res.status(403).json({success:false, message:'Hội thoại chỉ đọc.'});
    const recent = await prisma.tripChatMessage.count({where:{tripId:trip.id, senderId:req.chatActor.id, createdAt:{gte:new Date(Date.now()-60000)}}});
    if (recent >= 20) return res.status(429).json({success:false, message:'Bạn gửi quá nhanh. Vui lòng chờ một phút.'});
  } catch (e) { return res.status(e.status || 403).json({success:false, code:e.code, message:e.status ? e.message : 'Không có quyền gửi ảnh.'}); }
  uploadImage(req, res, error => error ? res.status(400).json({success:false, message:'Mỗi lần gửi một ảnh JPEG, PNG hoặc WebP, tối đa 10 MB.'}) : next());
}, wrap(async (req, res) => {
  const clientId = String(req.body.clientId || '');
  if (!req.file || !/^[a-zA-Z0-9_-]{8,100}$/.test(clientId)) return res.status(400).json({success:false, message:'Ảnh hoặc mã tin nhắn không hợp lệ.'});
  const file = await prepareChatImage(req.file.buffer);
  let key;
  try {
    key = await storeAudio(file, req.params.tripId);
    const m = await createChatMessage(req.params.tripId, req.chatActor, {kind:'IMAGE', imageKey:key, imageMime:file.mimetype, clientId});
    if (m.imageKey !== key) await removeAudio(key);
    res.status(201).json({success:true, id:m.id});
  } catch (e) { if (key) await removeAudio(key).catch(() => {}); throw e; }
}));
router.get('/:tripId/image/:id', wrap(async (req, res) => {
  const actor = req.chatActor, trip = await chatAccess(prisma, req.params.tripId, actor);
  const m = await prisma.tripChatMessage.findFirst({where:{...messageWhere(trip, actor), id:req.params.id, kind:'IMAGE', deletedAt:null}});
  if (!m?.imageKey) return res.status(404).json({success:false, message:'Ảnh đã bị xoá hoặc không còn truy cập được.'});
  if (actor.role === 'ADMIN') await prisma.tripChatAccess.create({data:{tripId:trip.id, actorId:actor.id, action:'VIEW_IMAGE'}});
  res.json({success:true, url:await audioUrl(m.imageKey)});
}));
router.get('/:tripId/audio/:id', wrap(async (req, res) => {
  const a = req.chatActor,
    t = await chatAccess(prisma, req.params.tripId, a);
  const m = await prisma.tripChatMessage.findFirst({
    where: {
      ...messageWhere(t, a),
      id: req.params.id,
      kind: 'AUDIO',
      deletedAt: null
    }
  });
  if (!m?.audioKey) return res.status(404).json({
    success: false,
    message: 'Không tìm thấy ghi âm.'
  });
  if (a.role === 'ADMIN') await prisma.tripChatAccess.create({
    data: {
      tripId: t.id,
      actorId: a.id,
      action: 'PLAY_AUDIO'
    }
  });
  res.set('Cache-Control', 'no-store').json({
    success: true,
    url: await audioUrl(m.audioKey)
  });
}));
router.delete('/:tripId/messages/:id', wrap(async (req, res) => {
  await deleteChatMessage(prisma, req.params.tripId, req.params.id, req.chatActor);
  res.json({
    success: true
  });
}));
export default router;
