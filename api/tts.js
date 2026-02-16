export default async function handler(req, res) {
  if (req.method === 'GET') {
    const hasKey = Boolean(process.env.ELEVENLABS_API_KEY);
    return res.status(200).json({
      ok: true,
      service: 'tts',
      elevenlabs_configured: hasKey,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ELEVENLABS_API_KEY' });
  }

  const text = req.body?.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text"' });
  }

  const voiceId = 'nPczCjzI2devNBz1zQrH';
  const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const elevenRes = await fetch(elevenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }),
    });

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();
      return res.status(elevenRes.status).json({
        error: 'ElevenLabs request failed',
        details: errorText,
      });
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audioBuffer);
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
