/**
 * MEAAF — أداة فك قفل حساب المدير واستعادة الدخول
 * -------------------------------------------------
 * تُشغَّل من سطر الأوامر على نفس الجهاز الذي يحفظ ملف البيانات:
 *
 *   npm run unlock-admin                     # يفك قفل admin ويعطيه كلمة مرور مؤقتة
 *   npm run unlock-admin -- --user dr.khalid # حساب آخر
 *   npm run unlock-admin -- --password "MyNewPass!2345"
 *   npm run unlock-admin -- --list           # عرض كل الحسابات وحالتها
 *   npm run unlock-admin -- --open           # التأكد من أن الدخول التلقائي يعمل
 *
 * الأداة تزيل أسباب القفل المعروفة كلها:
 *   1) حساب مقفل لكثرة المحاولات الخاطئة (lockedUntil)
 *   2) حساب معطل (isActive = false) أو محذوف (isDeleted = true)
 *   3) علامة "يجب تغيير كلمة المرور" التي تحجب كل الشاشات
 *   4) كلمة مرور مجهولة (تُستبدل بأخرى جديدة تُطبع مرة واحدة)
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UserRecord } from '../server/db';
import { ensureAdminUser } from '../server/auth';
import { AUTH_MODE, DEFAULT_TENANT_ID } from '../server/config';

interface Args {
  user: string;
  password?: string;
  list: boolean;
  open: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { user: 'admin', list: false, open: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user' || a === '-u') args.user = argv[++i] || args.user;
    else if (a === '--password' || a === '-p') args.password = argv[++i];
    else if (a === '--list' || a === '-l') args.list = true;
    else if (a === '--open' || a === '-o') args.open = true;
    else if (a.startsWith('--user=')) args.user = a.slice(7);
    else if (a.startsWith('--password=')) args.password = a.slice(11);
  }

  return args;
}

function describeUser(u: UserRecord): string {
  const locked = u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now();
  const flags = [
    u.isDeleted ? 'محذوف' : null,
    !u.isActive ? 'معطل' : null,
    locked ? `مقفل حتى ${u.lockedUntil}` : null,
    u.mustChangePassword ? 'مطالب بتغيير كلمة المرور' : null,
  ].filter(Boolean);

  return `  • ${u.username.padEnd(16)} | ${u.displayName} | منشأة: ${u.tenantId} | دور: ${u.roleName}` +
    (flags.length ? `\n      ⚠ ${flags.join('، ')}` : '\n      ✓ الحالة سليمة');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const raw = db.getRawData();

  console.log('=====================================================');
  console.log('   مِعاف — استعادة الدخول وفك قفل الحسابات');
  console.log('=====================================================');
  console.log(`ملف البيانات : data/meaaf_enterprise_db.json`);
  console.log(`وضع المصادقة : ${AUTH_MODE === 'open' ? 'مفتوح (دخول تلقائي بدون كلمة مرور)' : 'كلمة مرور'}`);
  console.log(`المنشأة الافتراضية: ${DEFAULT_TENANT_ID}`);
  console.log(`عدد الحسابات : ${raw.users.length}`);

  if (args.list) {
    console.log('\n--- الحسابات ---');
    for (const u of raw.users) console.log(describeUser(u));
    console.log('');
    return;
  }

  if (args.open) {
    const { user, created } = ensureAdminUser();
    console.log('\n--- فحص الدخول التلقائي ---');
    console.log(
      created
        ? `✓ تم إنشاء/إصلاح حساب المدير: ${user.username} (${user.displayName})`
        : `✓ حساب المدير موجود وسليم: ${user.username} (${user.displayName})`
    );
    console.log('✓ عند تشغيل الخادم سيدخل المستخدم مباشرة بدون أي كلمة مرور.');
    console.log('');
    return;
  }

  const target = String(args.user).trim();
  const user = raw.users.find(u => u.username.toLowerCase() === target.toLowerCase());

  if (!user) {
    console.error(`\n✗ لا يوجد حساب باسم "${target}".`);
    console.error('  استخدم: npm run unlock-admin -- --list   لعرض الحسابات المتاحة.');
    process.exit(1);
  }

  console.log(`\n--- الحساب المستهدف ---`);
  console.log(describeUser(user));

  const newPassword = args.password || `Meaaf-${crypto.randomBytes(5).toString('hex')}!A1`;

  if (args.password && args.password.length < 12) {
    console.error('\n✗ كلمة المرور يجب أن تتكون من 12 حرفاً على الأقل (سياسة النظام).');
    process.exit(1);
  }

  user.passwordHash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(12));
  user.mustChangePassword = false;
  user.isActive = true;
  user.isDeleted = false;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;

  db.save();

  console.log('\n--- تم التنفيذ ---');
  console.log('✓ أُزيل القفل المؤقت وعاد الحساب نشطاً.');
  console.log('✓ أُزيلت علامة "يجب تغيير كلمة المرور".');
  console.log('✓ حُدِّثت كلمة المرور في ملف البيانات.');
  console.log(`\n  اسم المستخدم : ${user.username}`);
  console.log(`  كلمة المرور  : ${newPassword}`);
  console.log('\n  ⚠ هذه الكلمة تُطبع مرة واحدة فقط ولا تُخزَّن نصاً صريحاً في أي مكان.');
  console.log('  ⚠ غيِّرها من داخل النظام بعد أول دخول.\n');
}

try {
  main();
} catch (err) {
  console.error('\n✗ فشل تنفيذ الأداة:', err instanceof Error ? err.message : err);
  process.exit(1);
}
