const FOOD_ANALYSIS_PROMPT = `Check whether this image visibly contains food or a drink intended for consumption. If it does, identify each visible item and estimate its edible portion and calories from the image. Be conservative and explain uncertainty through approximate portions. Return only valid JSON in this exact shape: {"contains_food":true,"foods":[{"name":"food name","portion":"approximate portion","estimated_calories":123}],"note":"brief uncertainty note"}. Sum item calories yourself only if useful, but the app will calculate the displayed total from the item estimates. If no food or drink is visible, return {"contains_food":false,"foods":[],"note":"No food was identified."}. Do not invent hidden ingredients or claim precision from an image.`;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;
const MAX_IMAGE_DATA_URL_LENGTH = 3_900_000;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'The food analysis service is not configured.' });
  }

  const image = req.body?.image;
  if (typeof image !== 'string' || image.length > MAX_IMAGE_DATA_URL_LENGTH
      || !IMAGE_DATA_URL_PATTERN.test(image)) {
    return res.status(400).json({ error: 'Provide a supported image smaller than 3 MB.' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: FOOD_ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: image } }
          ]
        }],
        usage: { include: true }
      })
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(502).json({
        error: result?.error?.message || 'The food analysis provider returned an error.'
      });
    }

    return res.status(200).json(result);
  } catch {
    return res.status(502).json({ error: 'Unable to reach the food analysis provider.' });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};