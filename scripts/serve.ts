/**
 * مشغّل خادم مِعاف مع تحديد وضع المصادقة.
 *
 * وُجد هذا الملف لأن ضبط متغيرات البيئة بطريقة `MEAAF_AUTH_MODE=open tsx server.ts`
 * لا يعمل على Windows (cmd / PowerShell). هنا يُضبط المتغير داخل العملية نفسها قبل
 * تحميل الخادم، فيعمل الأمر نفسه على Windows وLinux وmacOS:
 *
 *   npm run start:open       # دخول تلقائي بدون كلمة مرور (الافتراضي)
 *   npm run start:password   # شاشة تسجيل دخول بكلمة مرور
 */
import type { AuthMode } from '../server/config';

const requested = (process.argv[2] || 'open').trim().toLowerCase();
const mode: AuthMode = requested === 'password' ? 'password' : 'open';

process.env.MEAAF_AUTH_MODE = mode;

console.log(`[MEAAF] تشغيل الخادم بوضع المصادقة: ${mode === 'open' ? 'مفتوح (بدون كلمة مرور)' : 'كلمة مرور'}`);

// Imported after the environment variable is set, because server/config.ts reads it once
// at load time.
await import('../server.ts');
