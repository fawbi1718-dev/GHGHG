# دالة إعداد النشر على إنستغرام — ١٥ دقيقة

## الخطوة ١ — حساب إنستغرام (٢ د)
1. افتح إنستغرام → الإعدادات → «إعدادات الحساب» → «التبديل إلى حساب تجاري/احترافي»
2. اختر فئة: صيدلية / تقنية. لا يهم كثيراً.

## الخطوة ٢ — صفحة فيسبوك مربوطة (٣ د)
1. أنشئ صفحة فيسبوك باسم «إشمون» (إن لم تكن موجودة)
2. إنستغرام → إعدادات الأعمال → «ربط حساب فيسبوك» → اختر الصفحة

## الخطوة ٣ — تطبيق ميتا للمطورين (٧ د)
1. افتح developers.facebook.com/apps → «إنشاء تطبيق» → نوع: Business
2. من اللوحة: إضافة منتج → **Instagram** (Instagram API with Instagram Login)
3. Instagram → «API setup with Instagram login» → أضف الحساب التجاري واتبع شاشة التفويض
4. انسخ:
   - **Instagram Account ID** (يبدأ برقم 1784...)
   - **Access Token** (طويل) — اضغط «Generate token» إذا لزم

> ملاحظة: التوكن التجريبي يعمل للنشر على حسابك أنت مباشرة. عند طلب ميتا «Advanced Access» لاحقاً (بعد أول ١٠٠ متابع مثلاً) الموافقة تلقائية عادة لأنه حسابك الخاص.

## الخطوة ٤ — مفاتيح سوبا بيز (٣ د)
1. Supabase Dashboard → Project Settings → API
2. انسخ `Project URL` و `service_role key` (سري جداً — لا ترسله لأحد ولا ترفعه git)
3. Storage → New bucket → اسم `reels` → فعّل **Public bucket**

## الخطوة ٥ — ملف الإعداد المحلي (دقيقة)
أنشئ `marketing/ig.config.json`:
```json
{
  "accessToken": "IG...التوكن...",
  "igUserId": "17841...",
  "apiHost": "https://graph.instagram.com",
  "apiVersion": "v23.0",
  "supabaseUrl": "https://rifccksampnzisgiqfrm.supabase.co",
  "supabaseBucket": "reels",
  "supabaseServiceKey": "eyJ...service_role..."
}
```
تأكد أن `marketing/ig.config.json` داخل `.gitignore`.

## الخطوة ٦ — أول نشر تجريبي
```
cd marketing
node ig-poster.mjs post demo.mp4 "جربنا أول ريل 🎬 #صيدليات_سورية"
node ig-poster.mjs comments
```

## الجدولة الأسبوعية (بعد التصوير)
ضع مهمة بملف `marketing/outbox/mon-1.json`:
```json
{ "when": "2026-08-30T18:30", "video": "clips/reel1.mp4", "caption": "قدّاش فايدة راح تضيع بصيدليتك؟ …" }
```
ثم شغّل بالخلفية (أو Task Scheduler عند بدء التشغيل):
```
node ig-poster.mjs watch
```

## حدود يجب معرفتها
- الريل ≤ ٩٠ ثانية، MP4, AAC
- ٥٠ منشوراً / ٢٤ ساعة (أكثر من كافٍ)
- الإحصائيات الكاملة تحتاج ١٠٠٠ متابع (قبلها: عدد المشاهدات يظهر بالتطبيق)
- الرسائل الخاصة (DM) لا يمكن إدارتها عبر الـ API — تُدار من الجوال فقط
