import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with mock outreach data...')

  // Create mock campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      name: 'Wisowl Q3 Growth',
      status: 'active',
    },
  })

  const campaign2 = await prisma.campaign.create({
    data: {
      name: 'LinkedIn Recruiter Outreach',
      status: 'active',
    },
  })

  // Create mock leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        email: 'john.doe@techcorp.com',
        name: 'John Doe',
        company: 'TechCorp',
        status: 'interested',
        campaignId: campaign1.id,
      },
    }),
    prisma.lead.create({
      data: {
        email: 'sarah.smith@innovate.io',
        name: 'Sarah Smith',
        company: 'Innovate',
        status: 'booked',
        campaignId: campaign2.id,
      },
    }),
    prisma.lead.create({
      data: {
        email: 'mike.jones@startup.net',
        name: 'Mike Jones',
        company: 'StartupNet',
        status: 'not_interested',
        campaignId: campaign1.id,
      },
    })
  ])

  // Create some mock API Usage data
  await prisma.apiUsage.createMany({
    data: [
      {
        model: 'gemini-1.5-pro',
        tokens: 4500,
        cost: 0.15,
        source: 'n8n_outreach_script',
      },
      {
        model: 'gemini-1.5-flash',
        tokens: 12000,
        cost: 0.08,
        source: 'email_analyzer',
      }
    ]
  })

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
