import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const load = version => JSON.parse(readFileSync(new URL(`../contracts/driver-partnership-${version}.json`, import.meta.url), 'utf8'));
const legacy = load('v1');
const revised = load('v2');
const definitions = new Map([legacy, revised].map(contract => [contract.version, contract]));
export const legacyDriverContract = structuredClone(legacy);
export function contractHash(contract) { return createHash('sha256').update(JSON.stringify(contract)).digest('hex'); }
export function activeDriverContract(env = process.env) {
  const version = env.DRIVER_CONTRACT_VERSION || legacy.version;
  const contract = definitions.get(version);
  if (!contract || (version === revised.version && env.DRIVER_CONTRACT_V2_APPROVED !== 'true')) {
    throw Object.assign(new Error('Nội dung hợp đồng chưa sẵn sàng. Vui lòng liên hệ hỗ trợ.'), {statusCode: 503});
  }
  return {...structuredClone(contract), contentHash: contractHash(contract)};
}
export function validateContractSubmission(body, env = process.env, selected = null) {
  const current = selected || activeDriverContract(env);
  // Missing hashes are accepted only for old v1 clients, never evidence of v2 consent.
  if (body.contractAccepted !== true || body.contractCode !== current.code || body.contractVersion !== current.version ||
      (body.contractFileHash ? body.contractFileHash !== current.contentHash : current.version !== legacy.version)) {
    throw Object.assign(new Error('Hợp đồng đã thay đổi hoặc chưa được xác nhận. Vui lòng mở lại hợp đồng và đồng ý đúng phiên bản.'), {statusCode: 409});
  }
  return current;
}
export function buildContractAcceptance(body, profile, context, env = process.env, selected = null) {
  const current = validateContractSubmission(body, env, selected);
  const contentVerified = body.contractFileHash === current.contentHash;
  const identity = {driverProfileId: profile.id, userId: profile.userId, fullName: profile.fullName,
    citizenId: profile.citizenId || null, residentialAddress: profile.residentialAddress || null,
    phone: context.phoneE164 || null, plateNumber: profile.plateNumber || null};
  if (current.version !== legacy.version && (!/^\d{12}$/.test(identity.citizenId || '') || !identity.fullName || !identity.residentialAddress)) {
    throw Object.assign(new Error('Vui lòng bổ sung họ tên, CCCD và địa chỉ trước khi xác nhận hợp đồng mới.'), {statusCode: 422});
  }
  const {contentHash, ...content} = current;
  return {driverProfileId: profile.id, contractCode: current.code, contractTitle: current.title,
    contractVersion: current.version, contractFileHash: contentVerified ? contentHash : null,
    contractFileUrl: null, ...context, isActive: true,
    contentSnapshot: {schemaVersion: 1, identity, evidenceType: contentVerified ? 'CONTENT_HASH_CONFIRMED' : 'LEGACY_CLIENT_NO_CONTENT_HASH',
      contentVerified, ...(contentVerified ? {content, contentHash} : {})}};
}
export function acceptanceEvidence(row) {
  return {...row, evidenceNotice: row.contentSnapshot?.contentVerified
    ? 'Đã lưu nội dung và thông tin tài xế tại thời điểm xác nhận. Không phải xác minh OTP riêng hoặc chứng thư chữ ký số.'
    : 'Có bản ghi chấp thuận phiên bản; chưa có bản nội dung được xác minh tại thời điểm đó. Không tự gán điều khoản mới hoặc ngày ký mới.'};
}

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderContractEvidence(profile, records, exportedAt = new Date()) {
  const line = (label,value) => `<p><strong>${html(label)}:</strong> ${html(value || 'Chưa có')}</p>`;
  const body = records.map(row => {
    const info = acceptanceEvidence(row);
    const snapshot = row.contentSnapshot?.contentVerified ? row.contentSnapshot : null;
    return `<section><h2>Bản ghi ${html(row.id)}</h2>${line('Mã hợp đồng',row.contractCode)}${line('Phiên bản',row.contractVersion)}${line('Thời điểm ghi nhận theo giờ Việt Nam',new Date(row.agreedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))}${line('Thời điểm gốc UTC',new Date(row.agreedAt).toISOString())}${line('SĐT lưu trong bản ghi',row.phoneE164)}${line('IP lưu trong bản ghi',row.ipAddress)}${line('Thông tin thiết bị',row.deviceInfo)}${line('Ứng dụng',row.appVersion)}${line('Mã kiểm tra nội dung',row.contractFileHash)}<p>${html(info.evidenceNotice)}</p>${snapshot ? `<h3>Thông tin lưu tại thời điểm xác nhận</h3>${line('Họ tên',snapshot.identity.fullName)}${line('CCCD',snapshot.identity.citizenId)}${line('Địa chỉ',snapshot.identity.residentialAddress)}<h3>Nội dung đã lưu</h3>${snapshot.content.sections.map(s=>`<h4>${html(s.heading)}</h4>${s.paragraphs.map(t=>`<p>${html(t)}</p>`).join('')}`).join('')}` : '<p>Không đính kèm một nội dung hợp đồng mới hoặc tái tạo nội dung cũ chưa được lưu làm chứng cứ. Cần đối chiếu bản ứng dụng, tài liệu và hồ sơ liên quan.</p>'}</section>`;
  }).join('');
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Bản ghi chấp thuận hợp đồng tài xế</title><style>body{font:16px/1.55 Georgia,serif;max-width:850px;margin:35px auto;padding:0 20px;color:#111}h1{font-size:25px}h2{font-size:21px}h3,h4{font-size:18px}p{overflow-wrap:anywhere}section{border-top:1px solid #bbb;margin-top:24px;padding-top:12px}@media print{body{margin:0;max-width:none}h2,h3,h4{break-after:avoid}p{orphans:3;widows:3}}</style><body><h1>Bản ghi chấp thuận hợp đồng tài xế</h1>${line('Thời điểm xuất',exportedAt.toISOString())}<p>Tài liệu trích xuất bản ghi hệ thống, không phải bản hợp đồng mới được ký và không xác nhận đã hoàn thành kê khai hoặc nộp thuế.</p><h2>Thông tin hồ sơ hiện tại</h2><p>Thông tin dưới đây có thể đã thay đổi sau ngày đồng ý cũ.</p>${line('Mã hồ sơ',profile.id)}${line('Họ tên hiện tại',profile.fullName)}${line('CCCD hiện tại',profile.citizenId)}${line('Địa chỉ hiện tại',profile.residentialAddress)}${records.length ? body : '<p>Không có bản ghi chấp thuận trong dữ liệu hệ thống.</p>'}</body></html>`;
}

// Serialize publication and acceptance so an old version cannot be accepted across a publish.
export async function lockContractPublication(tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(247101126)`;
}
export async function currentDriverContract(db, env = process.env) {
  const row = await db.driverContractVersion.findFirst({where:{publishedAt:{not:null}},orderBy:[{publishedAt:'desc'},{id:'desc'}]});
  if (!row) return {contract:activeDriverContract(env), release:null};
  return {contract:{...row.content,contentHash:contractHash(row.content)},release:{id:row.id,version:row.version,publishedAt:row.publishedAt,changeSummary:row.changeSummary,graceDays:row.graceDays,requireForNewTrips:row.requireForNewTrips,deadline:new Date(row.publishedAt.getTime()+row.graceDays*86400000)}};
}
export const driverContractReconsentEnabled = (env = process.env) => env.DRIVER_CONTRACT_RECONSENT_ENABLED === 'true';
export async function assertCurrentContractForNewTrip(db, profile, env = process.env) {
  if (!driverContractReconsentEnabled(env)) return;
  const {contract,release}=await currentDriverContract(db,env);
  if (!release?.requireForNewTrips || Date.now()<release.deadline.getTime()) return;
  const accepted=await db.driverContractAcceptance.findFirst({where:{driverProfileId:profile.id,contractVersion:contract.version,contractFileHash:contract.contentHash,isActive:true}});
  if (!accepted) throw Object.assign(new Error('Vui lòng mở Hồ sơ → Hợp đồng để đọc và xác nhận hợp đồng mới trước khi nhận chuyến mới.'),{statusCode:409,code:'CONTRACT_ACCEPTANCE_REQUIRED'});
}

// Registration-only revision: do not rewrite published versions or old receipts.
// Existing drivers remain on their saved evidence and the paused reconsent flow.
const contactPolicy = JSON.parse(readFileSync(new URL('../contracts/driver-contact-policy.json', import.meta.url), 'utf8'));
export async function registrationDriverContract(db, env = process.env) {
  const source = await currentDriverContract(db, env);
  const {contentHash: ignoredHash, ...original} = source.contract;
  const content = structuredClone(original);
  let changed = false;
  content.sections = content.sections.map(section => ({...section, paragraphs: section.paragraphs.flatMap(text => {
    if (text !== contactPolicy.legacyParagraph) return [text];
    changed = true;
    return [...contactPolicy.paragraphs];
  })}));
  if (!changed) return source;
  content.version = original.version === legacy.version ? 'v1.1-2026-11-10' : `${original.version}-contact-20261110`;
  return {contract: {...content, contentHash: contractHash(content)}, release: null};
}

// The released 1.1.7 app submits v1.0 without a hash. Preserve its actual
// acceptance version and leave content verification to hash-capable clients.
export async function registrationContractForSubmission(db, body, env = process.env) {
  if (
    env.DRIVER_REGISTRATION_ALLOW_LEGACY_V1 === 'true' &&
    body.contractVersion === legacy.version &&
    !body.contractFileHash
  ) {
    return {...structuredClone(legacy), contentHash: contractHash(legacy)};
  }
  return (await registrationDriverContract(db, env)).contract;
}
