import OpenAI from 'openai';

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function enhanceDescription(raw: string): Promise<string> {
  const client = getClient();
  if (!client) return raw;
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a travel copywriter for Sri Lanka tourism. Rewrite the listing description in 2-3 punchy sentences — vivid, engaging, and strictly under 200 characters. Return only the improved text, nothing else.',
        },
        { role: 'user', content: raw },
      ],
      max_tokens: 80,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() ?? raw;
  } catch {
    return raw;
  }
}

type ListingContext = {
  id: string;
  title: string;
  type: string;
  category?: string;
  placeName?: string;
  price?: string;
  description?: string;
  startDateTime?: string;
  imageUrl?: string;
  isPrimary?: boolean;
};

export type PlanResult = {
  text: string;
  listings: Array<{
    id: string;
    title: string;
    imageUrl?: string;
    placeName?: string;
    price?: string;
    type: string;
  }>;
};

const SYSTEM_PROMPT = `You are the AI travel assistant built into Ceylonify — a Sri Lanka tourism marketplace app. Your ONLY job is to help users plan trips using real experiences listed on Ceylonify.

STRICT RULES:
1. Only help with Sri Lanka travel. Politely decline anything unrelated.
2. NEVER use markdown formatting. No **, no *, no #. No bold, no italic.
3. Use "Day 1 — Theme" for day titles and "•" for bullet points.
4. Always prioritise Ceylonify listings when they are provided. Reference them by name in the plan.
5. If a PRIMARY listing is marked, build the ENTIRE plan around that listing as the centrepiece activity.
6. Mark each Ceylonify suggestion with: [Book on Ceylonify: listing name]
7. Stay focused on Ceylonify's offerings. Do not drift into generic travel content.
8. Keep responses practical, specific and friendly.

RESPONSE FORMAT (plain text only):
Day 1 — Theme
• Morning: activity
• Afternoon: activity
• Evening: activity
Eat at: specific restaurant and dish
Tip: insider note
Transport: how to get there and time estimate
[Book on Ceylonify: listing name — LKR price or Free]`;

function extractMentionedListings(
  text: string,
  context: ListingContext[],
): PlanResult['listings'] {
  const regex = /\[Book on Ceylonify:\s*([^—\]]+)/gi;
  const mentioned: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    mentioned.push(m[1].trim().toLowerCase());
  }
  if (!mentioned.length) return [];
  return context
    .filter((l) =>
      mentioned.some(
        (t) =>
          l.title.toLowerCase().includes(t) ||
          t.includes(l.title.toLowerCase()),
      ),
    )
    .map((l) => ({
      id: l.id,
      title: l.title,
      imageUrl: l.imageUrl,
      placeName: l.placeName,
      price: l.price,
      type: l.type,
    }));
}

export async function planItinerary(
  messages: { role: 'user' | 'assistant'; content: string }[],
  listingsContext?: ListingContext[],
): Promise<PlanResult> {
  const client = getClient();
  if (!client) return { text: 'AI planner is not configured. Please contact support.', listings: [] };
  try {
    const systemMessages: { role: 'system'; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (listingsContext?.length) {
      const primary = listingsContext.filter((l) => l.isPrimary);
      const others = listingsContext.filter((l) => !l.isPrimary);

      let contextText = 'CEYLONIFY LISTINGS (use these first — prioritise them in your plan):\n';
      if (primary.length) {
        contextText += primary.map((l) =>
          `[PRIMARY — BUILD THE PLAN AROUND THIS] "${l.title}" — ${l.type}${l.category ? ', ' + l.category : ''} — ${l.placeName ?? 'Sri Lanka'}${l.price ? ' — LKR ' + l.price : ' — Free'}${l.startDateTime ? ' — Date: ' + new Date(l.startDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}${l.description ? ' — ' + l.description.slice(0, 120) + '…' : ''}`,
        ).join('\n');
        contextText += '\n';
      }
      if (others.length) {
        contextText += others.map((l) =>
          `• "${l.title}" — ${l.type}${l.category ? ', ' + l.category : ''} — ${l.placeName ?? 'Sri Lanka'}${l.price ? ' — LKR ' + l.price : ' — Free'}${l.description ? ' — ' + l.description.slice(0, 80) + '…' : ''}`,
        ).join('\n');
      }
      systemMessages.push({ role: 'system', content: contextText });
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [...systemMessages, ...messages],
      max_tokens: 2000,
      temperature: 0.7,
    });
    const rawText = response.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a plan. Please try again.';
    const matchedListings = extractMentionedListings(rawText, listingsContext ?? []);
    return { text: rawText, listings: matchedListings };
  } catch {
    return { text: 'Sorry, the AI planner is unavailable right now. Please try again later.', listings: [] };
  }
}

export async function aiReviewContent(
  title: string,
  description: string,
): Promise<{ safe: boolean; confidence: number; flags: string[]; summary: string }> {
  const client = getClient();
  if (!client) {
    return { safe: true, confidence: 0, flags: [], summary: 'AI review not configured — manual review required.' };
  }
  try {
    const result = await client.moderations.create({
      model: 'omni-moderation-latest',
      input: `${title}\n\n${description}`,
    });
    const outcome = result.results[0];
    if (!outcome) return { safe: true, confidence: 0, flags: [], summary: 'Unable to analyze content.' };

    const flags = Object.entries(outcome.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    const scores = (outcome.category_scores ?? {}) as unknown as Record<string, number>;
    const allValues = Object.values(scores);
    const maxScore = flags.length > 0
      ? Math.max(...flags.map((f) => scores[f] ?? 0))
      : allValues.length > 0 ? Math.max(...allValues) : 0;
    const confidence = Math.round(Math.min(maxScore + 0.5, 1) * 100) / 100;

    if (!outcome.flagged) {
      return { safe: true, confidence: Math.max(0.85, 1 - maxScore), flags: [], summary: 'Content appears suitable for the platform.' };
    }

    const summary = `Content flagged for: ${flags.join(', ')}. Manual review recommended before approval.`;
    return { safe: false, confidence, flags, summary };
  } catch {
    return { safe: true, confidence: 0, flags: [], summary: 'AI review failed — manual review recommended.' };
  }
}

export async function moderateListing(
  title: string,
  description: string,
): Promise<{ flagged: boolean; reason?: string }> {
  const client = getClient();
  if (!client) return { flagged: false };
  try {
    const result = await client.moderations.create({
      model: 'omni-moderation-latest',
      input: `${title} ${description}`,
    });
    const outcome = result.results[0];
    if (!outcome?.flagged) return { flagged: false };
    const triggered = Object.entries(outcome.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    return { flagged: true, reason: triggered || 'policy violation' };
  } catch {
    return { flagged: false };
  }
}
