import test from 'node:test';
import assert from 'node:assert/strict';
import { chatCanSend, validateChatPayload, CHAT_QUICK_REPLIES, containsContactNumber } from '../src/shared/tripChat.js';
import { chatAccess, messageWhere, deleteChatMessage } from '../src/services/tripChatService.js';
const trip = {
  id: 't',
  riderId: 'r',
  driverId: 'd',
  riderPhone: '0901234567',
  status: 'ACCEPTED',
  acceptedAt: new Date('2026-11-01T00:00:00Z')
};
const db = t => ({
  trip: {
    findUnique: async () => t
  },
  driverProfile: {
    findUnique: async () => ({
      status: 'VERIFIED'
    })
  },
  phone: {
    findMany: async () => []
  }
});
test('only assigned participants and active staff can access a trip conversation', async () => {
  assert.equal((await chatAccess(db(trip), 't', {
    id: 'r',
    role: 'RIDER'
  })).id, 't');
  const driver = {
    id: 'd',
    role: 'RIDER'
  };
  await chatAccess(db(trip), 't', driver);
  assert.equal(driver.role, 'DRIVER');
  await assert.rejects(() => chatAccess(db(trip), 't', {
    id: 'stranger',
    role: 'RIDER'
  }), /Không có quyền/);
  await assert.rejects(() => chatAccess(db({
    ...trip,
    driverId: 'new-driver'
  }), 't', {
    id: 'd',
    role: 'RIDER'
  }), /Không có quyền/);
  await assert.rejects(() => chatAccess({
    ...db(trip),
    driverProfile: {
      findUnique: async () => ({
        status: 'SUSPENDED'
      })
    }
  }, 't', {
    id: 'd',
    role: 'RIDER'
  }), /Tài xế chưa/);
});
test('a verified passenger phone grants access, an unverified/unrelated phone does not', async () => {
  const passenger = {
    ...db(trip),
    phone: {
      findMany: async () => [{
        e164: '+84901234567'
      }]
    }
  };
  assert.equal((await chatAccess(passenger, 't', {
    id: 'passenger',
    role: 'RIDER'
  })).id, 't');
  await assert.rejects(() => chatAccess(db(trip), 't', {
    id: 'passenger',
    role: 'RIDER'
  }));
});
test('rider and partner can chat before assignment; driver waits for acceptance', () => {
  for (const status of ['CANCELLED', 'NEW_UNKNOWN']) assert.equal(chatCanSend({
    ...trip,
    status
  }, {
    role: 'RIDER'
  }), false);
  assert.equal(chatCanSend({
    ...trip,
    driverId: null
  }, {
    role: 'RIDER'
  }), true);
  for(const role of ['RIDER','PARTNER']) assert.equal(chatCanSend({...trip,status:'PENDING',driverId:null},{role}),true);
  assert.equal(chatCanSend({...trip,status:'PENDING',driverId:null},{role:'DRIVER'}),false);
  for (const status of ['ACCEPTED', 'CONTACTED', 'IN_PROGRESS']) assert.equal(chatCanSend({
    ...trip,
    status
  }, {
    role: 'DRIVER'
  }), true);
  assert.equal(chatCanSend({
    ...trip,
    status: 'COMPLETED'
  }, {
    role: 'ADMIN'
  }), true);
});
test('replacement drivers keep acceptance cutoff and private audience filtering', () => {
  const driver=messageWhere(trip,{role:'DRIVER',id:'d'});
  assert.equal(driver.tripId,'t');assert.deepEqual(driver.createdAt,{gte:trip.acceptedAt});
  assert.deepEqual(driver.AND,[{OR:[{audience:'ALL'},{audience:'DRIVER',recipientId:'d'}]}]);
  const rider=messageWhere(trip,{role:'RIDER',id:'r'});
  assert.equal(rider.createdAt,undefined);assert.deepEqual(rider.AND,[{OR:[{audience:'ALL'},{audience:'RIDER'}]}]);
});
test('message input accepts valid text/location and rejects invalid/coerced coordinates', () => {
  const clientId = 'client_12345';
  assert.deepEqual(validateChatPayload({
    clientId,
    text: '  Xin chào  '
  }), {
    clientId,
    kind: 'TEXT',
    text: 'Xin chào'
  });
  const m = validateChatPayload({
    clientId,
    kind: 'LOCATION',
    latitude: 10.8,
    longitude: 106.7
  });
  assert.equal(m.latitude, 10.8);
  for (const payload of [{
    text: ''
  }, {
    text: 'x'.repeat(2001)
  }, {
    kind: 'LOCATION',
    latitude: 91,
    longitude: 1
  }, {
    kind: 'LOCATION',
    latitude: '10',
    longitude: 1
  }, {
    kind: 'LOCATION',
    latitude: NaN,
    longitude: 1
  }, {
    kind: 'AUDIO'
  }]) assert.throws(() => validateChatPayload({
    clientId,
    ...payload
  }));
  assert.throws(() => validateChatPayload({
    clientId: 'bad',
    text: 'hello'
  }));
});
test('agreed confirmations are role specific and do not modify trip state', () => {
  assert.equal(CHAT_QUICK_REPLIES.DRIVER[0], 'Tôi xác nhận nhận chuyến và sẽ đón đúng lịch đã đặt.');
  assert.equal(CHAT_QUICK_REPLIES.RIDER[0], 'Tôi xác nhận chuyến và sẽ có mặt tại điểm đón đúng giờ đã đặt.');
});
test('blocks common personal phone formats while allowing addresses, fares and times', () => {
  for (const text of ['Gọi 0901234567', '+84 901 234 567', '090.123.4567', '(090) 123-4567', '０９０１２３４５６７', 'không chín không một hai ba bốn năm sáu bảy']) {
    assert.equal(containsContactNumber(text), true, text);
    assert.throws(() => validateChatPayload({
      clientId: 'test_phone',
      text
    }), /số điện thoại/);
  }
  for (const text of ['Tôi đến lúc 07:30', 'Giá 1.500.000 đồng', '33/4 Đặng Văn Ngữ', 'Hẹn ngày 01/11/2026']) assert.equal(containsContactNumber(text), false, text);
  assert.throws(() => validateChatPayload({
    clientId: 'test_label',
    kind: 'LOCATION',
    latitude: 10,
    longitude: 106,
    locationLabel: 'Gọi 0901234567'
  }), /số điện thoại/);
});
test('only admin may delete; deletion clears content, queues audio removal and leaves an audit', async () => {
  for (const role of ['RIDER', 'DRIVER']) await assert.rejects(() => deleteChatMessage({}, 't', 'm', {
    id: 'x',
    role
  }), /quyền xoá/);
  let message = {
    id: 'm',
    tripId: 't',
    kind: 'AUDIO',
    audioKey: 'private/audio.m4a',
    text: 'test',
    latitude: 10,
    longitude: 106
  };
  const logs = [];
  const tx = {
    ...db(trip),
    $queryRaw: async () => [],
    tripChatMessage: {
      findFirst: async ({
        where
      }) => where.tripId === message.tripId ? message : null,
      update: async ({
        data
      }) => {
        message = {
          ...message,
          ...data
        };
      }
    },
    tripChatAccess: {
      create: async ({
        data
      }) => logs.push(data)
    }
  };
  const database = {
    $transaction: fn => fn(tx)
  };
  await deleteChatMessage(database, 'other-trip', 'm', {
    id: 'admin-1',
    role: 'ADMIN'
  });
  assert.equal(logs.length, 0);
  await deleteChatMessage(database, 't', 'm', {
    id: 'admin-1',
    role: 'ADMIN'
  });
  assert.equal(message.audioKey, null);
  assert.equal(message.text, null);
  assert.equal(message.latitude, null);
  assert.equal(message.audioDeleteKey, 'private/audio.m4a');
  assert.equal(message.deletedBy, 'admin-1');
  assert.ok(message.deletedAt);
  assert.equal(logs[0].action, 'DELETE_MESSAGE:m');
  await deleteChatMessage(database, 't', 'm', {
    id: 'admin-1',
    role: 'ADMIN'
  });
  assert.equal(logs.length, 1);
});

test('completed support stays open for booker/passenger and Admin but driver chat is closed',async()=>{
 const ended={...trip,status:'COMPLETED'};
 assert.equal((await chatAccess(db(ended),'t',{id:'r',role:'RIDER'})).id,'t');
 const passenger={...db(ended),phone:{findMany:async()=>[{e164:'+84901234567'}]}};
 assert.equal((await chatAccess(passenger,'t',{id:'passenger',role:'RIDER'})).id,'t');
 assert.equal((await chatAccess(db(ended),'t',{id:'admin-1',role:'ADMIN'})).id,'t');
 await assert.rejects(()=>chatAccess(db(ended),'t',{id:'d',role:'RIDER'}),e=>e.code==='DRIVER_CHAT_ENDED');
 assert.equal((await chatAccess(db(ended),'t',{id:'d',role:'RIDER'},{allowEnded:true})).id,'t');
 for(const role of ['RIDER','PARTNER'])assert.equal(chatCanSend(ended,{role}),true);
 assert.equal(chatCanSend(ended,{role:'DRIVER'}),false);
});
test('cancelled chat remains closed to customers and driver',async()=>{
 const ended={...trip,status:'CANCELLED'};
 await assert.rejects(()=>chatAccess(db(ended),'t',{id:'r',role:'RIDER'}),e=>e.code==='RIDER_CHAT_ENDED');
 await assert.rejects(()=>chatAccess(db(ended),'t',{id:'d',role:'RIDER'}),e=>e.code==='DRIVER_CHAT_ENDED');
 assert.equal((await chatAccess(db(ended),'t',{id:'admin-1',role:'ADMIN'})).id,'t');
});
