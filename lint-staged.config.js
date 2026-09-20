const quote = (files) => files.map((file) => JSON.stringify(file)).join(' ');

module.exports = {
  'backend/**/*.js': (files) => `node scripts/lint-project.js backend ${quote(files)}`,
  'frontend/**/*.js': (files) => `node scripts/lint-project.js frontend ${quote(files)}`,
};
