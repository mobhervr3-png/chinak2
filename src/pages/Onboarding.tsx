import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LazyImage from '../components/LazyImage';
import { Signal, Wifi, BatteryFull, Check, ArrowLeft } from 'lucide-react';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollPosition = carouselRef.current.scrollLeft;
      const slideWidth = carouselRef.current.offsetWidth;
      // In RTL, scrollLeft is negative or handled differently by browsers
      // For simplicity in this mock, we'll use a more robust way to detect slide
      const slideIndex = Math.round(Math.abs(scrollPosition) / slideWidth);
      setCurrentSlide(slideIndex);
    }
  };

  const nextSlide = () => {
    if (currentSlide < 2) {
      if (carouselRef.current) {
        const slideWidth = carouselRef.current.offsetWidth;
        carouselRef.current.scrollTo({
          left: (currentSlide + 1) * -slideWidth, // RTL scroll
          behavior: 'smooth'
        });
        setCurrentSlide(currentSlide + 1);
      }
    } else {
      navigate('/');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 rtl pt-safe" dir="rtl">
      {/* Status Bar Area (Mock) - Optional for mobile feel, but let's keep it styled nicely */}
      <div className="w-full h-12 flex justify-between items-end px-6 pb-2 select-none z-20 absolute top-0 left-0 right-0 bg-gradient-to-b from-background-light/80 to-transparent dark:from-background-dark/80">
        <div className="text-xs font-bold text-slate-900 dark:text-white leading-none">9:41</div>
        <div className="flex gap-1.5 items-center">
          <Signal size={18} className="text-slate-900 dark:text-white" />
          <Wifi size={18} className="text-slate-900 dark:text-white" />
          <BatteryFull size={18} className="text-slate-900 dark:text-white" />
        </div>
      </div>

      {/* Skip Button */}
      <div className="absolute top-14 left-6 z-20">
        <button 
          onClick={() => navigate('/')}
          className="text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors"
        >
          تخطي
        </button>
      </div>

      {/* Scrollable Carousel Container */}
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex-1 w-full overflow-x-auto snap-x snap-mandatory no-scrollbar flex" 
        id="onboarding-carousel"
      >
        {/* Slide 1: Access */}
        <div className="min-w-full h-full snap-center flex flex-col relative">
          {/* Image Section (Top 60%) */}
          <div className="h-[60%] w-full relative flex items-center justify-center bg-blue-50/50 dark:bg-slate-800/30">
            {/* Background blobs for modern feel */}
            <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-overlay"></div>
            <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-purple-200/40 dark:bg-purple-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-overlay"></div>
            
            {/* Main Illustration */}
            <div className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-soft bg-white dark:bg-slate-800 transition-transform hover:scale-105 duration-500">
              <LazyImage 
                src="https://images.unsplash.com/photo-1557821552-17105176677c?q=80&w=1000&auto=format&fit=crop" 
                alt="Shopping from China" 
                className="w-full h-full object-cover"
                isThumbnail={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
          </div>

          {/* Text Section (Bottom 40%) */}
          <div className="flex-1 w-full bg-background-light dark:bg-background-dark rounded-t-[32px] -mt-6 relative z-10 px-8 pt-10 pb-8 flex flex-col items-center text-center">
            <div className="flex-1 flex flex-col items-center justify-start gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                تسوق من الصين <br/>
                <span className="text-primary">إلى باب منزلك</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-relaxed max-w-[280px]">
                يمكنك الوصول إلى ملايين المنتجات بأسعار المصنع مباشرة من هاتفك، بدون وسطاء.
              </p>
            </div>
          </div>
        </div>

          {/* Slide 2: Payment */}
          <div className="min-w-full h-full snap-center flex flex-col relative">
            <div className="h-[60%] w-full relative flex items-center justify-center bg-blue-50/50 dark:bg-slate-800/30">
              <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-emerald-100/40 dark:bg-emerald-900/20 rounded-full blur-3xl"></div>
              <div className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-soft bg-white dark:bg-slate-800">
                <LazyImage 
                  src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1000&auto=format&fit=crop" 
                  alt="Secure Payment" 
                  className="w-full h-full object-cover"
                  isThumbnail={false}
                />
              </div>
            </div>
            <div className="flex-1 w-full bg-background-light dark:bg-background-dark rounded-t-[32px] -mt-6 relative z-10 px-8 pt-10 pb-8 flex flex-col items-center text-center">
              <div className="flex-1 flex flex-col items-center justify-start gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                  دفع محلي <br/>
                  <span className="text-emerald-500">آمن وسهل</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-relaxed max-w-[280px]">
                  ادفع بعملتك المحلية (الدينار العراقي) من خلال زين كاش، أو البطاقات المحلية بكل أمان.
                </p>
              </div>
            </div>
          </div>

          {/* Slide 3: Delivery */}
          <div className="min-w-full h-full snap-center flex flex-col relative">
            <div className="h-[60%] w-full relative flex items-center justify-center bg-blue-50/50 dark:bg-slate-800/30">
              <div className="absolute bottom-1/3 right-1/4 w-60 h-60 bg-orange-100/40 dark:bg-orange-900/20 rounded-full blur-3xl"></div>
              <div className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-soft bg-white dark:bg-slate-800">
                <LazyImage 
                  src="https://images.unsplash.com/photo-1566576721346-d4a3b4eaad5b?q=80&w=1000&auto=format&fit=crop" 
                  alt="Fast Delivery" 
                  className="w-full h-full object-cover"
                  isThumbnail={false}
                />
              </div>
            </div>
            <div className="flex-1 w-full bg-background-light dark:bg-background-dark rounded-t-[32px] -mt-6 relative z-10 px-8 pt-10 pb-8 flex flex-col items-center text-center">
              <div className="flex-1 flex flex-col items-center justify-start gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                  شحن سريع <br/>
                  <span className="text-orange-500">وموثوق</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-relaxed max-w-[280px]">
                  تتبع شحنتك لحظة بلحظة حتى تصل إلى باب منزلك في أي مكان بالعراق.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Controls (Fixed Position Overlay) */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pb-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-sm z-30 flex flex-col gap-8">
          {/* Pagination Indicators */}
          <div className="flex w-full items-center justify-center gap-2">
            {[0, 1, 2].map((index) => (
              <div 
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === index ? 'w-6 bg-primary' : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              ></div>
            ))}
          </div>

          {/* Main Action Button */}
          <div className="flex justify-between items-center w-full">
            <div className="w-full flex items-center justify-between">
              <div className="w-12"></div>
              {/* Floating Next Button */}
              <button 
                onClick={nextSlide}
                className="group flex items-center justify-center h-16 w-16 rounded-full bg-primary shadow-lg shadow-primary/30 text-white hover:bg-blue-600 transition-all duration-300 active:scale-95"
              >
                {currentSlide === 2 ? (
                  <Check size={32} className="group-hover:-translate-x-1 transition-transform" />
                ) : (
                  <ArrowLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Home Indicator (iOS) - Optional styling */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-900/10 dark:bg-white/10 rounded-full z-40"></div>
    </div>
  );
};

export default Onboarding;

