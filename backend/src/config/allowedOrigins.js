// Origins allowed to call the API and open a socket. FRONTEND_URL may list
// several comma-separated origins, e.g. the custom domain plus the old
// vercel.app URL while people still have it bookmarked. A trailing slash is
// dropped because browsers never send one in the Origin header.
module.exports = function allowedOrigins() {
  const fromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return [...fromEnv, 'http://localhost:19006', 'http://localhost:8081'];
};
