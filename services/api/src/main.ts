import { Prisma } from '@prisma/client';

// Polyfill BigInt JSON serialization globally
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Polyfill Prisma Decimal JSON serialization globally
if (Prisma && (Prisma as any).Decimal) {
  (Prisma as any).Decimal.prototype.toJSON = function () {
    return this.toNumber ? this.toNumber() : Number(this.toString());
  };
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { isProduction } from './common/config/env.util';

const REQUIRED_CONFIG: { name: string; purpose: string }[] = [
  { name: 'DATABASE_URL', purpose: 'PostgreSQL connection' },
  { name: 'JWT_SECRET', purpose: 'access-token signing' },
  { name: 'JWT_REFRESH_SECRET', purpose: 'refresh-token signing' },
  { name: 'TELEGRAM_BOT_TOKEN', purpose: 'Telegram bot authentication' },
  { name: 'TELEGRAM_WEBAPP_URL', purpose: 'canonical web application origin' },
  { name: 'ADMIN_SESSION_PEPPER', purpose: 'administrator session-token hashing' },
  { name: 'SUPER_ADMIN_TELEGRAM_IDS', purpose: 'administrator bootstrap allow-list' },
  { name: 'USDT_RECEIVING_ADDRESS', purpose: 'treasury-controlled USDT receiving address' },
];

function validateProductionConfig() {
  if (!isProduction()) return;
  const missing = REQUIRED_CONFIG.filter((c) => !process.env[c.name] || !process.env[c.name]!.trim());
  if (missing.length === 0) return;
  console.error(
    '[Config] FATAL: Production boot aborted. Missing required environment variables:\n' +
      missing.map((c) => `  - ${c.name} (${c.purpose})`).join('\n'),
  );
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  console.warn('[Process] Non-fatal uncaughtException:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Process] Non-fatal unhandledRejection:', reason?.message || reason);
});

async function bootstrap() {
  validateProductionConfig();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Security Headers Middleware (Helmet-compatible CSP, HSTS, X-Content-Type-Options)
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction()) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org https://oauth.telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.telegram.org https://oauth.telegram.org; frame-ancestors 'self' https://t.me https://web.telegram.org;"
      );
    }
    next();
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!isProduction() || !origin) {
        callback(null, true);
        return;
      }
      const extraOrigins = [
        process.env.CORS_ORIGINS,
        process.env.FRONTEND_URL,
        process.env.WEBAPP_URL,
        process.env.ADDITIONAL_ALLOWED_ORIGINS,
      ]
        .filter((o): o is string => !!o)
        .flatMap((o) => o.split(','))
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter((o) => o.length > 0);

      const allowedOrigins = [
        process.env.TELEGRAM_WEBAPP_URL,
        ...extraOrigins,
        'https://titanstream.app',
        'https://tetherstream.app',
        'https://titanstream.cc',
        'https://www.titanstream.cc',
        'https://tetherstream.cc',
        'https://www.tetherstream.cc',
      ].filter((o): o is string => !!o).map(o => o.replace(/\/$/, ''));

      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.tetherstream.app') ||
        cleanOrigin.endsWith('.titanstream.app') ||
        cleanOrigin.endsWith('.tetherstream.cc') ||
        cleanOrigin.endsWith('.titanstream.cc') ||
        cleanOrigin.endsWith('.pages.dev') ||
        cleanOrigin.endsWith('.workers.dev') ||
        cleanOrigin.endsWith('.netlify.app') ||
        cleanOrigin.endsWith('.railway.app') ||
        cleanOrigin.endsWith('.railway.internal') ||
        cleanOrigin.endsWith('.ngrok-free.dev') ||
        cleanOrigin.endsWith('.ngrok.io')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Telegram-Init-Data',
      'X-Admin-Token',
      'X-StepUp-Token',
      'x-stepup-token',
      'X-Idempotency-Key',
      'x-idempotency-key',
      'Idempotency-Key',
      'ngrok-skip-browser-warning',
      'crypto-pay-api-signature',
    ],
  });

  const config = new DocumentBuilder()
    .setTitle('TitanStream API')
    .setDescription('Telegram-native financial application backend')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`TitanStream API running on port ${port} [v1.0.1]`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error('[TitanStream API] Fatal error during bootstrap:', err);
  process.exit(1);
});
