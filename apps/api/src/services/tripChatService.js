import { hasPrivateChatPrefixPolicy } from '../shared/chatStoragePolicy.js';
import { getPartnerRiderContext } from './partnerRiderAccess.js';
import { chatAudienceWhere } from '../shared/tripChatVisibility.js';
import { chatPushRecipientIds } from './tripAcceptanceChat.js';
import { verifyPartnerToken } from './partnerAccess.js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, GetPublicAccessBlockCommand, GetBucketPolicyCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../utils/db.js';
import { userSessions } from './userSessions.js';
import { verifyAdminJwtToken } from '../utils/jwt.js';
import { getVerifiedRiderPhoneVariants, phoneVariants, riderTripAccessWhere } from './riderTripAccess.js';
import { chatCanSend, isRiderChatEnded, RIDER_CHAT_ENDED_NOTICE, DRIVER_CHAT_ENDED_NOTICE } from '../shared/tripChat.js';
import { activeDriverDevices } from './driverPushAccess.js';
const s3 = new S3Client({
  region: process.env.TRIP_CHAT_AWS_REGION || process.env.AWS_REGION
});
const fail = (message, status = 403) => Object.assign(new Error(message), {
  status
});
export async function chatAuth(req, res, next) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (jwt.decode(token)?.aud === 'goviet247-partners') {
      const member = await verifyPartnerToken(token);
      if(member.mustChangePassword) throw fail('Vui lòng đổi mật khẩu ban đầu.',403);
      req.chatActor={id:`partner-${member.id}`,memberId:member.id,companyId:member.companyId,role:'PARTNER',label:`${member.company.name} · ${member.displayName}`};
      return next();
    }
    let admin;
    try {
      admin = verifyAdminJwtToken(token);
    } catch {}
    if (admin && ['ADMIN', 'STAFF'].includes(admin.role)) {
      const row = await prisma.admin_users.findUnique({
        where: {
          id: Number(admin.id)
        }
      });
      if (!row?.is_active || !['ADMIN', 'STAFF'].includes(row.role)) throw fail('Tài khoản không còn quyền truy cập.', 401);
      req.chatActor = {
        id: `admin-${row.id}`,
        role: 'ADMIN',
        label: `Hỗ trợ GoViet247 · ${row.username}`
      };
    } else {
      const user = await userSessions.verify(token);
      const id = user.id || user.uid;
      req.chatActor = {
        id,
        role: 'RIDER',
        label: 'Khách hàng'
      };
    }
    next();
  } catch (error) {
    res.status(error.status || 503).json({
      success: false,
      message: 'Vui lòng đăng nhập lại.'
    });
  }
}
export async function chatAccess(db, tripId, actor, {allowEnded=false}={}) {
  const trip = await db.trip.findUnique({
    where: {
      id: tripId
    }
  });
  if (!trip) throw fail('Không tìm thấy hội thoại.', 404);
  if (actor.role === 'ADMIN') return trip;
  if (actor.role === 'PARTNER' && actor.memberId) {
    const member=await db.partnerMember.findUnique({where:{id:actor.memberId},include:{company:true}});
    if(!member?.isActive || !member.company.isActive || member.mustChangePassword || member.companyId!==trip.partnerCompanyId) throw fail('Không có quyền xem hội thoại.');
    if (member.role!=='ADMIN' && trip.partnerAssignedToId!==member.id) throw fail('Chỉ điều phối viên phụ trách được xem hội thoại.');
    if (!allowEnded && isRiderChatEnded(trip.status)) throw Object.assign(fail(RIDER_CHAT_ENDED_NOTICE),{code:'RIDER_CHAT_ENDED'});
    return trip;
  }
  if (trip.driverId === actor.id) {
    if(!allowEnded && ['COMPLETED','CANCELLED'].includes(trip.status)) throw Object.assign(fail(DRIVER_CHAT_ENDED_NOTICE),{code:'DRIVER_CHAT_ENDED'});
    const profile = await db.driverProfile.findUnique({
      where: {
        userId: actor.id
      },
      select: {
        status: true
      }
    });
    if (profile?.status !== 'VERIFIED') throw fail('Tài xế chưa có quyền truy cập.');
    actor.role = 'DRIVER';
    actor.label = 'Tài xế';
    return trip;
  }
  const phones = await getVerifiedRiderPhoneVariants(db, actor.id);
  if (trip.partnerCompanyId) {
    const context=await getPartnerRiderContext(db,trip,phones);
    if(!context) throw fail('Không có quyền xem hội thoại.');
    if(!allowEnded && isRiderChatEnded(trip.status)) throw Object.assign(fail(RIDER_CHAT_ENDED_NOTICE),{code:'RIDER_CHAT_ENDED'});
    actor.role='PARTNER';actor.partnerViaRider=true;
    const manager=phones.includes(context.partnerCompany.managementPhone);
    const member=context.partnerCreatedBy || context.partnerAssignedTo;
    actor.label=`${context.partnerCompany.name} · ${manager ? context.partnerCompany.managementName : member?.displayName || 'Điều phối viên'}`;
    return trip;
  }
  if (trip.riderId !== actor.id && !phoneVariants(trip.riderPhone).some(p => phones.includes(p))) throw fail('Không có quyền xem hội thoại.');
  if (!allowEnded && isRiderChatEnded(trip.status)) throw Object.assign(fail(RIDER_CHAT_ENDED_NOTICE), {code:'RIDER_CHAT_ENDED'});
  actor.role = 'RIDER';
  actor.label = trip.riderId === actor.id ? 'Người đặt chuyến' : 'Hành khách';
  return trip;
}
export function messageWhere(trip, actor) {
  // A replacement driver must not inherit the former driver's conversation.
  return {
    tripId: trip.id,
    AND: [chatAudienceWhere(actor)],
    ...(actor.role === 'DRIVER' && trip.acceptedAt ? {
      createdAt: {
        gte: trip.acceptedAt
      }
    } : {})
  };
}
export async function privateAudioBucket() {
  const Bucket = process.env.TRIP_CHAT_AUDIO_BUCKET;
  if (!Bucket) throw fail('Chưa cấu hình kho tệp hội thoại riêng tư.', 503);
  const result = await s3.send(new GetPublicAccessBlockCommand({
    Bucket
  }));
  if (['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(k => result.PublicAccessBlockConfiguration?.[k])) return Bucket;
  const owner = process.env.TRIP_CHAT_AWS_ACCOUNT_ID;
  if (process.env.TRIP_CHAT_STORAGE_MODE !== 'shared-prefix' || !/^[0-9]{12}$/.test(owner || '')) throw fail('Kho tệp hội thoại phải chặn truy cập công khai hoặc cấu hình bảo vệ riêng trip-chat/.', 503);
  // ExpectedBucketOwner also verifies that the configured account owns this bucket.
  const policy = await s3.send(new GetBucketPolicyCommand({ Bucket, ExpectedBucketOwner: owner }));
  if (!hasPrivateChatPrefixPolicy(policy.Policy, Bucket, owner)) throw fail('Thiếu chính sách bảo vệ riêng tư cho trip-chat/.', 503);
  return Bucket;
}
export async function storeAudio(file, tripId) {
  const Bucket = await privateAudioBucket();
  const Key = `trip-chat/${tripId}/${randomUUID()}`;
  await s3.send(new PutObjectCommand({
    Bucket,
    Key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ServerSideEncryption: 'AES256'
  }));
  return Key;
}
export async function removeAudio(Key) {
  if (Key) await s3.send(new DeleteObjectCommand({
    Bucket: process.env.TRIP_CHAT_AUDIO_BUCKET,
    Key
  }));
}
export async function audioUrl(Key) {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: process.env.TRIP_CHAT_AUDIO_BUCKET,
    Key
  }), {
    expiresIn: 60
  });
}
export async function createChatMessage(tripId, actor, data) {
  return prisma.$transaction(async tx => {
    // Serialize with trip status/reassignment updates before authorizing a write.
    await tx.$queryRaw`SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
    const trip = await chatAccess(tx, tripId, actor);
    if (!chatCanSend(trip, actor)) throw fail('Không thể gửi tin trong hội thoại này. Vui lòng kiểm tra trạng thái chuyến và quyền truy cập.');
    const existing = await tx.tripChatMessage.findUnique({
      where: {
        tripId_senderId_clientId: {
          tripId,
          senderId: actor.id,
          clientId: data.clientId
        }
      }
    });
    if (existing) return existing;
    const recent = await tx.tripChatMessage.count({
      where: {
        tripId,
        senderId: actor.id,
        createdAt: {
          gte: new Date(Date.now() - 60000)
        }
      }
    });
    if (recent >= 20) throw fail('Bạn gửi quá nhanh. Vui lòng chờ một phút.', 429);
    return tx.tripChatMessage.create({
      data: {
        ...data,
        ...(trip.status==='COMPLETED'?{audience:trip.partnerCompanyId?'PARTNER':'RIDER',recipientId:null}:{}),
        tripId,
        senderId: actor.id,
        senderRole: actor.role,
        senderLabel: actor.label
      }
    });
  });
}
export async function chatTripWhere(actor) {
  if (actor.role === 'ADMIN') return {};
  if (actor.role === 'PARTNER' && actor.memberId) return {partnerCompanyId:actor.companyId,...(actor.memberId ? {OR:[{partnerAssignedToId:actor.memberId},{partnerCompany:{members:{some:{id:actor.memberId,role:'ADMIN',isActive:true}}}}]}:{id:'__no_partner_access__'})};
  const phones = await getVerifiedRiderPhoneVariants(prisma, actor.id);
  return {
    OR: [{
      driverId: actor.id
    }, riderTripAccessWhere(actor.id, phones)]
  };
}
let delivering = false;
export async function deliverChatPush() {
  if (delivering) return;
  delivering = true;
  try {
    const deletions = await prisma.tripChatMessage.findMany({
      where: { OR: [{audioDeleteKey: {not: null}}, {imageDeleteKey: {not: null}}] },
      take: 20,
      select: {
        id: true,
        audioDeleteKey: true,
        imageDeleteKey: true
      }
    });
    for (const item of deletions) try {
      await removeAudio(item.audioDeleteKey);
      await removeAudio(item.imageDeleteKey);
      await prisma.tripChatMessage.update({
        where: {
          id: item.id
        },
        data: {
          audioDeleteKey: null,
          imageDeleteKey: null
        }
      });
    } catch (error) {
      console.error('[TripChat] audio deletion pending', item.id, error.message);
    }
    const messages = await prisma.tripChatMessage.findMany({
      where: {
        pushDoneAt: null,
        pushAttempts: {
          lt: 8
        },
        OR: [{
          pushAttemptAt: null
        }, {
          pushAttemptAt: {
            lt: new Date(Date.now() - 60000)
          }
        }]
      },
      take: 20,
      orderBy: {
        createdAt: 'asc'
      }
    });
    for (const m of messages) {
      const claimed = await prisma.tripChatMessage.updateMany({
        where: {
          id: m.id,
          pushAttempts: m.pushAttempts,
          pushDoneAt: null
        },
        data: {
          pushAttempts: {
            increment: 1
          },
          pushAttemptAt: new Date()
        }
      });
      if (!claimed.count) continue;
      try {
        if (m.deletedAt) {
          await prisma.tripChatMessage.update({
            where: {
              id: m.id
            },
            data: {
              pushDoneAt: new Date()
            }
          });
          continue;
        }
        const trip = await prisma.trip.findUnique({
          where: {
            id: m.tripId
          }
        });
        if (!trip) continue;
        const ids = await chatPushRecipientIds(prisma, trip, m);
        const reads = await prisma.tripChatRead.findMany({
          where: {
            tripId: m.tripId,
            actorId: {
              in: ids
            },
            OR: [{
              readAt: {
                gt: m.createdAt
              }
            }, {
              readAt: m.createdAt,
              messageId: {
                gte: m.id
              }
            }]
          },
          select: {
            actorId: true
          }
        });
        const readIds = new Set(reads.map(r => r.actorId));
        const devices = await prisma.device.findMany({
          where: {
            userId: {
              in: ids.filter(id => !readIds.has(id))
            }
          }
        });
        const userDevices = await activeDriverDevices(prisma, devices.filter(d => !d.userId.startsWith('admin-')));
        const eligible = [...userDevices, ...devices.filter(d => d.userId.startsWith('admin-') && (!d.pushExpiresAt || d.pushExpiresAt > new Date()))];
        const notifications = eligible.filter(d => /^(ExponentPushToken|ExpoPushToken)\[/.test(d.pushToken)).map(d => ({
          to: d.pushToken,
          title: `Liên hệ chuyến #${trip.id}`,
          body: m.senderRole === 'SYSTEM' ? m.text || 'Có thông báo mới về chuyến.' : `${m.senderLabel} đã gửi ${m.kind === 'AUDIO' ? 'tin nhắn thoại' : m.kind === 'IMAGE' ? 'hình ảnh' : m.kind === 'LOCATION' ? 'vị trí' : 'tin nhắn'}.`,
          sound: d.role.toLowerCase() === 'driver' ? 'new_trip.wav' : 'default',
          channelId: d.role.toLowerCase() === 'driver' ? 'trip_chat_v1' : 'trip_chat_default_v1',
          priority: 'high',
          ttl: 3600,
          data: {
            type: 'TRIP_CHAT',
            tripId: trip.id,
            messageId: m.id
          }
        }));
        for (let i = 0; i < notifications.length; i += 100) {
          const batch = notifications.slice(i, i + 100);
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(batch),
            signal: AbortSignal.timeout(15000)
          });
          const result = await response.json();
          if (!response.ok || result.errors) throw new Error('Push rejected');
          const tickets = Array.isArray(result.data) ? result.data : [result.data];
          for (let j = 0; j < tickets.length; j++) if (tickets[j]?.status === 'error') {
            if (tickets[j].details?.error === 'DeviceNotRegistered') await prisma.device.deleteMany({
              where: {
                pushToken: batch[j].to
              }
            });else throw new Error('Push ticket failed');
          }
        }
        await prisma.tripChatMessage.update({
          where: {
            id: m.id
          },
          data: {
            pushDoneAt: new Date()
          }
        });
      } catch (error) {
        console.error('[TripChat] push retry pending', m.id, error.message);
      }
    }
  } catch (error) {
    console.error('[TripChat] delivery worker', error.message);
  } finally {
    delivering = false;
  }
}
export async function deleteChatMessage(db, tripId, messageId, actor) {
  if (actor.role !== 'ADMIN') throw fail('Chỉ GoViet247 được quyền xoá tin nhắn.');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
    await chatAccess(tx, tripId, actor);
    const message = await tx.tripChatMessage.findFirst({
      where: {
        id: messageId,
        tripId
      }
    });
    if (!message || message.deletedAt) return;
    await tx.tripChatMessage.update({
      where: {
        id: message.id
      },
      data: {
        deletedAt: new Date(),
        deletedBy: actor.id,
        text: null,
        imageDeleteKey: message.imageKey,
        imageKey: null,
        imageMime: null,
        audioDeleteKey: message.audioKey,
        audioKey: null,
        audioMime: null,
        durationMs: null,
        latitude: null,
        longitude: null,
        locationLabel: null
      }
    });
    await tx.tripChatAccess.create({
      data: {
        tripId,
        actorId: actor.id,
        action: `DELETE_MESSAGE:${message.id}`
      }
    });
  });
}
