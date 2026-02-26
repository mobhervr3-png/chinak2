import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    lng: 'ar',
    fallbackLng: 'ar',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      ar: {
        translation: {
          common: {
            baghdad: 'بغداد، العراق',
            welcome: 'مرحباً، {{name}}',
            guest: 'ضيف',
            search_placeholder: 'ابحث عن المنتجات، الماركات...',
            trending: 'شائع:',
            retry: 'إعادة المحاولة',
            shop_now: 'تسوق الآن',
            discover_offers: 'اكتشف العروض',
            flash_sales: 'عروض فلاش',
            view_all: 'عرض الكل',
            featured_products: 'منتجات مميزة',
            best_sellers: 'الأكثر مبيعاً',
            error_loading: 'حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.',
            iqd: 'د.ع',
            free_delivery: 'توصيل مجاني',
            special_offer: 'عرض خاص',
            baghdad_orders_offer: 'لكل الطلبات إلى بغداد هذا الأسبوع',
            discount_50: 'خصم 50%',
            latest_phones: 'على أحدث الهواتف الذكية',
            add: 'إضافة',
            edit: 'تعديل',
            update: 'تحديث',
            cancel: 'إلغاء',
            save: 'حفظ',
            delete: 'حذف',
            close: 'إغلاق',
          },
          my_orders: {
            title: 'طلباتي',
            current: 'الجارية',
            completed: 'المكتملة',
            search_placeholder: 'ابحث برقم الطلب أو اسم المنتج...',
            order_no: 'رقم الطلب',
            order_date: 'تاريخ الطلب',
            track: 'تتبع الطلب',
            reorder: 'إعادة طلب',
            cancel: 'إلغاء',
            empty: 'لا توجد طلبات لعرضها',
            cancelling: 'جاري الإلغاء...',
            reordering: 'جاري...',
          },
          status: {
            pending: 'قيد المراجعة',
            awaiting_payment: 'بانتظار الدفع',
            paid: 'تم الدفع',
            preparing: 'قيد التجهيز',
            shipped: 'تم الشحن',
            arrived_iraq: 'وصل إلى العراق',
            delivered: 'تم التسليم بنجاح',
            cancelled: 'ملغي',
          },
          tracking: {
            title: 'تتبع الشحنة',
            tracking_no: 'رقم التتبع',
            expected_arrival: 'الوصول المتوقع',
            route: 'مسار الشحنة',
            order_contents: 'محتويات الطلب',
            subtotal: 'المجموع الفرعي',
            shipping_fee: 'رسوم التوصيل',
            total: 'الإجمالي',
            address: 'عنوان التوصيل',
            payment_method: 'طريقة الدفع',
            help: 'تحتاج مساعدة؟',
            help_text: 'إذا كان لديك أي استفسار حول طلبك، يمكنك التواصل مع فريق الدعم الفني عبر المحادثة المباشرة أو الاتصال بنا.',
            copy_tracking: 'نسخ رقم التتبع',
            contact_support: 'تواصل مع الدعم',
            cancelled_text: 'تم إلغاء هذا الطلب بناءً على طلبك أو لعدم توفر المنتجات',
            current_location: 'موقع الشحنة الحالي',
            expand_map: 'توسيع الخريطة',
            no_address: 'معلومات العنوان غير متوفرة',
            sim_update: 'تحديث حالة الشحن (محاكاة)',
            updating: 'جاري تحديث الحالة...',
            copied: 'تم نسخ رقم التتبع',
            order_not_found: 'الطلب غير موجود',
            back_to_orders: 'العودة لطلباتي',
            status_updated_live: 'تم تحديث حالة الطلب الآن',
            order_id_with_qty: 'طلب رقم #{{id}} ({{count}} منتجات)',
            qty: 'الكمية',
            air_shipping: 'شحن جوي',
            sea_shipping: 'شحن بحري',
            mansour_baghdad: 'المنصور، بغداد',
            status_desc_pending: 'استلمنا طلبك وجاري مراجعته وتأكيده من قبل فريق العمل.',
            status_desc_awaiting_payment: 'بانتظار إتمام عملية الدفع للمباشرة بتجهيز طلبك.',
            status_desc_paid: 'تم استلام الدفعة بنجاح، جاري الآن تجهيز طلبك.',
            status_desc_preparing: 'تم فحص المنتجات وتغليفها وهي جاهزة للتسليم لشركة الشحن.',
            status_desc_shipped: 'تم شحن طلبك من المصدر وهو في طريقه إلى مستودعاتنا في العراق.',
            status_desc_arrived_iraq: 'وصلت الشحنة إلى مستودعاتنا في العراق وسيتم تسليمها للمندوب قريباً.',
            status_desc_delivered: 'تم تسليم الشحنة بنجاح. شكراً لتسوقك معنا، نتمنى رؤيتك مجدداً!',
            out_for_delivery: 'مع المندوب للتوصيل',
            bldg: 'مبنى',
            floor: 'طابق',
            zain_cash: 'زين كاش',
            super_key: 'سوبر كي',
            online_payment: 'دفع إلكتروني',
            cancel_order: 'إلغاء الطلب',
            pay_now: 'ادفع الآن',
            international_shipping: 'تكاليف شحن دولي',
          },
          dashboard: {
            title: 'لوحة التحكم',
            overview: {
              title: 'نظرة عامة',
              total_sales: 'إجمالي المبيعات',
              avg_order: 'متوسط الطلب',
              completed_orders: 'الطلبات المكتملة',
              pending_orders: 'قيد الانتظار',
              users_count: 'المستخدمين',
              sales_analysis: 'تحليل المبيعات الشهرية',
              last_12_months: 'آخر 12 شهر',
              last_30_days: 'آخر 30 يوم',
              sales_label: 'المبيعات',
              product_performance: 'أداء المنتجات',
              by_orders: 'حسب عدد الطلبات',
              best_sellers: 'الأكثر مبيعاً',
              latest_orders: 'آخر الطلبات',
              view_all_orders: 'عرض جميع الطلبات',
              table: {
                order_no: 'رقم الطلب',
                customer: 'العميل',
                date: 'التاريخ',
                amount: 'المبلغ',
                status: 'الحالة'
              },
              orders_suffix: 'طلب'
            },
            products: {
              title: 'المنتجات',
              new_product: 'منتج جديد',
              bulk_actions: {
                selected_count: '{{count}} منتجات محددة',
                activate: 'تنشيط',
                deactivate: 'إيقاف',
                delete: 'حذف'
              },
              badges: {
                featured: 'مميز',
                inactive: 'غير نشط',
                draft: 'مسودة'
              },
              tooltips: {
                activate: 'تنشيط',
                deactivate: 'إيقاف التنشيط',
                feature: 'تمييز',
                unfeature: 'إلغاء التمييز'
              },
              form: {
                name: 'اسم المنتج',
                name_placeholder: 'مثلاً: آيفون 15 برو',
                price: 'السعر (د.ع)',
                image: 'رابط الصورة',
                description: 'الوصف',
                description_placeholder: 'أدخل وصف المنتج هنا...',
                active: 'نشط',
                featured: 'مميز'
              }
            },
            orders: {
              title: 'الطلبات',
              details: {
                title: 'تفاصيل الطلب #{{id}}',
                print_invoice: 'طباعة الفاتورة',
                customer_info: 'بيانات العميل',
                no_phone: 'لا يوجد رقم هاتف',
                shipping_address: 'عنوان الشحن',
                floor: 'الطابق: {{count}}',
                ordered_items: 'المنتجات المطلوبة',
                items_count: 'عدد المنتجات',
                grand_total: 'الإجمالي الكلي',
                internal_notes: 'ملاحظات داخلية (للمشرفين فقط)',
                notes_placeholder: 'أضف ملاحظات حول هذا الطلب...',
                close_details: 'إغلاق التفاصيل'
              },
              cancel: 'إلغاء الطلب',
              cancel_confirm: 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟',
              cancel_success: 'تم إلغاء الطلب بنجاح',
              cancel_error: 'فشل في إلغاء الطلب. يرجى المحاولة لاحقاً.'
            },
            users: {
              title: 'المستخدمين',
              table: {
                user: 'المستخدم',
                email: 'رقم الهاتف',
                role: 'الدور',
                orders: 'الطلبات',
                total_spend: 'إجمالي الإنفاق',
                join_date: 'تاريخ الانضمام',
                actions: 'الإجراءات',
                orders_label: 'طلبات',
                view_profile: 'عرض الملف الشخصي',
                manage_permissions: 'إدارة الصلاحيات'
              },
              details: {
                title: 'ملف العميل: {{name}}',
                total_orders: 'إجمالي الطلبات',
                total_spend: 'إجمالي الإنفاق',
                join_date: 'تاريخ الانضمام',
                order_history: 'تاريخ الطلبات',
                no_orders: 'لا توجد طلبات سابقة لهذا العميل',
                items: 'منتجات',
                close_profile: 'إغلاق الملف الشخصي',
                table: {
                  order_no: 'رقم الطلب',
                  date: 'التاريخ',
                  status: 'الحالة',
                  total: 'الإجمالي'
                }
              }
            },
            reviews: 'التقييمات',
            coupons: {
              title: 'الكوبونات',
              new_coupon: 'إنشاء كوبون جديد',
              edit_coupon: 'تعديل الكوبون',
              form: {
                code: 'كود الكوبون',
                code_placeholder: 'مثلاً: SUMMER2024',
                discount_type: 'نوع الخصم',
                discount_value: 'قيمة الخصم',
                percentage: 'نسبة مئوية (%)',
                fixed: 'مبلغ ثابت (د.ع)',
                min_order: 'الحد الأدنى للطلب',
                end_date: 'تاريخ الانتهاء',
                max_usage: 'أقصى عدد استخدام',
                no_limit: 'لا يوجد حد',
                max_discount: 'أقصى قيمة للخصم (د.ع)',
                active: 'الكوبون نشط حالياً'
              }
            },
            banners: {
              title: 'البانرات',
              new_banner: 'بانر جديد',
              edit_banner: 'تعديل البانر',
              form: {
                title: 'عنوان البانر',
                subtitle: 'العنوان الفرعي',
                image: 'رابط الصورة',
                link: 'رابط التوجيه',
                order: 'ترتيب العرض',
                active: 'نشط'
              },
              table: {
                image: 'الصورة',
                info: 'معلومات البانر',
                order: 'الترتيب',
                status: 'الحالة',
                actions: 'الإجراءات'
              }
            },
            settings: 'الإعدادات',
            search: 'بحث...',
            export: 'تصدير CSV',
            logout: 'تسجيل الخروج',
            tabs: {
              overview: 'نظرة عامة',
              products: 'المنتجات',
              orders: 'الطلبات',
              users: 'المستخدمين',
              reviews: 'التقييمات',
              coupons: 'الكوبونات',
              banners: 'البانرات',
              reports: 'التقارير',
              activity: 'النشاط',
              settings: 'الإعدادات',
              product: 'منتج',
              coupon: 'كوبون',
              banner: 'بانر'
            },
            actions: {
              add: 'إضافة',
              add_short: 'إضافة'
            },
            notifications: {
              title: 'الإشعارات',
              mark_all_read: 'تحديد الكل كمقروء',
              empty: 'لا توجد إشعارات جديدة'
            },
            search_placeholders: {
              products: 'البحث في المنتجات...',
              orders: 'البحث في الطلبات...',
              reviews: 'البحث في التقييمات...',
              coupons: 'البحث في الكوبونات...',
              users: 'البحث في المستخدمين...'
            },
            filters: {
              all_statuses: 'جميع الحالات'
            },
            abandoned_carts: {
              title: 'سلال التسوق المتروكة (فرص بيع ضائعة)',
              subtitle: 'المستخدمون الذين لديهم منتجات في السلة ولم يكملوا الطلب',
              total_value: 'إجمالي القيمة القابلة للاسترداد',
              empty: 'لا توجد سلال متروكة حالياً',
              items: 'منتجات',
              view_customer: 'عرض ملف العميل',
              table: {
                customer: 'العميل',
                items_count: 'عدد المنتجات',
                value: 'القيمة',
                last_activity: 'آخر نشاط',
                actions: 'الإجراءات'
              }
            },
            settings_form: {
              title: 'إعدادات المتجر',
              store_name: 'اسم المتجر',
              currency: 'العملة',
              contact_email: 'البريد الإلكتروني للتواصل',
              phone: 'رقم الهاتف',
              footer_text: 'نص التذييل (Footer)',
              social_links: 'روابط التواصل الاجتماعي',
              save_changes: 'حفظ التغييرات',
              link_placeholder: 'رابط {{platform}}'
            },
            reports: {
              daily_sales: 'مبيعات اليوم',
              weekly_sales: 'مبيعات الأسبوع',
              monthly_sales: 'مبيعات الشهر',
              orders_today: '{{count}} طلب اليوم',
              orders_this_week: '{{count}} طلب هذا الأسبوع',
              orders_this_month: '{{count}} طلب هذا الشهر',
              top_products: 'المنتجات الأكثر ربحية',
              sales: 'مبيعات',
              auto_reports: 'التقارير التلقائية',
              auto_reports_desc: 'سيتم إرسال ملخص أسبوعي إلى حسابك المسجل.',
              send_now: 'إرسال الآن (تجريبي)',
              change_settings: 'تغيير الإعدادات'
            },
            activity_logs: {
              title: 'سجل نشاطات المسؤولين',
              total_records: 'إجمالي السجلات: {{count}}',
              empty: 'لا توجد سجلات نشاط حالياً',
              system: 'نظام',
              table: {
                admin: 'المسؤول',
                activity: 'النشاط',
                target: 'الهدف',
                details: 'التفاصيل',
                date: 'التاريخ'
              }
            },
            permissions: {
              title: 'إدارة صلاحيات المشرف',
              subtitle: 'تعديل صلاحيات الوصول لـ: {{name}}',
              save_changes: 'حفظ التغييرات',
              labels: {
                full_access: 'الوصول الكامل (Super Admin)',
                manage_products: 'إدارة المنتجات',
                manage_orders: 'إدارة الطلبات',
                manage_users: 'إدارة المستخدمين والصلاحيات',
                manage_reviews: 'إدارة التقييمات',
                manage_coupons: 'إدارة الكوبونات',
                manage_content: 'إدارة المحتوى والبنرات',
                manage_settings: 'إدارة إعدادات المتجر',
                view_reports: 'عرض التقارير والتحليلات'
              }
            }
          },
          stats: {
            total_sales: 'إجمالي المبيعات',
            total_orders: 'إجمالي الطلبات',
            total_products: 'إجمالي المنتجات',
            total_users: 'إجمالي المستخدمين',
          },
          profile: {
            title: 'الملف الشخصي',
            full_name: 'الاسم الكامل',
            phone: 'رقم الهاتف',
            save: 'حفظ',
            saving: 'جاري الحفظ...',
            cancel: 'إلغاء',
            new_user: 'مستخدم جديد',
            edit_profile: 'تعديل الملف',
            orders: 'الطلبات',
            coupons: 'القسائم',
            total_orders: 'إجمالي الطلبات',
            account_settings: 'إعدادات الحساب',
            address_book: 'دفتر العناوين',
            saved_addresses: 'لديك {{count}} مواقع توصيل محفوظة',
            payment_methods: 'طرق الدفع',
            manage_cards: 'إدارة البطاقات والمحافظ',
            favorites: 'المفضلة',
            interested_products: 'المنتجات التي تهتم بها',
            app_settings: 'إعدادات التطبيق',
            notifications: 'الإشعارات',
            notifications_desc: 'تنبيهات العروض والطلبات',
            advanced_settings: 'إعدادات متقدمة',
            advanced_settings_desc: 'اللغة، العملة، الخصوصية والمزيد',
            admin_dashboard: 'لوحة تحكم الأدمن',
            admin_desc: 'إدارة المتجر والطلبات',
            logout: 'تسجيل الخروج',
            logout_desc: 'نأمل رؤيتك مجدداً قريباً',
            update_success: 'تم تحديث الملف الشخصي بنجاح',
            update_failed: 'فشل تحديث الملف الشخصي',
            admin_section: 'الإدارة',
            admin_dashboard_title: 'لوحة التحكم',
            admin_dashboard_desc: 'إدارة المنتجات والطلبات والمستخدمين',
            support_section: 'الدعم والمعلومات',
            help_center: 'مركز المساعدة',
            faq: 'الأسئلة الشائعة',
            about_app: 'عن التطبيق',
            version: 'الإصدار',
          },
          nav: {
            home: 'الرئيسية',
            categories: 'الفئات',
            favorites: 'المفضلة',
            profile: 'حسابي',
          }
        }
      }
    }
  });

export default i18n;
