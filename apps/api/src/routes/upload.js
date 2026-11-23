import { Router } from 'express';
import { uploadFile } from '../controllers/uploadController.js';
import { verifyToken, requireAdminOrStaff } from '../middleware/authMiddleware.js';
import { uploadAccountingDocument } from '../middleware/uploadMiddleware.js';
import { createRequestRateLimit } from '../middleware/requestRateLimit.js';
const router = Router();
// Parse once, then authorize the same immutable scope that the controller uses.
router.post('/', createRequestRateLimit({max:120,windowMs:600000}), uploadAccountingDocument.single('file'), (req,res,next) => {
  const bodyScope = String(req.body?.scope || '').trim(), queryScope = String(req.query?.scope || '').trim();
  if (bodyScope && queryScope && bodyScope !== queryScope) return res.status(400).json({success:false,message:'Loại upload không nhất quán.'});
  req.uploadScope = bodyScope || queryScope;
  if (req.uploadScope === 'accounting_document') return requireAdminOrStaff(req,res,next);
  if (req.uploadScope === 'driver_document') return verifyToken(req,res,next);
  if (req.uploadScope === 'public_avatar') return next();
  return res.status(400).json({success:false,message:'Loại upload không hợp lệ.'});
}, uploadFile);
export default router;
