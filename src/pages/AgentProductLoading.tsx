import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw, Globe, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const AgentProductLoading: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  
  const [status, setStatus] = useState<'connecting' | 'scraping' | 'translating' | 'error' | 'success'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setStatus('error');
      return;
    }

    const fetchProduct = async () => {
      try {
        setStatus('connecting');
        setProgress(10);
        
        // Simulate connecting delay
        await new Promise(r => setTimeout(r, 800));
        setStatus('scraping');
        setProgress(30);

        // Call Backend Scraper
        const response = await api.post('/products/fetch-external', { url });
        
        if (response.data) {
          setProgress(70);
          setStatus('translating');
          
          // Simulate translation delay (since it's currently placeholder)
          await new Promise(r => setTimeout(r, 1000));
          
          setProgress(100);
          setStatus('success');
          
          // Redirect to Product Details with the new Product ID
          setTimeout(() => {
            navigate(`/product?id=${response.data.id}`, { replace: true });
          }, 500);
        }
      } catch (err: any) {
        console.error('Agent fetch error:', err);
        // Better error message handling
        const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'فشل في جلب المنتج. يرجى المحاولة مرة أخرى.';
        setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        setStatus('error');
      }
    };

    fetchProduct();
  }, [url, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 dark:bg-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center dark:bg-slate-800">
        
        {status === 'error' ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-red-500"
          >
            <AlertCircle size={64} className="mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-slate-800 dark:text-white">فشل في جلب المنتج</h2>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
            >
              العودة للرئيسية
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle 
                  className="text-slate-200 dark:text-slate-700 stroke-current" 
                  strokeWidth="8" 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                />
                <motion.circle 
                  className="text-primary-600 stroke-current" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                  strokeDasharray="251.2" 
                  strokeDashoffset={251.2 - (251.2 * progress) / 100}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-primary-600">
                {status === 'connecting' && <Globe size={32} className="animate-pulse" />}
                {status === 'scraping' && <RefreshCw size={32} className="animate-spin" />}
                {status === 'translating' && <Globe size={32} />}
                {status === 'success' && <CheckCircle size={32} />}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                {status === 'connecting' && 'جاري الاتصال بالمتجر...'}
                {status === 'scraping' && 'جاري سحب بيانات المنتج...'}
                {status === 'translating' && 'جاري ترجمة التفاصيل...'}
                {status === 'success' && 'تم بنجاح!'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                يرجى الانتظار قليلاً، نحن نقوم بتجهيز المنتج لك باللغة العربية.
              </p>
            </div>
            
            <div className="w-full bg-slate-100 rounded-full h-2 dark:bg-slate-700 overflow-hidden">
              <motion.div 
                className="bg-primary-600 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentProductLoading;
