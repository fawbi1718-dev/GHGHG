import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy' | null;
  lang: 'en' | 'ar';
}

export default function LegalModal({ isOpen, onClose, type, lang }: LegalModalProps) {
  const isArabic = lang === 'ar';

  if (!isOpen || !type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm font-sans" dir={isArabic ? 'rtl' : 'ltr'}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">
              {type === 'terms' 
                ? (isArabic ? 'شروط الخدمة' : 'Terms of Service')
                : (isArabic ? 'سياسة الخصوصية' : 'Privacy Policy')
              }
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-600 space-y-4">
            {type === 'terms' ? (
              <>
                <p className="font-semibold text-slate-800">
                  {isArabic ? 'آخر تحديث: أغسطس 2026' : 'Last Updated: August 2026'}
                </p>
                <div className="space-y-4">
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '1. الغرض من المنصة' : '1. Purpose of Platform'}</h3>
                    <p>{isArabic 
                      ? 'هذه المنصة مخصصة لإدارة الأعمال والمشتريات للصيدليات والمستودعات الطبية فقط. المنصة لا تقدم تشخيصاً طبياً، ولا توصيات علاجية، ولا نصائح طبية متخصصة.' 
                      : 'This platform is exclusively a business management and procurement tool for pharmacies and medical warehouses. It does not provide medical diagnosis, treatment recommendations, or professional medical advice.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '2. مسؤولية الحساب' : '2. Account Responsibility'}</h3>
                    <p>{isArabic 
                      ? 'أنت مسؤول عن الحفاظ على سرية بيانات الاعتماد الخاصة بك وجميع الأنشطة التي تحدث تحت حسابك. يجب عليك التأكد من أن جميع المعلومات المقدمة دقيقة.' 
                      : 'You are responsible for maintaining the confidentiality of your credentials and all activities that occur under your account. You must ensure all provided information is accurate.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '3. حالة الخدمة التجريبية (Beta)' : '3. Service Availability and Beta Status'}</h3>
                    <p>{isArabic 
                      ? 'المنصة حالياً في المرحلة التجريبية (Beta). قد تتغير الميزات، وقد تحدث انقطاعات مؤقتة. يتم توفير الخدمة "كما هي" دون ضمانات للتوافر المستمر.' 
                      : 'The platform is currently in beta. Features may change, and temporary interruptions may occur. The service is provided "as is" without guarantees of continuous availability.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '4. مسؤولية المخزون والمعاملات' : '4. Inventory and Transaction Responsibility'}</h3>
                    <p>{isArabic 
                      ? 'المنظمة مسؤولة مسؤولية كاملة عن دقة سجلات المخزون والمعاملات وعمليات B2B التي تتم عبر المنصة. نحن لا نتحمل أي مسؤولية عن أخطاء إدخال البيانات.' 
                      : 'The organization is solely responsible for the accuracy of inventory records, transactions, and B2B operations executed via the platform. We bear no liability for data entry errors.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '5. الملكية الفكرية' : '5. Intellectual Property'}</h3>
                    <p>{isArabic 
                      ? 'جميع حقوق الملكية الفكرية في المنصة مملوكة لنا. لا يُسمح لك بنسخ أو تعديل أو توزيع أي جزء من المنصة.' 
                      : 'All intellectual property rights in the platform are owned by us. You may not copy, modify, or distribute any part of the platform.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '6. إنهاء الحساب' : '6. Account Termination'}</h3>
                    <p>{isArabic 
                      ? 'نحتفظ بالحق في تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط أو استخدمت المنصة لأغراض غير قانونية.' 
                      : 'We reserve the right to suspend or terminate your account if you violate these terms or use the platform for unlawful purposes.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '7. حدود المسؤولية' : '7. Limitation of Liability'}</h3>
                    <p>{isArabic 
                      ? 'إلى أقصى حد يسمح به القانون، لن نكون مسؤولين عن أي أضرار غير مباشرة أو عرضية أو تبعية تنشأ عن استخدامك للمنصة.' 
                      : 'To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '8. تعديل الخدمة' : '8. Changes to the Service'}</h3>
                    <p>{isArabic 
                      ? 'نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطار المستخدمين بأي تغييرات جوهرية.' 
                      : 'We reserve the right to modify these terms at any time. Users will be notified of any material changes.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '9. التواصل' : '9. Contact Information'}</h3>
                    <p>{isArabic 
                      ? 'للاستفسارات، يرجى التواصل مع الدعم الفني عبر المنصة.' 
                      : 'For inquiries, please contact technical support via the platform.'}</p>
                  </section>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800">
                  {isArabic ? 'آخر تحديث: أغسطس 2026' : 'Last Updated: August 2026'}
                </p>
                <div className="space-y-4">
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '1. المعلومات التي نجمعها' : '1. Information We Collect'}</h3>
                    <p>{isArabic 
                      ? 'نحن نجمع معلومات الحساب (البريد الإلكتروني، الاسم)، معلومات المنظمة (الاسم، الموقع، رقم الهاتف)، بيانات المخزون والمعاملات، ومعلومات المصادقة.' 
                      : 'We collect account information (email, name), organization information (name, location, phone), inventory and transaction data, and authentication information.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '2. لماذا نجمع المعلومات' : '2. Why We Process Information'}</h3>
                    <p>{isArabic 
                      ? 'نقوم بمعالجة بياناتك لتوفير وتأمين وإدارة حسابك، وتسهيل عمليات B2B، وتحسين أداء المنصة.' 
                      : 'We process your data to provide, secure, and manage your account, facilitate B2B operations, and improve platform performance.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '3. تخزين البيانات والبنية التحتية' : '3. Data Storage and Infrastructure'}</h3>
                    <p>{isArabic 
                      ? 'يتم تخزين بياناتك بأمان باستخدام خدمات سحابية خارجية (Firebase و Supabase). يتم عزل بيانات كل منظمة ولا تتم مشاركتها مع أطراف ثالثة غير مصرح لها.' 
                      : 'Your data is stored securely using third-party cloud infrastructure (Firebase and Supabase). Organization data is isolated and not shared with unauthorized third parties.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '4. الاحتفاظ بالبيانات وحذفها' : '4. Data Retention and Deletion'}</h3>
                    <p>{isArabic 
                      ? 'نحتفظ ببياناتك طالما كان حسابك نشطاً. يمكنك طلب حذف الحساب والبيانات المرتبطة به في أي وقت عبر إعدادات النظام أو بالتواصل معنا.' 
                      : 'We retain your data as long as your account is active. You may request account and data deletion at any time via system settings or by contacting us.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '5. حقوق المستخدم' : '5. User Rights'}</h3>
                    <p>{isArabic 
                      ? 'لديك الحق في الوصول إلى بياناتك، تصحيحها، أو طلب مسحها وفقاً للقوانين المعمول بها.' 
                      : 'You have the right to access, correct, or request erasure of your personal data in accordance with applicable laws.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '6. ممارسات الأمان' : '6. Security Practices'}</h3>
                    <p>{isArabic 
                      ? 'نحن نستخدم إجراءات أمنية قياسية لحماية بياناتك. ومع ذلك، لا يوجد نظام إلكتروني آمن بنسبة 100٪، ولا يمكننا ضمان الأمان المطلق.' 
                      : 'We employ industry-standard security measures to protect your data. However, no electronic system is 100% secure, and we cannot guarantee absolute security.'}</p>
                  </section>
                  <section>
                    <h3 className="font-bold text-slate-900 mb-1">{isArabic ? '7. التواصل للطلبات' : '7. Contact for Privacy Requests'}</h3>
                    <p>{isArabic 
                      ? 'لطلبات الخصوصية وحذف البيانات، يرجى التواصل معنا عبر الدعم الفني.' 
                      : 'For privacy requests and data deletion, please contact us via technical support.'}</p>
                  </section>
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              {isArabic ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
