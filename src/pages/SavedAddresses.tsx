import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowRight, 
  Plus, 
  MapPinOff, 
  Home, 
  Briefcase, 
  MapPin, 
  Trash2, 
  Edit2, 
  MapPinPlus 
} from 'lucide-react';
import { fetchAddresses, deleteAddress, updateAddress } from '../services/api';
import { useCheckoutStore } from '../store/useCheckoutStore';
import { useToastStore } from '../store/useToastStore';
import Skeleton from '../components/Skeleton';

const SavedAddresses: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSelectMode = location.state?.fromCheckout;
  const setSelectedAddressId = useCheckoutStore((state) => state.setSelectedAddressId);
  const showToast = useToastStore((state) => state.showToast);
  
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAddresses();
      setAddresses(data);
    } catch (err: any) {
      console.error(err.message || 'فشل في تحميل العناوين');
      showToast('فشل في تحميل العناوين. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleDelete = async (e: React.MouseEvent, id: number | string) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذا العنوان؟')) return;
    
    try {
      await deleteAddress(id);
      setAddresses(addresses.filter(addr => addr.id !== id));
      showToast('تم حذف العنوان بنجاح', 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل حذف العنوان', 'error');
    }
  };

  const handleSetDefault = async (e: React.MouseEvent, id: number | string) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await updateAddress(id, { isDefault: true });
      await loadAddresses();
      showToast('تم تعيين العنوان كافتراضي', 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل تعيين العنوان كافتراضي', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (addr: any) => {
    if (isSelectMode) {
      setSelectedAddressId(addr.id);
      navigate(-1);
    }
  };

  if (loading) return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display antialiased" dir="rtl">
      <header className="sticky top-0 z-50 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-4 h-16 flex items-center justify-between">
        <Skeleton variant="circle" className="w-10 h-10" />
        <Skeleton variant="text" className="w-32 h-6" />
        <Skeleton variant="circle" className="w-10 h-10" />
      </header>
      <main className="p-4 space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <Skeleton key={i} className="w-full h-32 rounded-2xl" />
        ))}
      </main>
    </div>
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-text-primary-light dark:text-text-primary-dark antialiased pb-24 pb-safe" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark transition-colors duration-300 pt-safe">
        <div className="flex items-center justify-between p-4 h-16">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-text-primary-light dark:text-text-primary-dark"
          >
            <ArrowRight size={24} />
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em]">
            {isSelectMode ? 'اختر عنوان التوصيل' : 'العناوين المحفوظة'}
          </h1>
          <button 
            onClick={() => navigate('/addresses/add', { state: { from: location.pathname, fromCheckout: isSelectMode } })}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-primary"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full p-4 space-y-4">
        {addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
              <MapPinOff size={40} />
            </div>
            <div>
              <p className="text-lg font-bold">لا توجد عناوين محفوظة</p>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">قم بإضافة عنوان لتسهيل عملية الشراء</p>
            </div>
            <button 
              onClick={() => navigate('/addresses/add', { state: { from: location.pathname, fromCheckout: isSelectMode } })}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20"
            >
              إضافة عنوان جديد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addresses.map((addr) => (
              <div 
                key={addr.id}
                onClick={() => handleSelect(addr)}
                className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                  addr.isDefault 
                    ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                    : 'border-slate-100 dark:border-slate-800 bg-surface-light dark:bg-surface-dark'
                } hover:border-primary/50`}
              >
              {addr.isDefault && (
                <div className="absolute top-4 left-4">
                  <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-lg">الافتراضي</span>
                </div>
              )}
              
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  addr.isDefault ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {addr.type === 'المنزل' ? <Home size={20} /> : <Briefcase size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-base">{addr.type}</h3>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{addr.name}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-500 font-medium ltr mb-1" dir="ltr">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 text-green-600">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span dir="ltr">{addr.phone}</span>
                </div>
                <div className="flex items-start gap-2 text-text-secondary-light dark:text-text-secondary-dark">
                  <MapPin size={18} className="mt-0.5" />
                  <p className="leading-relaxed">{addr.street}, {addr.city}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                {!addr.isDefault && (
                  <button 
                    onClick={(e) => handleSetDefault(e, addr.id)}
                    className="ml-auto text-xs font-bold text-primary hover:underline transition-colors"
                  >
                    تعيين كافتراضي
                  </button>
                )}
                <button 
                  onClick={(e) => handleDelete(e, addr.id)}
                  className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={18} />
                  حذف
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/addresses/edit/${addr.id}`);
                  }}
                  className="text-sm font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                >
                  <Edit2 size={18} />
                  تعديل
                </button>
              </div>
            </div>
          ))}
          </div>
        )}

        {addresses.length > 0 && (
          <button 
            onClick={() => navigate('/addresses/add', { state: { from: location.pathname, fromCheckout: isSelectMode } })}
            className="w-full h-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-500 hover:text-primary hover:border-primary transition-all group"
          >
            <MapPinPlus size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold">إضافة عنوان جديد</span>
          </button>
        )}
      </main>
    </div>
  );
};

export default SavedAddresses;
