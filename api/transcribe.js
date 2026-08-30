// api/transcribe.js
// این فایل روی سرور Vercel اجرا می‌شه، نه توی مرورگر کاربر.
// فایل صوتی مستقیم از فرانت‌اند به این تابع می‌رسه و از اینجا به هاگینگ‌فیس فرستاده می‌شه.
// توکن هیچ‌وقت به فرانت‌اند فرستاده نمی‌شه.

export const config = {
  api: {
    bodyParser: false // چون داده‌ی خام صوتی (باینری) می‌گیریم، نه JSON
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'فقط درخواست POST مجاز است' });
  }

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return res.status(500).json({ error: 'توکن API روی سرور تنظیم نشده است' });
  }

  try {
    const audioBuffer = await readRawBody(req);

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'فایل صوتی دریافت نشد' });
    }

    // سقف ۲۵ مگابایت (هم‌راستا با محدودیت فرانت‌اند)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioBuffer.length > MAX_SIZE) {
      return res.status(400).json({ error: 'حجم فایل بیش از حد مجاز است' });
    }

    const contentType = req.headers['content-type'] || 'audio/mpeg';

    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/C1Tech/whisper_base_persian',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': contentType
        },
        body: audioBuffer
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error('Hugging Face transcription error:', errText);
      return res.status(502).json({ error: 'خطا در پردازش صوت. ممکن است مدل هنوز در حال بارگذاری باشد؛ چند ثانیه دیگر دوباره امتحان کن. جزئیات: ' + errText.slice(0, 200) });
    }

    const data = await hfRes.json();
    const text = data?.text || '';

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'خطای داخلی سرور: ' + (err && err.message ? err.message : String(err)) });
  }
}
