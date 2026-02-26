import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  Plus, 
  X, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Type, 
  DollarSign, 
  Link as LinkIcon, 
  Video, 
  Settings,
  Layers,
  Layout,
  Info
} from 'lucide-react';
import LazyImage from '../components/LazyImage';
import { 
  fetchProductById, 
  updateProduct, 
  createProduct, 
  saveProductOptions 
} from '../services/api';
import { calculateInclusivePrice } from '../utils/shipping';
import { localProductService } from '../services/localProductService';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';

interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

interface ProductVariant {
  id?: string;
  combination: Record<string, string>;
  price: number;
  stock: number;
  image?: string;
}

interface ProductEditorProps {
  productId?: string | number | null;
  storeSettings?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

const ProductEditor: React.FC<ProductEditorProps> = ({ productId, storeSettings, onClose, onSuccess }) => {
  const isEdit = !!productId;
  const showToast = useToastStore((state) => state.showToast);
  const token = useAuthStore((state) => state.token);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState<any>({
    name: '',
    chineseName: '',
    price: 0,
    basePriceIQD: '',
    description: '',
    image: '',
    isFeatured: false,
    isActive: true,
    status: 'PUBLISHED',
    purchaseUrl: '',
    videoUrl: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    domesticShippingFee: 0,
    specs: {},
    images: [],
    detailImages: [],
    deliveryTime: ''
  });

  const [options, setOptions] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const loadProduct = useCallback(async () => {
    console.log('Loading product with ID:', productId);
    if (!productId) {
      console.error('No ID provided for product editing');
      return;
    }

    try {
      setLoading(true);
      
      let product;
      if (String(productId).startsWith('local-')) {
        product = localProductService.getDraftById(String(productId));
      } else {
        product = await fetchProductById(productId);
      }
      
      console.log('Loaded product data:', product);
      
      if (!product || product.error) {
        throw new Error(product?.error || 'Product not found');
      }

      const safeParse = (val: any, fallback: any) => {
        if (!val) return fallback;
        if (typeof val === 'object') return val;
        try {
          return JSON.parse(val);
        } catch (e) {
          console.error('Failed to parse value:', val, e);
          return fallback;
        }
      };

      setFormData({
        ...product,
        specs: safeParse(product.specs, {}),
        images: Array.isArray(product.images) ? product.images.filter((img: any) => img.type === 'GALLERY') : [],
        detailImages: Array.isArray(product.images) ? product.images.filter((img: any) => img.type === 'DETAIL') : []
      });

      if (product.options) {
        setOptions(product.options.map((opt: any) => ({
          ...opt,
          values: safeParse(opt.values, [])
        })));
      }

      if (product.variants) {
        setVariants(product.variants.map((v: any) => ({
          ...v,
          combination: safeParse(v.combination, {})
        })));
      }
    } catch (error: any) {
      console.error('Failed to load product:', error);
      const errorMessage = error.message || 'فشل تحميل بيانات المنتج';
      showToast(errorMessage, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [productId, showToast, onClose]);

  useEffect(() => {
    if (isEdit) {
      loadProduct();
    }
  }, [isEdit, loadProduct]);

  // Immediately update price when weight, size, or RMB price changes
  useEffect(() => {
    if (formData.basePriceIQD && storeSettings) {
      const newPrice = calculateInclusivePrice(
        formData.price,
        formData.domesticShippingFee || 0,
        formData.basePriceIQD
      );

      if (newPrice !== formData.price) {
        setFormData((prev: any) => ({
          ...prev,
          price: newPrice
        }));
      }
    }
  }, [
    formData.basePriceIQD, 
    formData.domesticShippingFee,
    storeSettings
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData((prev: any) => ({
      ...prev,
      [name]: (name === 'weight' || name === 'length' || name === 'width' || name === 'height' || name === 'domesticShippingFee') && value !== '' 
        ? parseFloat(value) 
        : val
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'gallery' | 'detail') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      
      if (type === 'main') {
        setFormData((prev: any) => ({ ...prev, image: base64 }));
      } else if (type === 'gallery') {
        setFormData((prev: any) => ({ ...prev, images: [...prev.images, { url: base64, type: 'GALLERY', order: prev.images.length }] }));
      } else if (type === 'detail') {
        setFormData((prev: any) => ({ ...prev, detailImages: [...prev.detailImages, { url: base64, type: 'DETAIL', order: prev.detailImages.length }] }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!formData.name) {
      showToast('يرجى إدخال اسم المنتج', 'error');
      return;
    }

    try {
      setSaving(true);
      
      const productData = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        // isPriceCombined removed
        basePriceIQD: formData.basePriceIQD ? parseFloat(formData.basePriceIQD) : null,
        reviewsCountShown: parseInt(formData.reviewsCountShown) || 0,
        images: [
          ...formData.images.map((img: any, idx: number) => ({ ...img, type: 'GALLERY', order: idx })),
          ...formData.detailImages.map((img: any, idx: number) => ({ ...img, type: 'DETAIL', order: idx }))
        ],
        options,
        variants,
        updatedAt: new Date().toISOString()
      };

      if (formData.status === 'DRAFT') {
        // Save locally only
        localProductService.saveDraft({
          ...productData,
          id: isEdit && String(productId).startsWith('local-') ? String(productId) : undefined,
          isLocal: true
        });
        showToast('تم حفظ المسودة محلياً', 'success');
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      // If it's being published (status === 'PUBLISHED')
      let result;
      if (isEdit && !String(productId).startsWith('local-')) {
        result = await updateProduct(productId!, productData);
      } else {
        // Create new product on server (could be from a local draft or completely new)
        result = await createProduct(productData);
        // If it was a local draft, delete it after successful publish
        if (isEdit && String(productId).startsWith('local-')) {
          localProductService.deleteDraft(String(productId));
        }
      }

      const newProductId = result.id;
      if (options.length > 0 || variants.length > 0) {
        await saveProductOptions(newProductId, options, variants, token);
      }

      showToast(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Save product error:', error);
      showToast('فشل حفظ بيانات المنتج', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl flex flex-col items-center gap-6 shadow-2xl">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold">جاري تحميل بيانات المنتج...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'basic', name: 'المعلومات الأساسية', icon: Info },
    { id: 'media', name: 'الصور والوسائط', icon: ImageIcon },
    { id: 'options', name: 'الخيارات والأنواع', icon: Layers },
    { id: 'details', name: 'التفاصيل والمواصفات', icon: Settings }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={24} />
            </button>
            <div className="truncate">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white truncate">
                {isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h1>
              <p className="text-slate-500 text-xs md:text-sm truncate">{isEdit ? `#${productId} - ${formData.name}` : 'قم بتعبئة بيانات المنتج الجديد'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
            >
              إلغاء
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save size={20} />
              )}
              حفظ المنتج
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <tab.icon size={18} />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content Sections */}
          <div className="grid grid-cols-1 gap-6">
            {activeTab === 'basic' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Type size={16} className="text-primary" />
                    الاسم (بالعربية)
                  </label>
                  <input 
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 outline-none transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Type size={16} className="text-primary" />
                    الاسم (بالصينية)
                  </label>
                  <input 
                    type="text"
                    name="chineseName"
                    value={formData.chineseName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <DollarSign size={16} className="text-primary" />
                    السعر (IQD)
                  </label>
                  <input 
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 outline-none transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <DollarSign size={16} className="text-primary" />
                    السعر (IQD)
                  </label>
                  <input 
                    type="number"
                    name="basePriceIQD"
                    value={formData.basePriceIQD}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 outline-none transition-all font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">سعر التوصيل داخل الصين (د.ع)</label>
                  <input 
                    type="number"
                    name="domesticShippingFee"
                    value={formData.domesticShippingFee}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-3 outline-none transition-all font-bold"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">هذا السعر يضاف مباشرة إلى تكلفة الشحن النهائية لكل قطعة من هذا المنتج.</p>
                </div>

                <div className="pt-4 space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">وقت التوصيل</label>
                  <input 
                    type="text"
                    name="deliveryTime"
                    value={formData.deliveryTime || ''}
                    onChange={handleInputChange}
                    placeholder="مثال: 10-15 يوم"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-3 outline-none transition-all font-bold"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">اكتب المدة المتوقعة للتوصيل (اختياري).</p>
                </div>

                <p className="mt-4 text-xs text-slate-400 font-medium">
                  * تستخدم هذه القيم لحساب تكاليف الشحن الدولي تلقائياً. إذا تركت فارغة، سيحاول النظام تقديرها باستخدام الذكاء الاصطناعي.
                </p>
              </div>

              <div className="flex flex-wrap gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.isFeatured ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary/50'}`}>
                    {formData.isFeatured && <Plus size={16} className="text-white" />}
                  </div>
                  <input 
                    type="checkbox"
                    name="isFeatured"
                    checked={formData.isFeatured}
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <span className="text-sm font-bold">منتج مميز</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.isActive ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-emerald-500/50'}`}>
                    {formData.isActive && <Plus size={16} className="text-white" />}
                  </div>
                  <input 
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <span className="text-sm font-bold">نشط</span>
                </label>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 block mb-4">حالة المنتج</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData((prev: any) => ({ ...prev, status: 'PUBLISHED' }))}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all border-2 ${
                      formData.status === 'PUBLISHED'
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    منشور (على السيرفر)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev: any) => ({ ...prev, status: 'DRAFT' }))}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all border-2 ${
                      formData.status === 'DRAFT'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    مسودة (على الجهاز فقط)
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500 font-medium">
                  {formData.status === 'DRAFT' 
                    ? 'سيتم حفظ هذا المنتج محلياً على متصفحك فقط ولن يظهر للعملاء حتى تقوم بنشره.'
                    : 'سيتم حفظ هذا المنتج في قاعدة البيانات المركزية وسيكون متاحاً للعملاء.'}
                </p>
              </div>
            </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              <h3 className="text-lg font-black flex items-center gap-2">
                <ImageIcon size={20} className="text-primary" />
                الصورة الرئيسية
              </h3>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-48 h-48 rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative group shrink-0">
                  {formData.image ? (
                    <>
                      <img 
                        src={formData.image} 
                        className="w-full h-full object-cover" 
                        alt="Main" 
                      />
                      <button 
                        onClick={() => setFormData((prev: any) => ({ ...prev, image: '' }))}
                        className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Upload size={32} />
                      <span className="text-[10px] font-bold">رفع صورة</span>
                    </div>
                  )}
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'main')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-slate-700 dark:text-slate-300">الصورة الرئيسية للمنتج</p>
                  <p className="text-sm text-slate-500">هذه هي الصورة التي ستظهر في قوائم المنتجات والصفحة الرئيسية.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Layers size={20} className="text-primary" />
                معرض الصور
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {formData.images.map((img: any, idx: number) => (
                  <div key={idx} className="aspect-square rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 overflow-hidden relative group">
                    <LazyImage 
                      src={img.url} 
                      className="w-full h-full object-cover" 
                      alt={`Gallery ${idx}`} 
                      isThumbnail={true}
                    />
                    <button 
                      onClick={() => setFormData((prev: any) => ({ 
                        ...prev, 
                        images: prev.images.filter((_: any, i: number) => i !== idx) 
                      }))}
                      className="absolute top-1 right-1 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <div className="aspect-square rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center relative hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <Plus size={24} />
                    <span className="text-[10px] font-bold">إضافة</span>
                  </div>
                  <input 
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e, 'gallery')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'options' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black">خيارات المنتج</h3>
                  <p className="text-sm text-slate-500">إضافة خيارات مثل اللون، المقاس، الخ.</p>
                </div>
                <button 
                    onClick={() => setOptions((prev: ProductOption[]) => [...prev, { id: Math.random().toString(36).substr(2, 9), name: '', values: [] }])}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-all w-full md:w-auto justify-center"
                  >
                  <Plus size={18} />
                  إضافة خيار
                </button>
              </div>

              <div className="space-y-4">
                {options.map((opt, optIdx) => (
                  <div key={opt.id} className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="flex items-center gap-4">
                      <input 
                        type="text"
                        value={opt.name}
                        onChange={(e) => {
                          const newOptions = [...options];
                          newOptions[optIdx].name = e.target.value;
                          setOptions(newOptions);
                        }}
                        placeholder="اسم الخيار (مثلاً: اللون)"
                        className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 outline-none font-bold"
                      />
                      <button 
                        onClick={() => {
                          const optionToRemove = options[optIdx];
                          setOptions((prev: ProductOption[]) => prev.filter((_, i) => i !== optIdx));
                          
                          // Update variants by removing the option dimension
                          setVariants((prev: ProductVariant[]) => {
                            const processed: any[] = [];
                            const seen = new Set();
                            prev.forEach(v => {
                              const newComb = { ...v.combination };
                              delete newComb[optionToRemove.name];
                              const key = JSON.stringify(newComb);
                              if (!seen.has(key)) {
                                seen.add(key);
                                processed.push({ ...v, combination: newComb });
                              }
                            });
                            return processed;
                          });
                        }}
                        className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((val, valIdx) => (
                        <div key={valIdx} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 group">
                          <span className="text-sm font-bold">{val}</span>
                          <button 
                            onClick={() => {
                              const newOptions = [...options];
                              const removedValue = opt.values[valIdx];
                              newOptions[optIdx].values = opt.values.filter((_, i) => i !== valIdx);
                              setOptions(newOptions);
  
                              // Automatically update variants
                              setVariants((prev: ProductVariant[]) => {
                                // If this was the last value, remove the option dimension
                                if (newOptions[optIdx].values.length === 0) {
                                  const processed: any[] = [];
                                  const seen = new Set();
                                  prev.forEach(v => {
                                    const newComb = { ...v.combination };
                                    delete newComb[opt.name];
                                    const key = JSON.stringify(newComb);
                                    if (!seen.has(key)) {
                                      seen.add(key);
                                      processed.push({ ...v, combination: newComb });
                                    }
                                  });
                                  return processed;
                                } else {
                                  // Just filter out variants with this value
                                  return prev.filter(v => v.combination[opt.name] !== removedValue);
                                }
                              });
                            }}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <input 
                        type="text"
                        placeholder="أضف قيمة..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) {
                              const newOptions = [...options];
                              newOptions[optIdx].values = [...opt.values, val];
                              setOptions(newOptions);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-primary transition-all w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {options.length > 0 && (
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black">الأنواع المولدة</h3>
                    <button 
                      onClick={() => {
                        const generateCombinations = (opts: ProductOption[]) => {
                          const results: any[] = [{}];
                          opts.forEach(opt => {
                            const newResults: any[] = [];
                            results.forEach(res => {
                              opt.values.forEach(val => {
                                newResults.push({ ...res, [opt.name]: val });
                              });
                            });
                            results.splice(0, results.length, ...newResults);
                          });
                          return results;
                        };

                        const combinations = generateCombinations(options);
                        setVariants(combinations.map(comb => ({
                          combination: comb,
                          price: formData.price,
                          stock: 100
                        })));
                      }}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-500/20 transition-all"
                    >
                      توليد الأنواع
                    </button>
                  </div>

                  <div className="overflow-x-auto -mx-6 md:mx-0">
                    <table className="w-full text-right border-collapse min-w-[600px]">
                      <thead>
                        <tr className="text-slate-500 text-[10px] font-black uppercase border-b border-slate-100 dark:border-slate-800">
                          <th className="px-6 py-3">النوع</th>
                          <th className="px-6 py-3">السعر</th>
                          <th className="px-6 py-3">المخزون</th>
                          <th className="px-6 py-3">الصورة</th>
                          <th className="px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {variants.slice(0, 5).map((v, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(v.combination).map(([key, val], i) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold">
                                    {key}: {val}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="number"
                                value={v.price}
                                onChange={(e) => {
                                  const newVariants = [...variants];
                                  newVariants[idx].price = parseFloat(e.target.value);
                                  setVariants(newVariants);
                                }}
                                className="w-24 bg-transparent border-none outline-none font-bold text-sm"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="number"
                                value={v.stock}
                                onChange={(e) => {
                                  const newVariants = [...variants];
                                  newVariants[idx].stock = parseInt(e.target.value);
                                  setVariants(newVariants);
                                }}
                                className="w-20 bg-transparent border-none outline-none font-bold text-sm"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative group/vimg">
                                {v.image ? (
                                  <LazyImage 
                                    src={v.image} 
                                    className="w-full h-full object-cover" 
                                    alt="" 
                                    isThumbnail={true}
                                  />
                                ) : (
                                  <ImageIcon size={16} className="text-slate-400" />
                                )}
                                <input 
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        const newVariants = [...variants];
                                        newVariants[idx].image = reader.result as string;
                                        setVariants(newVariants);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => setVariants((prev: ProductVariant[]) => prev.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:scale-110 transition-transform"
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Physical Dimensions Section */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black">الأبعاد والوزن (للشحن الدولي)</h3>
                  <p className="text-xs text-slate-500">تستخدم هذه البيانات لحساب تكاليف الشحن الدولي تلقائياً</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 flex items-center gap-2">الوزن (كجم)</label>
                  <input 
                    type="number"
                    name="weight"
                    step="0.01"
                    value={formData.weight || ''}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 flex items-center gap-2">الطول (سم)</label>
                  <input 
                    type="number"
                    name="length"
                    value={formData.length || ''}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 flex items-center gap-2">العرض (سم)</label>
                  <input 
                    type="number"
                    name="width"
                    value={formData.width || ''}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 flex items-center gap-2">الارتفاع (سم)</label>
                  <input 
                    type="number"
                    name="height"
                    value={formData.height || ''}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 outline-none font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <LinkIcon size={16} className="text-primary" />
                    رابط الشراء
                  </label>
                  <input 
                    type="url"
                    name="purchaseUrl"
                    value={formData.purchaseUrl}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Video size={16} className="text-primary" />
                    رابط الفيديو
                  </label>
                  <input 
                    type="url"
                    name="videoUrl"
                    value={formData.videoUrl}
                    onChange={handleInputChange}
                    placeholder="YouTube Link"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary/20 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Layout size={20} className="text-primary" />
                    صور التفاصيل
                  </h3>
                  <div className="relative">
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                      <Plus size={18} />
                      إضافة صور
                    </button>
                    <input 
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(e, 'detail')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {formData.detailImages.map((img: any, idx: number) => (
                    <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                      <LazyImage 
                        src={img.url} 
                        className="w-full object-cover" 
                        alt="" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => setFormData((prev: any) => ({ 
                            ...prev, 
                            detailImages: prev.detailImages.filter((_: any, i: number) => i !== idx) 
                          }))}
                          className="p-3 bg-rose-500 text-white rounded-xl shadow-lg hover:scale-110 transition-transform"
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductEditor;
