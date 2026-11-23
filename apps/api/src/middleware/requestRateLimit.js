// Per-process protection; a shared gateway limit can additionally cover a cluster.
export function createRequestRateLimit({max, windowMs, key = req => req.ip || req.socket?.remoteAddress || 'unknown'}) {
  const entries = new Map();
  return (req, res, next) => {
    const now = Date.now(), id = String(key(req));
    if (entries.size >= 10000) for (const [k,v] of entries) if (v.until <= now) entries.delete(k);
    const value = entries.get(id);
    if (value && value.until > now) {
      if (++value.count > max) return res.set('Retry-After', String(Math.max(1, Math.ceil((value.until-now)/1000))))
        .status(429).json({success:false,message:'Thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.'});
    } else {
      if (entries.size >= 10000) return res.status(429).json({success:false,message:'Hệ thống đang bận. Vui lòng thử lại sau.'});
      entries.set(id, {count:1,until:now+windowMs});
    }
    next();
  };
}
