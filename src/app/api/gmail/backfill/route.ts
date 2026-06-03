import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { Buffer } from 'buffer';

const prisma = new PrismaClient();

function getEmailBody(payload: any): string {
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

// One-time backfill: scans the last 90 days of Gmail and stores everything permanently
export async function GET() {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: { isActive: true, refreshToken: { not: null } }
    });

    if (accounts.length === 0) {
      return NextResponse.json({ message: 'No connected accounts found.' });
    }

    let totalSynced = 0;
    let totalSkipped = 0;

    for (const account of accounts) {
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

      // Look back 90 days for all historical campaign emails
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const dateQuery = `after:${Math.floor(ninetyDaysAgo.getTime() / 1000)}`;

      // Paginate through ALL sent emails (not just first 100)
      let pageToken: string | undefined = undefined;
      const allSentMessages: { id: string }[] = [];

      do {
        const sentRes: any = await gmail.users.messages.list({
          userId: 'me',
          q: `in:sent ${dateQuery}`,
          maxResults: 500,
          pageToken,
        });
        const msgs = sentRes.data.messages || [];
        allSentMessages.push(...msgs);
        pageToken = sentRes.data.nextPageToken;
      } while (pageToken);

      // Process each sent email
      for (const msg of allSentMessages) {
        if (!msg.id) continue;
        
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
        const headers = fullMsg.data.payload?.headers;
        const messageIdHeader = headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;

        // Skip if already stored
        if (messageIdHeader) {
          const existing = await prisma.emailEvent.findUnique({ where: { messageId: messageIdHeader } });
          if (existing) { totalSkipped++; continue; }
        }

        let campaignIdHeader = headers?.find(h => h.name?.toLowerCase() === 'x-campaign-id')?.value;

        // Check full HTML body for hidden campaign tag
        if (!campaignIdHeader && fullMsg.data.payload) {
          const bodyText = getEmailBody(fullMsg.data.payload);
          const match = bodyText.match(/campaign_id:([a-zA-Z0-9-]+)/i);
          if (match && match[1]) campaignIdHeader = match[1];
        }

        if (messageIdHeader && campaignIdHeader) {
          // Auto-create campaign if it doesn't exist
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
        }
      }

      // Also check inbox for replies to our campaign emails
      let inboxPageToken: string | undefined = undefined;
      const allInboxMessages: { id: string }[] = [];

      do {
        const inboxRes: any = await gmail.users.messages.list({
          userId: 'me',
          q: `in:inbox ${dateQuery}`,
          maxResults: 500,
          pageToken: inboxPageToken,
        });
        const msgs = inboxRes.data.messages || [];
        allInboxMessages.push(...msgs);
        inboxPageToken = inboxRes.data.nextPageToken;
      } while (inboxPageToken);

      for (const msg of allInboxMessages) {
        if (!msg.id) continue;
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
        const headers = fullMsg.data.payload?.headers;
        const messageIdHeader = headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;
        const inReplyToHeader = headers?.find(h => h.name?.toLowerCase() === 'in-reply-to')?.value;

        if (messageIdHeader && inReplyToHeader) {
          const originalEmail = await prisma.emailEvent.findUnique({ where: { messageId: inReplyToHeader } });
          if (originalEmail) {
            const fromHeader = headers?.find(h => h.name?.toLowerCase() === 'from')?.value || '';
            const isBounce = fromHeader.toLowerCase().includes('mailer-daemon') || fromHeader.toLowerCase().includes('postmaster');
            await prisma.emailEvent.upsert({
              where: { messageId: messageIdHeader },
              update: {},
              create: {
                messageId: messageIdHeader,
                type: isBounce ? 'bounced' : 'replied',
                subject: headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '',
                snippet: fullMsg.data.snippet || '',
                accountId: account.id,
                campaignId: originalEmail.campaignId,
              }
            });
            totalSynced++;
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Backfill complete! Stored ${totalSynced} new events. Skipped ${totalSkipped} already saved.`,
      newEvents: totalSynced,
      skipped: totalSkipped,
    });

  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: 'Backfill failed', details: error.message }, { status: 500 });
  }
}
