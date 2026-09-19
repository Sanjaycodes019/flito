// The app sends its current language as a standard Accept-Language header on
// every request, so anything the server sends on someone's behalf (an email
// with a code) can follow it. Only Nepali is special-cased; everything else,
// including a missing header, is English.
const languageOf = (req) => (String(req.headers?.['accept-language'] || '').trim().toLowerCase().startsWith('ne') ? 'ne' : 'en');

module.exports = { languageOf };
