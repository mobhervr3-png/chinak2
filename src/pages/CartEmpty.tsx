import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, ChevronRight } from 'lucide-react';
import { useWishlistStore } from '../store/useWishlistStore';
import LazyImage from '../components/LazyImage';

const CartEmpty: React.FC = () => {
  const navigate = useNavigate();
  const isProductInWishlist = useWishlistStore((state) => state.isProductInWishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const recommendations = [
    {
      id: 1,
      title: "سماعات لاسلكية برو",
      price: "25,000 IQD",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: 2,
      title: "ساعة ذكية رياضية",
      price: "45,000 IQD",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: 3,
      title: "شاحن محمول سريع",
      price: "15,000 IQD",
      image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=1000&auto=format&fit=crop"
    }
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background-light dark:bg-background-dark font-display text-text-primary-light dark:text-text-primary-dark antialiased pt-safe" dir="rtl">
      {/* Top App Bar */}
        <header className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 pt-safe">
          <div className="flex items-center justify-between p-4 pt-4">
            <button 
              onClick={() => navigate(-1)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors cursor-pointer text-text-primary-light dark:text-text-primary-dark"
            >
              <ChevronRight size={24} />
            </button>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">سلة التسوق</h2>
          </div>
        </header>

        {/* Empty State Section */}
        <main className="flex flex-col px-4 pt-10 pb-6">
          <div className="flex flex-col items-center gap-6 animate-fade-in-up">
            {/* Illustration */}
            <div className="relative w-full max-w-[280px] aspect-square rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center p-8">
              <LazyImage 
                src="https://images.unsplash.com/photo-1586769852044-692d6e671f6e?q=80&w=1000&auto=format&fit=crop" 
                alt="Empty Cart Illustration" 
                className="w-full h-full object-contain mix-blend-multiply"
                isThumbnail={false}
              />
            </div>

            {/* Text Content */}
            <div className="flex max-w-[480px] flex-col items-center gap-3 text-center">
              <h3 className="text-xl font-bold leading-tight text-text-primary-light dark:text-text-primary-dark">سلة التسوق فارغة</h3>
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-normal leading-relaxed max-w-[320px]">
                لم تقم بإضافة أي منتجات بعد. تصفح العروض المميزة وابدأ رحلة التسوق الآن!
              </p>
            </div>

            {/* CTA Button */}
            <button 
              onClick={() => navigate('/')}
              className="w-full max-w-[280px] h-12 mt-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 transition-all text-white font-bold text-base shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span>ابدأ التسوق</span>
              <ShoppingBag size={20} />
            </button>
          </div>
        </main>

        {/* Divider */}
        <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-6"></div>

        {/* Recommendations Section */}
        <section className="flex flex-col py-4">
          <div className="px-4 pb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">منتجات قد تعجبك</h2>
            <button className="text-primary text-sm font-medium hover:underline">عرض الكل</button>
          </div>

          <div className="flex overflow-x-auto no-scrollbar pb-4 pr-4 pl-4 gap-4"> 
            {recommendations.map((item) => (
              <div 
                key={item.id}
                onClick={() => navigate('/product')}
                className="flex flex-col gap-3 min-w-[160px] w-[160px] group cursor-pointer"
              > 
                <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"> 
                  <LazyImage 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full"
                  /> 
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(item.id, {
                        id: item.id,
                        name: item.title,
                        price: item.price,
                        image: item.image
                      });
                    }}
                    className={`absolute top-2 left-2 size-8 bg-white/90 dark:bg-black/60 backdrop-blur rounded-full flex items-center justify-center shadow-sm transition-colors ${isProductInWishlist(item.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                  > 
                    <Heart 
                      size={18} 
                      fill={isProductInWishlist(item.id) ? "currentColor" : "none"} 
                    /> 
                  </button> 
                </div> 
                <div className="flex flex-col gap-1"> 
                  <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark truncate">{item.title}</p> 
                  <p className="text-primary font-bold text-sm" dir="ltr">{item.price}</p> 
                </div> 
              </div>
            ))}
          </div> 
        </section>
    </div>
  );
};

export default CartEmpty;
