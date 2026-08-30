// api/transcribe.js
// این فایل روی سرور Vercel اجرا می‌شه، نه توی مرورگر کاربر.
// فایل صوتی به‌صورت Base64 داخل JSON از فرانت‌اند می‌رسه و از اینجا به هاگینگ‌فیس فرستاده می‌شه.
// توکن هیچ‌وقت به فرانت‌اند فرستاده نمی‌شه.

export const maxDuration = 60; // اجازه بده تا ۶۰ ثانیه صبر کنه (مدل ممکنه دیر بیدار بشه)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'فقط درخواست POST مجاز است' });
  }

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return res.status(500).json({ error: 'توکن API روی سرور تنظیم نشده است' });
  }

  try {
    const { audio, mime } = req.body || {};

    if (!audio) {
      return res.status(400).json({ error: 'فایل صوتی دریافت نشد' });
    }

    const audioBuffer = Buffer.from(audio, 'base64');

    const MAX_SIZE = 4 * 1024 * 1024;
    if (audioBuffer.length > MAX_SIZE) {
      return res.status(400).json({ error: 'حجم فایل بیش از حد مجاز است' });
    }

    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': mime || 'audio/mpeg'
        },
        body: audioBuffer
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error('Hugging Face transcription error:', errText);
      return res.status(502).json({ error: 'خطا در پردازش صوت. جزئیات: ' + errText.slice(0, 300) });
    }

    const data = await hfRes.json();
    const text = data?.text || '';

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'خطای داخلی سرور: ' + (err && err.message ? err.message : String(err)) });
  }
}
