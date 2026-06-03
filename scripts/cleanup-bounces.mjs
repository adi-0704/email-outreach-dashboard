import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// Remove incorrect campaign attribution from bounces that belong to other campaigns
const result = await prisma.emailEvent.updateMany({
  where: {
    type: 'bounced',
    campaign: { name: 'wisowl-production-madhav' },
    OR: [
      { subject: { contains: 'Nava' } },
      { subject: { contains: 'Series A' } },
      { subject: { contains: 'funding round' } },
      { subject: { contains: 'Delay' } }, // Delay notifications are not real bounces
    ]
  },
  data: { campaignId: null }
});

console.log(`✅ Cleared ${result.count} incorrectly attributed bounce records.`);

// Also convert "Delay" notifications from bounced to a separate type or just unlink them
const delayResult = await prisma.emailEvent.updateMany({
  where: {
    type: 'bounced',
    subject: { contains: 'Delay' },
  },
  data: { type: 'delayed' }
});
console.log(`✅ Reclassified ${delayResult.count} delay notifications as 'delayed' type.`);

await prisma.$disconnect();
