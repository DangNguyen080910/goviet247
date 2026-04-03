// Path: goviet247/apps/api/src/utils/db.js
import pkg from '@prisma/client'
const { PrismaClient } = pkg

// Tránh tạo nhiều PrismaClient khi dùng nodemon/hot-reload
const globalForPrisma = globalThis

const prisma =
  globalForPrisma.__prisma__ || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma__ = prisma
}

// 👉 Export cả named lẫn default để mọi nơi đều dùng được
export { prisma }
export default prisma
