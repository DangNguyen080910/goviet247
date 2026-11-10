import { formatVietnamDateTime } from '../../../../api/src/shared/vietnamDate.js';

export default function AccountExitStatus({ requests }) {
  const request = requests?.[0];
  if (!request) return <span>—</span>;
  return <div style={{ minWidth: 190 }}>
    <strong style={{ color: request.returnedAt ? '#1976d2' : '#b45309' }}>
      {request.returnedAt ? 'Đã đăng nhập lại' : 'Đã yêu cầu xóa'}
    </strong>
    <div>Yêu cầu: {formatVietnamDateTime(request.requestedAt)}</div>
    {request.returnedAt && <div>Quay lại: {formatVietnamDateTime(request.returnedAt)}</div>}
    <div>Số lần yêu cầu: {request.requestCount}</div>
  </div>;
}
