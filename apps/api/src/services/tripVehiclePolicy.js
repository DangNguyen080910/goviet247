import {audienceCarType} from './tripAudiencePolicy.js';

const seats={CAR_5:5,CAR_7:7,CAR_16:16};
const fuels=['ELECTRIC','GASOLINE'];
export function tripVehicleMismatch(trip,profile) {
  const requested=seats[trip?.carType],actual=seats[audienceCarType(profile?.vehicleType)];
  if(!requested)return {code:'TRIP_VEHICLE_INVALID',message:'Chưa xác định được loại xe khách yêu cầu. Vui lòng liên hệ GoViet247.'};
  if(!actual)return {code:'DRIVER_VEHICLE_INFO_REQUIRED',message:'Vui lòng cập nhật loại xe trong hồ sơ trước khi nhận chuyến.'};
  if(actual<requested)return {code:'VEHICLE_CAPACITY_MISMATCH',message:`Khách yêu cầu xe ${requested} chỗ trở lên. Xe ${actual} chỗ của anh/chị không phù hợp chuyến này.`};
  const fuel=trip.fuelPreference ?? 'ANY';
  if(fuel==='ANY')return null;
  if(!fuels.includes(fuel))return {code:'TRIP_FUEL_INVALID',message:'Yêu cầu nhiên liệu của chuyến chưa hợp lệ. Vui lòng liên hệ GoViet247.'};
  if(profile?.vehicleFuelType!==fuel)return {code:'VEHICLE_FUEL_MISMATCH',message:`Khách yêu cầu ${fuel==='ELECTRIC'?'xe điện':'xe xăng'}. Nhiên liệu xe trong hồ sơ của anh/chị chưa phù hợp chuyến này.`};
  return null;
}
export const canVehicleServeTrip=(trip,profile)=>!tripVehicleMismatch(trip,profile);
export function assertVehicleServesTrip(trip,profile) {
  const error=tripVehicleMismatch(trip,profile);
  if(error)throw Object.assign(new Error(error.message),{statusCode:409,code:error.code});
}

// Filter in SQL BEFORE pagination; filtering a page in memory can hide eligible
// trips behind a full page of incompatible vehicles. Unknown capacity fails closed.
export function driverTripVehicleWhere(profile) {
  const capacity=seats[audienceCarType(profile?.vehicleType)] || 0;
  return {carType:{in:Object.keys(seats).filter(type=>seats[type]<=capacity)},
    fuelPreference:{in:['ANY',...(fuels.includes(profile?.vehicleFuelType)?[profile.vehicleFuelType]:[])]}};
}
