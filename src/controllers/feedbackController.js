const { getLocale } = require('../config/locale');

function renderFeedbackPage(req, res) {
  const requestedLang = req.query.lang && typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : 'en';
  const lang = requestedLang === 'fr' ? 'fr' : 'en';
  const locale = getLocale(lang);
  const today = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'full'
  }).format(new Date());

  const questions = locale.questions
    .map((question, index) => `
        <div class="question">
          <label for="q${index + 1}">${index + 1}. ${question}</label>
          <textarea id="q${index + 1}" name="q${index + 1}" rows="5" required>${locale.answers[index]}</textarea>
        </div>
      `)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${locale.pageTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; background: #f8fafc; color: #0f172a; }
      .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin-bottom: 8px; }
      .meta { color: #475569; margin-bottom: 20px; }
      form { display: flex; flex-direction: column; gap: 20px; }
      .question { display: flex; flex-direction: column; gap: 10px; }
      textarea { resize: vertical; min-height: 100px; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; font: 16px Arial, sans-serif; }
      button { width: fit-content; padding: 12px 18px; border: none; border-radius: 8px; background: #2563eb; color: white; font-size: 16px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>${locale.pageTitle}</h1>
      <div class="meta">${today}</div>
      <p>${locale.instructions}</p>
      <form>
        ${questions}
        <button type="submit">${locale.submit}</button>
      </form>
    </div>
  </body>
</html>`;

  res.type('html').send(html);
}

module.exports = { renderFeedbackPage };
