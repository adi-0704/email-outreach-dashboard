import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Gemini 2.5 Flash pricing (per token)
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  'gemini-1.5-pro':   { input: 1.25  / 1_000_000, output: 5.00 / 1_000_000 },
  'gpt-4o':           { input: 2.50  / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-mini':      { input: 0.15  / 1_000_000, output: 0.60 / 1_000_000 },
  'imagen-3':         { input: 0.0,                  output: 0.03 },
  'imagen-4':         { input: 0.0,                  output: 0.03 },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const model        = body.model || 'gemini-2.5-flash';
    const inputTokens  = Number(body.inputTokens  || body.tokens || 0);
    const outputTokens = Number(body.outputTokens || 0);
    const source       = body.source || 'n8n';

    // Calculate cost using model pricing
    const pricing  = PRICING[model] || PRICING['gemini-2.5-flash'];
    const cost     = (inputTokens * pricing.input) + (outputTokens * pricing.output);
    const totalTokens = inputTokens + outputTokens;

    await prisma.apiUsage.create({
      data: {
        model,
        tokens: totalTokens,
        cost,
        source,
      }
    });

    return NextResponse.json({ 
      success: true, 
      logged: { model, inputTokens, outputTokens, totalTokens, cost: `$${cost.toFixed(6)}`, source }
    });

  } catch (error: any) {
    console.error('Cost logging error:', error);
    return NextResponse.json({ error: 'Failed to log cost', details: error.message }, { status: 500 });
  }
}
