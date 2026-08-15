// Vercel Serverless Function.
// Generates a short-lived signature for a Cloudinary upload so the browser
// never needs to know the Cloudinary API secret. The secret is read from an
// environment variable set in the Vercel dashboard — it is never committed
// to the repository.

const crypto = require('crypto');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    res.status(500).json({ error: 'Server is missing Cloudinary environment variables.' });
    return;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  res.status(200).json({ timestamp, signature, apiKey, cloudName });
};
