// Shared by history, unread counts and push routing. Unknown audiences fail closed.
export function chatAudienceWhere(actor) {
  if (actor.role === 'ADMIN') return {};
  const scoped = ['RIDER', 'PARTNER', 'DRIVER'].includes(actor.role)
    ? { audience: actor.role, ...(actor.role === 'DRIVER' ? { recipientId: actor.id } : {}) }
    : { id: '__no_chat_audience__' };
  return { OR: [{ audience: 'ALL' }, scoped] };
}

export function chatAudienceVisible(message, actor) {
  if (actor.role === 'ADMIN') return true;
  const audience = message.audience ?? 'ALL';
  if (audience === 'ALL') return true;
  return ['RIDER', 'PARTNER', 'DRIVER'].includes(actor.role) && audience === actor.role &&
    (audience !== 'DRIVER' || message.recipientId === actor.id);
}

export function chatAudienceLabel(audience) {
  return { RIDER: 'Chỉ phía khách và GoViet247 thấy', PARTNER: 'Chỉ phía đối tác và GoViet247 thấy',
    DRIVER: 'Chỉ tài xế nhận chuyến và GoViet247 thấy' }[audience] || '';
}
