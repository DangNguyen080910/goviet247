import { regionalPricingLine } from '../../../../api/src/shared/regionalPricing.js';
import { driverSurchargeLines } from '../../../../api/src/shared/driverSurcharges.js';
export default function TripMoney({ trip }) {
  const lines = driverSurchargeLines(trip);
  const regionalLine = regionalPricingLine(trip?.destinationService?.tourDisplay?.regionalSurcharge);
  if (regionalLine) lines.push(regionalLine);
  return <div style={{ minWidth: 250, color: 'inherit' }}>
    <div style={{ display: 'flex', gap: 18, justifyContent: 'space-between' }}>
      <div><div style={{ fontSize: 11, opacity: .75 }}>Giá chuyến</div><strong>{Number(trip?.totalPrice || 0).toLocaleString('vi-VN')}đ</strong></div>
      <div><div style={{ fontSize: 11, opacity: .75 }}>Tài xế thực nhận{trip?.driverReceiveEstimated ? ' (dự kiến)' : ''}</div><strong style={{ color: '#16a34a' }}>{trip?.driverReceive == null ? 'Chưa có dữ liệu' : Number(trip.driverReceive).toLocaleString('vi-VN') + 'đ'}</strong></div>
    </div>
    {lines.map(line => <div key={line} style={{ fontSize: 12, marginTop: 5, whiteSpace: 'normal' }}>{line}</div>)}
  </div>;
}
