import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getEmailBody(payload: any): string {
  let bodyStr = '';
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        // HTML is exactly what we want, return it immediately
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
      if (part.mimeType === 'text/plain' && part.body?.data) {
        // Save plain text just in case, but keep looping to see if HTML exists
        bodyStr = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
      if (part.parts) {
        const nestedBody = getEmailBody(part);
        if (nestedBody) return nestedBody; // Nested HTML found
      }
    }
  } else if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  
  return bodyStr;
}

export async function GET() {
  try {
    // 1. Get all active connected email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: { isActive: true, refreshToken: { not: null } }
    });

    if (accounts.length === 0) {
      return NextResponse.json({ message: 'No connected accounts found. Please authenticate first.' });
    }

    let totalSynced = 0;

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

      // Fetch Sent Emails from the last 24 hours
      // In production, we'd store the lastSync timestamp and query since then.
      const yesterday = new Date(Date.now() - 86400000);
      const dateQuery = `after:${Math.floor(yesterday.getTime() / 1000)}`;
      
      const sentRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:sent ${dateQuery}`,
      });

      const sentMessages = sentRes.data.messages || [];
      
      // Fetch Inbox Emails (potential replies)
      const inboxRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:inbox ${dateQuery}`,
      });

      const inboxMessages = inboxRes.data.messages || [];

      // Process Sent Messages
      for (const msg of sentMessages) {
        if (!msg.id) continue;
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
        const headers = fullMsg.data.payload?.headers;
        
        const messageIdHeader = headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;
        let campaignIdHeader = headers?.find(h => h.name?.toLowerCase() === 'x-campaign-id')?.value;
        
        // Fallback: Check full HTML body for hidden tracking tag
        if (!campaignIdHeader && fullMsg.data.payload) {
          const bodyText = getEmailBody(fullMsg.data.payload);
          const match = bodyText.match(/campaign_id:([a-zA-Z0-9-]+)/i);
          if (match && match[1]) {
            campaignIdHeader = match[1];
          }
        }
        
        // STRICT FILTER: Only save if it's an actual campaign email
        if (messageIdHeader && campaignIdHeader) {
          await prisma.emailEvent.upsert({
            where: { messageId: messageIdHeader },
            update: {},
            create: {
              messageId: messageIdHeader,
              type: 'sent',
              subject: headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '',
              snippet: fullMsg.data.snippet || '',
              campaignId: campaignIdHeader,
              accountId: account.id
            }
          });
          totalSynced++;
        }
      }

      // Process Inbox Messages (Replies/Bounces)
      for (const msg of inboxMessages) {
        if (!msg.id) continue;
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
        const headers = fullMsg.data.payload?.headers;
        
        const messageIdHeader = headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value;
        const inReplyToHeader = headers?.find(h => h.name?.toLowerCase() === 'in-reply-to')?.value;
        
        // Basic bounce detection logic
        const fromHeader = headers?.find(h => h.name?.toLowerCase() === 'from')?.value || '';
        const isBounce = fromHeader.toLowerCase().includes('mailer-daemon') || fromHeader.toLowerCase().includes('postmaster');
        
        // STRICT FILTER: Only save if it's a direct reply to an email we sent
        if (messageIdHeader && inReplyToHeader) {
          const originalEmail = await prisma.emailEvent.findUnique({
            where: { messageId: inReplyToHeader }
          });
          
          if (originalEmail) {
            await prisma.emailEvent.upsert({
              where: { messageId: messageIdHeader },
              update: {},
              create: {
                messageId: messageIdHeader,
                type: isBounce ? 'bounced' : 'replied',
                subject: headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '',
                snippet: fullMsg.data.snippet || '',
                accountId: account.id,
                campaignId: originalEmail.campaignId // Link directly to original campaign
              }
            });
            totalSynced++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, syncedEvents: totalSynced });

  } catch (error) {
    console.error('Gmail sync error:', error);
    return NextResponse.json({ error: 'Failed to sync Gmail data' }, { status: 500 });
  }
}
