/**
 * Local Backfill Script — runs directly on your machine with no timeout limits.
 * Scans the last 90 days of Gmail and permanently stores all campaign emails in Supabase.
 *
 * Usage: node scripts/backfill.mjs
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from the project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function getEmailBody(payload) {
  let bodyStr = '';
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyStr = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        const nested = getEmailBody(part);
        if (nested) return nested;
      }
    }
  } else if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  return bodyStr;
}

async function runBackfill() {
  console.log('🚀 Starting 90-day backfill...\n');

  const accounts = await prisma.emailAccount.findMany({
    where: { isActive: true, refreshToken: { not: null } }
  });

  if (accounts.length === 0) {
    console.log('❌ No connected email accounts found. Please log in to the dashboard first.');
    process.exit(1);
  }

  console.log(`✅ Found ${accounts.length} connected account(s).\n`);

  let totalSynced = 0;
  let totalSkipped = 0;

  for (const account of accounts) {
    console.log(`📧 Processing account: ${account.email}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Look back 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateQuery = `after:${Math.floor(ninetyDaysAgo.getTime() / 1000)}`;

    // Paginate through ALL sent emails
    let pageToken = undefined;
    const allSentMessages = [];
    process.stdout.write('  Fetching sent emails...');
    do {
      const sentRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:sent ${dateQuery}`,
        maxResults: 500,
        pageToken,
      });
      const msgs = sentRes.data.messages || [];
      allSentMessages.push(...msgs);
      pageToken = sentRes.data.nextPageToken;
      process.stdout.write(` ${allSentMessages.length}`);
    } while (pageToken);
    console.log(` total.\n`);

    console.log(`  Processing ${allSentMessages.length} sent emails...`);
    let processed = 0;
    for (const msg of allSentMessages) {
      if (!msg.id) continue;

      const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
      const headers = fullMsg.data.payload?.headers;
      const messageIdHeader = headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;

      // Skip if already stored
      if (messageIdHeader) {
        const existing = await prisma.emailEvent.findUnique({ where: { messageId: messageIdHeader } });
        if (existing) { totalSkipped++; processed++; continue; }
      }

      let campaignIdHeader = headers?.find(h => h.name?.toLowerCase() === 'x-campaign-id')?.value;

      // Check full HTML body for hidden campaign_id tag
      if (!campaignIdHeader && fullMsg.data.payload) {
        const bodyText = getEmailBody(fullMsg.data.payload);
        const match = bodyText.match(/campaign_id:([a-zA-Z0-9-]+)/i);
        if (match && match[1]) campaignIdHeader = match[1];
      }

      if (messageIdHeader && campaignIdHeader) {
        const campaign = await prisma.campaign.upsert({
          where: { name: campaignIdHeader },
          update: {},
          create: { name: campaignIdHeader, status: 'active' }
        });

        await prisma.emailEvent.upsert({
          where: { messageId: messageIdHeader },
          update: {},
          create: {
            messageId: messageIdHeader,
            type: 'sent',
            subject: headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '',
            snippet: fullMsg.data.snippet || '',
            campaignId: campaign.id,
            accountId: account.id,
          }
        });
        totalSynced++;
        console.log(`    ✅ Saved: ${headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || 'No Subject'} [${campaignIdHeader}]`);
      }

      processed++;
      if (processed % 50 === 0) console.log(`  ... ${processed}/${allSentMessages.length} processed`);
    }

    console.log('\n  Checking inbox for replies and bounces...');
    let inboxPageToken = undefined;
    const allInboxMessages = [];
    do {
      const inboxRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:inbox ${dateQuery}`,
        maxResults: 500,
        pageToken: inboxPageToken,
      });
      const msgs = inboxRes.data.messages || [];
      allInboxMessages.push(...msgs);
      inboxPageToken = inboxRes.data.nextPageToken;
    } while (inboxPageToken);

    console.log(`  Found ${allInboxMessages.length} inbox messages to check...`);

    for (const msg of allInboxMessages) {
      if (!msg.id) continue;

      // Skip if already stored
      const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
      const headers = fullMsg.data.payload?.headers;
      const messageIdHeader = headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;

      if (messageIdHeader) {
        const existing = await prisma.emailEvent.findUnique({ where: { messageId: messageIdHeader } });
        if (existing) continue;
      } else { continue; }

      const inReplyToHeader = headers?.find(h => h.name?.toLowerCase() === 'in-reply-to')?.value;
      const fromHeader = headers?.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subjectHeader = headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '';

      // Comprehensive bounce detection
      const isBounce =
        fromHeader.toLowerCase().includes('mailer-daemon') ||
        fromHeader.toLowerCase().includes('postmaster') ||
        fromHeader.toLowerCase().includes('mail delivery') ||
        subjectHeader.toLowerCase().includes('delivery status notification') ||
        subjectHeader.toLowerCase().includes('delivery failure') ||
        subjectHeader.toLowerCase().includes('undeliverable') ||
        subjectHeader.toLowerCase().includes('mail delivery failed') ||
        subjectHeader.toLowerCase().includes('returned mail');

      // CASE 1: Linked to a sent email already in DB
      if (inReplyToHeader) {
        const originalEmail = await prisma.emailEvent.findUnique({ where: { messageId: inReplyToHeader } });
        if (originalEmail) {
          await prisma.emailEvent.upsert({
            where: { messageId: messageIdHeader },
            update: {},
            create: {
              messageId: messageIdHeader,
              type: isBounce ? 'bounced' : 'replied',
              subject: subjectHeader,
              snippet: fullMsg.data.snippet || '',
              accountId: account.id,
              campaignId: originalEmail.campaignId,
            }
          });
          totalSynced++;
          console.log(`    ${isBounce ? '🔴 Bounce' : '💬 Reply'} saved: ${subjectHeader}`);
          continue;
        }
      }

      // CASE 2: Standalone bounce — no matching sent email needed
      if (isBounce) {
        const bodyText = fullMsg.data.payload ? getEmailBody(fullMsg.data.payload) : '';
        const campaignMatch = bodyText.match(/campaign_id:([a-zA-Z0-9-]+)/i);

        let campaignId = null;
        if (campaignMatch && campaignMatch[1]) {
          const campaign = await prisma.campaign.upsert({
            where: { name: campaignMatch[1] },
            update: {},
            create: { name: campaignMatch[1], status: 'active' }
          });
          campaignId = campaign.id;
        } else {
          const latestCampaign = await prisma.campaign.findFirst({ orderBy: { createdAt: 'desc' } });
          campaignId = latestCampaign?.id || null;
        }

        await prisma.emailEvent.upsert({
          where: { messageId: messageIdHeader },
          update: {},
          create: {
            messageId: messageIdHeader,
            type: 'bounced',
            subject: subjectHeader,
            snippet: fullMsg.data.snippet || '',
            accountId: account.id,
            campaignId,
          }
        });
        totalSynced++;
        console.log(`    🔴 Standalone bounce saved: ${subjectHeader}`);
      }
    }
  }

  console.log('\n============================================');
  console.log(`✅ Backfill complete!`);
  console.log(`   New events stored: ${totalSynced}`);
  console.log(`   Already saved (skipped): ${totalSkipped}`);
  console.log('============================================\n');
  console.log('Refresh your dashboard to see all the data!');

  await prisma.$disconnect();
}

runBackfill().catch(async (e) => {
  console.error('❌ Backfill failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
