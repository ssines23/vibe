import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getVibeSearchQuery(description: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a music expert. Convert user descriptions of moods, feelings, or vibes into a single concise YouTube search query that will find matching music. Return ONLY the search query, nothing else.',
        },
        {
          role: 'user',
          content: description,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || description;
  } catch (error) {
    console.error('OpenAI error:', error);
    return description; // Fallback to original description
  }
}
