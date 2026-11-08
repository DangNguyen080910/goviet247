import {commissionInvoiceSummary,invoiceDayPeriod,vietnamDay} from '../services/commissionInvoiceTracking.js';
export function makeCommissionInvoiceController(db) {
  return {
    async summary(req,res) {
      const day=req.query.day ?? vietnamDay();
      try{invoiceDayPeriod(day);}catch(e){return res.status(400).json({success:false,message:e.message});}
      try{return res.json({success:true,summary:await commissionInvoiceSummary(db,day)});}catch(e){console.error('[InvoiceSummary]',e);return res.status(500).json({success:false,message:'Không tải được tình trạng hóa đơn.'});}
    },
    async confirmIssued(req,res) {
      const tripId=String(req.params.tripId||'');
      const invoiceNumber=String(req.body?.invoiceNumber||'').trim();
      const issuedDay=String(req.body?.issuedDay||'');
      let date;
      try{date=invoiceDayPeriod(issuedDay).start;}catch(e){return res.status(400).json({success:false,message:e.message});}
      if(!invoiceNumber || invoiceNumber.length>100 || issuedDay>vietnamDay()) return res.status(400).json({success:false,message:'Nhập ký hiệu/số hóa đơn đã phát hành và ngày lập không ở tương lai.'});
      try{
        const result=await db.$transaction(async tx=>{
          const item=await tx.commissionInvoiceState.findUnique({where:{tripId},include:{trip:{select:{status:true,commissionAmountSnapshot:true}}}});
          if(!item || item.trip.status!=='COMPLETED' || !(item.trip.commissionAmountSnapshot>0)) return {status:404,message:'Không tìm thấy hoa hồng chuyến hoàn thành có phí.'};
          const changed=await tx.commissionInvoiceState.updateMany({where:{tripId,issuedAt:null},data:{issuedAt:date,invoiceNumber,confirmedAt:new Date(),confirmedBy:String(req.admin?.username||req.admin?.id||'ADMIN')}});
          return changed.count?{status:200}:{status:409,message:'Chuyến đã được xác nhận phát hành. Tải lại để kiểm tra số hóa đơn đã lưu.'};
        });
        if(result.status!==200)return res.status(result.status).json({success:false,message:result.message});
        req.app?.get?.('io')?.to('admins').emit('admin:dashboard_changed',{source:'commission_invoice_confirmed',tripId});
        return res.json({success:true});
      }catch(e){console.error('[InvoiceConfirmation]',e);return res.status(500).json({success:false,message:'Chưa lưu được xác nhận hóa đơn.'});}
    }
  };
}
