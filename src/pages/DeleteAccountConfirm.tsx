import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Trash2, ShieldAlert } from 'lucide-react';
import { deleteAccount } from '../services/api';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';

const DeleteAccountConfirm: React.FC = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const logout = useAuthStore((state) => state.logout);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDelete = async () => {
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      await deleteAccount();
      showToast('تم حذف الحساب نهائياً. نتمنى رؤيتك قريباً.', 'success');
      logout();
      navigate('/login');
    } catch (err: any) {
      showToast(err.message || 'فشل حذف الحساب', 'error');
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-white pb-safe pt-safe" dir="rtl">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 pt-safe">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowRight size={24} />
          </button>
          <h1 className="text-xl font-bold">حذف الحساب</h1>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 flex flex-col items-center text-center">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-6">
            <AlertTriangle size={40} />
          </div>

          <h2 className="text-2xl font-bold mb-4">هل أنت متأكد حقاً؟</h2>
          
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl p-5 mb-8 text-right">
            <div className="flex items-start gap-3 mb-4">
              <ShieldAlert className="text-red-600 shrink-0 mt-1" size={20} />
              <p className="text-sm font-bold text-red-700 dark:text-red-400">تحذير: هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                <span>سيتم حذف جميع بياناتك الشخصية من خوادمنا فوراً.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                <span>ستفقد إمكانية الوصول إلى تاريخ طلباتك وعناوينك المحفوظة.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                <span>سيتم إلغاء أي كوبونات أو نقاط ولاء مرتبطة بحسابك.</span>
              </li>
            </ul>
          </div>

          <label className="flex items-center gap-3 w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer mb-8 text-right">
            <input 
              type="checkbox" 
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="size-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              أدرك تماماً العواقب وأؤكد رغبتي في حذف حسابي نهائياً.
            </span>
          </label>

          <div className="w-full space-y-4">
            <button
              onClick={handleDelete}
              disabled={!confirmed || isDeleting}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
            >
              {isDeleting ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Trash2 size={20} />
                  حذف الحساب الآن
                </>
              )}
            </button>
            
            <button
              onClick={() => navigate(-1)}
              disabled={isDeleting}
              className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              تراجع، أريد البقاء
            </button>
          </div>
        </main>
    </div>
  );
};

export default DeleteAccountConfirm;
