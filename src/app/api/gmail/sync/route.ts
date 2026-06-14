import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { Buffer } from 'buffer';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// INTENT DETECTION ENGINE
// ---------------------------------------------------------------------------

/**
 * Keywords that strongly signal positive buying / meeting intent.
 * Case-insensitive. Matched against the reply snippet + subject.
 */
const POSITIVE_INTENT_KEYWORDS = [
  'interested',
  'sounds good',
  'tell me more',
  'let\'s connect',
  'let\'s chat',
  'lets connect',
  'lets chat',
  'can we talk',
  'can we chat',
  'schedule a call',
  'book a call',
  'set up a call',
  'hop on a call',
  'jump on a call',
  'free for a call',
  'would love to',
  'open to',
  'happy to',
  'sure, let',
  'yes, please',
  'yes please',
  'tell me about',
  'how does it work',
  'more details',
  'send me',
  'what is the pricing',
  'pricing',
  'cost',
  'demo',
  'free trial',
  'sign up',
  'want to know more',
  'looks interesting',
  'this is interesting',
  'great timing',
  'perfect timing',
  'reach out',
  'good time to connect',
];

/**
 * Keywords that indicate this is an auto-reply / out-of-office.
 * If any of these match, we never classify the reply as a lead.
 */
const AUTO_REPLY_KEYWORDS = [
  'out of office',
  'out-of-office',
  'on vacation',
  'on leave',
  'away from the office',
  'i am away',
  'i\'m away',
  'automatic reply',
  'auto-reply',
  'autoreply',
  'auto reply',
  'do not reply',
  'do-not-reply',
  'noreply',
  'no-reply',
  'this is an automated',
  'this message is automated',
  'unsubscribe',
];

/**
 * Senders whose emails should never become leads (system/postmaster addresses).
 */
const SYSTEM_SENDER_PATTERNS = [
  'mailer-daemon',
  'postmaster',
  'no-reply',
  'noreply',
  'donotreply',
  'do-not-reply',
  'notifications@',
  'support@',
  'bounce',
];

interface IntentResult {
  isLead: boolean;
  isAutoReply: boolean;
  matchedKeywords: string[];
  score: number; // number of positive keyword matches
}

function detectIntent(
  snippet: string,
  subject: string,
  fromEmail: string
): IntentResult {
  const textToCheck = `${snippet} ${subject}`.toLowerCase();
  const fromLower = fromEmail.toLowerCase();

  // 1. Check if it's from a system/no-reply sender
  const isSystemSender = SYSTEM_SENDER_PATTERNS.some((p) =>
    fromLower.includes(p)
  );
  if (isSystemSender) {
    return { isLead: false, isAutoReply: true, matchedKeywords: [], score: 0 };
  }

  // 2. Check for auto-reply / out-of-office markers
  const isAutoReply = AUTO_REPLY_KEYWORDS.some((kw) =>
    textToCheck.includes(kw)
  );
  if (isAutoReply) {
    return { isLead: false, isAutoReply: true, matchedKeywords: [], score: 0 };
  }

  // 3. Count positive intent keyword matches
  const matchedKeywords = POSITIVE_INTENT_KEYWORDS.filter((kw) =>
    textToCheck.includes(kw)
  );

  // A reply is a lead if at least 1 positive keyword matches
  const isLead = matchedKeywords.length > 0;

  return {
    isLead,
    isAutoReply: false,
    matchedKeywords,
    score: matchedKeywords.length,
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

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
        const nestedBody = getEmailBody(part);
        if (nestedBody) return nestedBody;
      }
    }
  } else if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  return bodyStr;
}

/** Parse "John Doe <john@example.com>" → { name, email } */
function parseFrom(fromHeader: string): { name: string | null; email: string } {
  const match = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].replace(/"/g, '').trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: null, email: fromHeader.trim().toLowerCase() };
}

// ---------------------------------------------------------------------------
// SYNC ROUTE
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: { isActive: true, refreshToken: { not: null } },
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        message: 'No connected accounts found. Please authenticate first.',
      });
    }

    let totalSynced = 0;
    let totalLeadsCreated = 0;

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

      const yesterday = new Date(Date.now() - 86400000);
      const dateQuery = `after:${Math.floor(yesterday.getTime() / 1000)}`;

      // --- Sent emails ---
      const sentRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:sent ${dateQuery}`,
      });
      const sentMessages = sentRes.data.messages || [];

      // --- Inbox emails (replies / bounces) ---
      const inboxRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:inbox ${dateQuery}`,
      });
      const inboxMessages = inboxRes.data.messages || [];

      // ── Process Sent Messages ──────────────────────────────────────────────
      for (const msg of sentMessages) {
        if (!msg.id) continue;
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });
        const headers = fullMsg.data.payload?.headers;

        const messageIdHeader =
          headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value;
        let campaignIdHeader =
          headers?.find((h) => h.name?.toLowerCase() === 'x-campaign-id')
            ?.value;

        // Fallback: scan body for hidden tracking tag
        if (!campaignIdHeader && fullMsg.data.payload) {
          const bodyText = getEmailBody(fullMsg.data.payload);
          const match = bodyText.match(/campaign_id:([a-zA-Z0-9-]+)/i);
          if (match?.[1]) campaignIdHeader = match[1];
        }

        if (messageIdHeader && campaignIdHeader) {
          const campaign = await prisma.campaign.upsert({
            where: { name: campaignIdHeader },
            update: {},
            create: { name: campaignIdHeader, status: 'active' },
          });

          await prisma.emailEvent.upsert({
            where: { messageId: messageIdHeader },
            update: {},
            create: {
              messageId: messageIdHeader,
              type: 'sent',
              subject:
                headers?.find((h) => h.name?.toLowerCase() === 'subject')
                  ?.value || '',
              snippet: fullMsg.data.snippet || '',
              campaignId: campaign.id,
              accountId: account.id,
            },
          });
          totalSynced++;
        }
      }

      // ── Process Inbox Messages ─────────────────────────────────────────────
      for (const msg of inboxMessages) {
        if (!msg.id) continue;
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });
        const headers = fullMsg.data.payload?.headers;

        const messageIdHeader =
          headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value;
        const inReplyToHeader =
          headers?.find((h) => h.name?.toLowerCase() === 'in-reply-to')?.value;
        const fromHeader =
          headers?.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
        const subjectHeader =
          headers?.find((h) => h.name?.toLowerCase() === 'subject')?.value ||
          '';
        const snippet = fullMsg.data.snippet || '';

        if (!messageIdHeader) continue;

        // ── Bounce classification ──────────────────────────────────────────
        const subjectLower = subjectHeader.toLowerCase();
        const fromLower = fromHeader.toLowerCase();

        const isHardBounce =
          subjectLower.includes('delivery status notification (failure)') ||
          subjectLower.includes('delivery failure') ||
          subjectLower.includes('undeliverable') ||
          subjectLower.includes('mail delivery failed') ||
          subjectLower.includes('returned mail') ||
          ((fromLower.includes('mailer-daemon') ||
            fromLower.includes('postmaster')) &&
            !subjectLower.includes('delay'));

        const isSoftBounce =
          subjectLower.includes('delivery status notification (delay)') ||
          (subjectLower.includes('delivery status notification') &&
            subjectLower.includes('delay'));

        const isBounce = isHardBounce || isSoftBounce;

        // ── CASE 1: Reply linked to a sent email in DB ─────────────────────
        if (inReplyToHeader) {
          const originalEmail = await prisma.emailEvent.findUnique({
            where: { messageId: inReplyToHeader },
          });

          if (originalEmail) {
            // Handle delayed → bounced upgrade
            if (isHardBounce) {
              const existingDelayed = await prisma.emailEvent.findFirst({
                where: { inReplyTo: inReplyToHeader, type: 'delayed' },
              });
              if (existingDelayed) {
                await prisma.emailEvent.update({
                  where: { id: existingDelayed.id },
                  data: { type: 'bounced', subject: subjectHeader },
                });
                totalSynced++;
                continue;
              }
            }

            const eventType = isHardBounce
              ? 'bounced'
              : isSoftBounce
              ? 'delayed'
              : 'replied';

            // ── INTENT DETECTION (only for genuine replies) ────────────────
            let leadId: string | null = null;

            if (eventType === 'replied') {
              const { name: senderName, email: senderEmail } =
                parseFrom(fromHeader);
              const intent = detectIntent(snippet, subjectHeader, senderEmail);

              if (intent.isLead) {
                // Upsert Lead — don't downgrade if already 'booked'
                const existingLead = await prisma.lead.findUnique({
                  where: { email: senderEmail },
                });

                if (!existingLead) {
                  const newLead = await prisma.lead.create({
                    data: {
                      email: senderEmail,
                      name: senderName,
                      status: 'interested',
                      campaignId: originalEmail.campaignId,
                    },
                  });
                  leadId = newLead.id;
                  totalLeadsCreated++;
                } else {
                  // Only upgrade, never downgrade
                  const upgradeOrder = ['cold', 'interested', 'booked'];
                  const currentIdx = upgradeOrder.indexOf(existingLead.status);
                  const interestedIdx = upgradeOrder.indexOf('interested');

                  if (currentIdx < interestedIdx) {
                    await prisma.lead.update({
                      where: { id: existingLead.id },
                      data: { status: 'interested' },
                    });
                  }
                  leadId = existingLead.id;
                }

                console.log(
                  `[LEAD] ${senderEmail} → interested (matched: ${intent.matchedKeywords.join(', ')})`
                );
              }
            }

            await prisma.emailEvent.upsert({
              where: { messageId: messageIdHeader },
              update: {},
              create: {
                messageId: messageIdHeader,
                inReplyTo: inReplyToHeader,
                type: eventType,
                subject: subjectHeader,
                snippet,
                accountId: account.id,
                campaignId: originalEmail.campaignId,
                leadId,
              },
            });
            totalSynced++;
            continue;
          }
        }

        // ── CASE 2: Standalone bounce ──────────────────────────────────────
        if (isBounce) {
          const bodyText = fullMsg.data.payload
            ? getEmailBody(fullMsg.data.payload)
            : '';
          const campaignMatch = bodyText.match(/campaign_id:([a-zA-Z0-9-]+)/i);

          let campaignId: string | null = null;
          if (campaignMatch?.[1]) {
            const campaign = await prisma.campaign.upsert({
              where: { name: campaignMatch[1] },
              update: {},
              create: { name: campaignMatch[1], status: 'active' },
            });
            campaignId = campaign.id;
          }

          await prisma.emailEvent.upsert({
            where: { messageId: messageIdHeader },
            update: {},
            create: {
              messageId: messageIdHeader,
              inReplyTo: inReplyToHeader || null,
              type: isHardBounce ? 'bounced' : 'delayed',
              subject: subjectHeader,
              snippet,
              accountId: account.id,
              campaignId,
            },
          });
          totalSynced++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      syncedEvents: totalSynced,
      leadsCreated: totalLeadsCreated,
    });
  } catch (error: any) {
    console.error('Gmail sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Gmail data', details: error.message },
      { status: 500 }
    );
  }
}
