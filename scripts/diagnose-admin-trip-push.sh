#!/usr/bin/env bash
set -euo pipefail
python3 - "${2:-/Users/dangnguyen/My_Project/MyApp_GoViet247/goviet247}" "${1:-cmwv09rbg01endca74q8cc2x9}" <<'PY_ADMIN_PUSH_READ'
from pathlib import Path
from urllib.parse import urlparse,unquote
from datetime import datetime,timezone
import os,sys,subprocess,json,hashlib,re
repo=Path(sys.argv[1]).expanduser().resolve()
env_path=repo/'apps/api/.env'
try:
    trip_id=sys.argv[2]
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',trip_id):raise ValueError('Mã chuyến không hợp lệ.')
    raw=next(line.split('=',1)[1].strip().strip('"').strip("'") for line in env_path.read_text().splitlines() if line.startswith('DATABASE_URL='))
    u=urlparse(raw)
    env={**os.environ,'PGHOST':u.hostname,'PGPORT':str(u.port or 5432),'PGUSER':unquote(u.username or ''),'PGPASSWORD':unquote(u.password or ''),'PGDATABASE':u.path.lstrip('/'),'PGCONNECT_TIMEOUT':'5','PGOPTIONS':'-c default_transaction_read_only=on -c statement_timeout=5000'}
    def query(sql):
        result=subprocess.run(['psql','-X','-w','-At','-c',sql],env=env,capture_output=True,text=True,timeout=15)
        if result.returncode:raise RuntimeError(result.stderr.strip())
        return result.stdout.strip()
    has_jobs=query('SELECT to_regclass(\'"NotificationJob"\') IS NOT NULL')=='t'
    data=json.loads(query('''SELECT json_build_object(
      'devices',(SELECT coalesce(json_agg(d),'[]'::json) FROM (SELECT "userId",role,"pushExpiresAt","adminAuthVersion",("pushToken" LIKE 'ExpoPushToken[%' OR "pushToken" LIKE 'ExponentPushToken[%') AS "hasExpoToken" FROM "Device" WHERE lower(role) IN ('admin','staff')) d),
      'admins',(SELECT coalesce(json_agg(a),'[]'::json) FROM (SELECT id,role,is_active,password_hash,"authVersion" FROM admin_users WHERE role IN ('ADMIN','STAFF')) a))'''))
    now=datetime.now(timezone.utc)
    counts={'total':len(data['devices']),'eligible':0,'missing_expiry':0,'expired':0,'missing_auth_version':0,'auth_version_mismatch':0,'inactive_or_role_mismatch':0,'invalid_expo_token':0}
    admins={a['id']:a for a in data['admins']}
    for d in data['devices']:
        try:admin_id=int(d['userId'][6:]) if re.fullmatch(r'admin-[0-9]+',str(d.get('userId') or '')) else None
        except (ValueError,AttributeError):admin_id=None
        a=admins.get(admin_id)
        if not a or not a['is_active'] or a['role'].lower()!=d['role'].lower():counts['inactive_or_role_mismatch']+=1;continue
        if not d.get('adminAuthVersion'):counts['missing_auth_version']+=1;continue
        expected=hashlib.sha256(json.dumps([a['id'],a['password_hash'],a['role'],a['is_active'],a.get('authVersion') or 0],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        if d['adminAuthVersion']!=expected:counts['auth_version_mismatch']+=1;continue
        if not d.get('pushExpiresAt'):counts['missing_expiry']+=1;continue
        if datetime.fromisoformat(d['pushExpiresAt'].replace('Z','+00:00'))<=now:counts['expired']+=1;continue
        if not d['hasExpoToken']:counts['invalid_expo_token']+=1;continue
        counts['eligible']+=1
    trip=json.loads(query("SELECT row_to_json(t) FROM (SELECT id,\"createdAt\",status,\"isVerified\",\"verifiedAt\",\"cancelledAt\" FROM \"Trip\" WHERE id='"+trip_id+"') t") or 'null')
    jobs=[]
    if has_jobs:
        jobs=json.loads(query("SELECT coalesce(json_agg(j),'[]'::json) FROM (SELECT id,\"createdAt\",attempts,\"runAt\",\"expiresAt\",\"completedAt\",\"lockedUntil\",\"lastError\",coalesce(cardinality(\"acceptedTokens\"),0) AS checkpointed_devices,payload #>> '{0,data,source}' AS source FROM \"NotificationJob\" WHERE kind='sendAdminPushNotification' AND payload #>> '{0,data,tripId}'='"+trip_id+"' ORDER BY \"createdAt\" DESC LIMIT 20) j"))
    print(json.dumps({'read_only':True,'trip':trip,'notification_table_exists':has_jobs,'admin_devices_now':counts,'trip_admin_push_jobs':jobs,'note':'Thiết bị được thống kê ở thời điểm kiểm tra. Checkpoint có thể là Expo chấp nhận hoặc token đã bị loại; không chứng minh điện thoại đã hiển thị thông báo.'},ensure_ascii=False,indent=2))
except Exception as error:
    print(json.dumps({'read_only':True,'ok':False,'message':str(error)},ensure_ascii=False,indent=2))
    raise SystemExit(1)
PY_ADMIN_PUSH_READ
