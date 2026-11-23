const locales = {
  en: require('../../locales/en.json'),
  fr: require('../../locales/fr.json')
};

function getLocale(lang = 'en') {
  const safeLang = typeof lang === 'string' ? lang.toLowerCase() : 'en';
  return Object.prototype.hasOwnProperty.call(locales, safeLang) ? locales[safeLang] : locales.en;
}

module.exports = { getLocale };
