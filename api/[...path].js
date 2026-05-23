let appPromise;

function getPath(req) {
  const forwardedPath = req.headers['x-forwarded-uri'] || req.url || '';
  return String(forwardedPath).split('?')[0];
}

export default async function handler(req, res) {
  const pathname = getPath(req);

  if (pathname === '/health' || pathname === '/api/health') {
    return res.status(200).json({
      status: 'ok',
      runtime: 'vercel',
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
    });
  }

  appPromise ??= import('../backend/src/app.js').then((module) => module.default);
  const app = await appPromise;

  return app(req, res);
}
