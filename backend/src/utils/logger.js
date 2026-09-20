const util = require('util');
const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';

const base = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

// Call sites pass console-style arguments, so the wrapper formats them into
// one message rather than relying on pino's own (obj, msg) signature.
const wrap = (level) => (...args) => base[level](util.format(...args));

module.exports = {
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
  debug: wrap('debug'),
  raw: base,
};
