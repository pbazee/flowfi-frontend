import { config } from 'dotenv'
import { join } from 'path'
import { seedDemoData } from '../src/lib/seedDemoData.ts'

// Load .env.local
config({ path: join(process.cwd(), '.env.local') })

async function run() {
  console.log('Starting demo data seed...')
  try {
    const result = await seedDemoData()
    console.log('✅ Success:', result.message)
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to seed demo data:', error)
    process.exit(1)
  }
}

run()
