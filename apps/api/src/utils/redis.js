// Path: goviet247/apps/api/src/utils/redis.js
import { createClient } from 'redis'

const url = process.env.REDIS_URL || 'redis://localhost:6379'
const client = createClient({ url })

client.on('error', (err) => console.error('[Redis] error:', err))
client.on('ready', () => console.log('[Redis] ready'))

export async function ensureConnected() {
  if (!client.isOpen) await client.connect()
}
export { client as redis }
