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
            'You are a travel copywriter specializing in Sri Lanka tourism. Improve the listing description to be engaging, vivid, and informative. Keep it under 300 words. Return only the improved text with no extra commentary.',
        },
        { role: 'user', content: raw },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() ?? raw;
  } catch {
    return raw;
  }
}

export async function planItinerary(
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const client = getClient();
  if (!client) return 'AI planner is not configured. Please contact support.';
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a Sri Lanka travel expert and trip planner. When given a trip request, return a detailed day-by-day itinerary. Format each day as:

**Day 1 — [Theme]**
- Morning: ...
- Afternoon: ...
- Evening: ...
- 🍽 Eat at: [restaurant + dish recommendation]
- 💡 Tip: [insider note]

Include transport suggestions between locations, estimated travel times, and budget notes if relevant. Keep the tone friendly and practical. If the destination is outside Sri Lanka, still help but note you specialize in Sri Lanka.`,
        },
        ...messages,
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a plan. Please try again.';
  } catch {
    return 'Sorry, the AI planner is unavailable right now. Please try again later.';
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
