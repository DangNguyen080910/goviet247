import { prisma } from "../utils/db.js";
import { lockTrip } from "../services/tripAcceptancePolicy.js";
import { emitDriverTripEvent } from "../services/tripAudience.js";
export async function updateTripDriverNote(req, res) {
  try {
    const id = String(req.params.id || "").trim();
    const raw = req.body?.dispatcherNote;
    const expected = new Date(req.body?.expectedUpdatedAt);
    if (!id || typeof raw !== "string" || raw.length > 2000 || !req.body?.expectedUpdatedAt || !Number.isFinite(expected.getTime()))
      return res.status(400).json({success:false,message:"Ghi chú tối đa 2.000 ký tự. Vui lòng tải lại chuyến nếu thiếu phiên bản."});
    const text = raw.trim();
    const result = await prisma.$transaction(async tx => {
      await lockTrip(tx,id);
      const trip = await tx.trip.findUnique({where:{id}});
      if (!trip) throw Object.assign(new Error("Không tìm thấy chuyến."),{status:404});
      if (["COMPLETED","CANCELLED"].includes(trip.status)) throw Object.assign(new Error("Chuyến đã kết thúc, không thể sửa ghi chú gửi tài xế."),{status:409});
      if (trip.updatedAt.getTime() !== expected.getTime()) throw Object.assign(new Error("Chuyến vừa thay đổi. Tải lại ghi chú trước khi lưu."),{status:409});
      if ((trip.dispatcherNote || "") === text) return {trip,changed:false};
      const updated = await tx.trip.update({where:{id},data:{dispatcherNote:text || null,version:{increment:1}}});
      await tx.adminTripActionLog.create({data:{tripId:id,fromStatus:trip.status,toStatus:trip.status,
        actorRole:req.admin?.role || "ADMIN",actorId:req.admin?.id ?? null,actorUsername:req.admin?.username || "ADMIN",
        note:`Cập nhật ghi chú điều hành gửi tài xế. Trước: ${String(trip.dispatcherNote || "").slice(0,180)}; Sau: ${text.slice(0,180)}`}});
      return {trip:updated,changed:true};
    });
    if (result.changed) {
      try {
      const io=req.app?.get?.("io");
      if(io) {
        const event={tripId:id,toStatus:result.trip.status,updatedAt:result.trip.updatedAt,reason:"dispatcher_note_updated",silent:true};
        await emitDriverTripEvent(io,"trip:changed",event);
        if(result.trip.driverId) io.to(`driver:${result.trip.driverId}`).emit("trip:changed",event);
        io.to("admins").emit("admin:dashboard_changed",event);
      }
      } catch (error) { console.error("[TripDriverNote] realtime delivery failed", error?.message); }
    }
    return res.json({success:true,dispatcherNote:result.trip.dispatcherNote,updatedAt:result.trip.updatedAt});
  } catch(error) {
    return res.status(error.status || 500).json({success:false,message:error.status?error.message:"Không lưu được ghi chú điều hành."});
  }
}
