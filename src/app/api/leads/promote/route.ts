import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Extract the first email address found in a block of text */
function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Extract a person's first name from the reply subject line.
 * e.g.  "Re: Shraddha, closing the loop"  → "Shraddha"
 *       "Re: Pulkit closing the loop"      → "Pulkit"
 *       "Re: Your message"                 → null
 */
function extractNameFromSubject(subject: string): string | null {
  // Strip leading "Re: / Fwd:" prefixes
  const clean = subject.replace(/^(re|fwd|fw)\s*:\s*/i, '').trim();
  // First word before a comma or space — only if it looks like a proper name
  const match = clean.match(/^([A-Z][a-z]{1,20})[,\s]/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const { eventId } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    // Fetch the reply event with campaign info
    const event = await prisma.emailEvent.findUnique({
      where: { id: eventId },
      include: { campaign: true, lead: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.type !== 'replied') {
      return NextResponse.json({ error: 'Only replied events can be promoted' }, { status: 400 });
    }

    // If already a lead — return existing lead info
    if (event.leadId && event.lead) {
      return NextResponse.json({
        success: true,
        alreadyLead: true,
        lead: event.lead,
      });
    }

    // Try to extract email and name from the snippet/subject
    const snippet = event.snippet || '';
    const subject = event.subject || '';

    const email = extractEmail(snippet) ?? extractEmail(subject);
    const name  = extractNameFromSubject(subject);

    if (!email) {
      return NextResponse.json(
        { error: 'Could not detect a sender email in this reply. Please add the lead manually.' },
        { status: 422 }
      );
    }

    // Upsert the Lead (never downgrade status)
    const existingLead = await prisma.lead.findUnique({ where: { email } });

    let lead;
    if (!existingLead) {
      lead = await prisma.lead.create({
        data: {
          email,
          name,
          status: 'interested',
          campaignId: event.campaignId ?? null,
        },
      });
    } else {
      // Only upgrade, never downgrade
      const upgradeOrder = ['cold', 'interested', 'booked', 'not_interested'];
      const currentIdx   = upgradeOrder.indexOf(existingLead.status);
      const interestedIdx = upgradeOrder.indexOf('interested');
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          status: currentIdx < interestedIdx ? 'interested' : existingLead.status,
          name: existingLead.name ?? name,
        },
      });
    }

    // Link the EmailEvent → Lead
    await prisma.emailEvent.update({
      where: { id: eventId },
      data: { leadId: lead.id },
    });

    return NextResponse.json({ success: true, alreadyLead: false, lead });
  } catch (err: any) {
    console.error('[promote-lead]', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
