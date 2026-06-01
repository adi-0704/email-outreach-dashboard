import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Google Gemini Pricing (per 1 million tokens)
const PRICING = {
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  // fallback pricing if model not found
  'default': { input: 0.0, output: 0.0 }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, inputTokens, outputTokens, source } = body;

    if (!model || inputTokens === undefined || outputTokens === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine pricing rates
    const rates = PRICING[model as keyof typeof PRICING] || PRICING['default'];
    
    // Calculate cost in dollars
    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;
    const totalCost = inputCost + outputCost;

    // Save to database
    const usage = await prisma.apiUsage.create({
      data: {
        model,
        tokens: inputTokens + outputTokens,
        cost: totalCost,
        source: source || 'unknown',
      }
    });

    return NextResponse.json({ success: true, usage });
  } catch (error) {
    console.error('Error logging API cost:', error);
    return NextResponse.json({ error: 'Failed to log cost' }, { status: 500 });
  }
}
