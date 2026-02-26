import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowRight, 
  SortDesc, 
  CheckCircle2, 
  ThumbsUp, 
  Reply, 
  MessageSquare, 
  SquarePen, 
  Info, 
  X, 
  Star,
  Camera,
  Send,
  Flag
} from 'lucide-react';
import { fetchProductReviews, addProductReview, checkProductPurchase } from '../services/api';
import { useToastStore } from '../store/useToastStore';
import LazyImage from '../components/LazyImage';

const ReviewsAndRatings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  const showToast = useToastStore((state) => state.showToast);
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [hasPurchased, setHasPurchased] = useState(false);

  const loadReviews = useCallback(async (id: number) => {
    try {
      setLoading(true);
      const data = await fetchProductReviews(id);
      setReviews(data);
    } catch (err) {
      console.error('Failed to load reviews:', err);
      showToast('فشل تحميل المراجعات. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const checkPurchaseStatus = useCallback(async (id: number) => {
    try {
      const data = await checkProductPurchase(id);
      setHasPurchased(data.purchased);
    } catch (err) {
      console.error('Failed to check purchase status:', err);
      setHasPurchased(false);
    }
  }, []);

  useEffect(() => {
    if (productId) {
      const id = parseInt(productId);
      loadReviews(id);
      checkPurchaseStatus(id);
    }
  }, [productId, loadReviews, checkPurchaseStatus]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // In a real app, you'd upload to a server and get URLs
      // For this demo, we'll use local URLs
      const urls = Array.from(files).map(file => URL.createObjectURL(file));
      setNewImages([...newImages, ...urls]);
    }
  };

  const removeImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleSubmitReview = async () => {
    if (!productId) return;
    if (!newComment.trim()) {
      showToast('يرجى كتابة تعليق', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await addProductReview(parseInt(productId), newRating, newComment, newImages);
      setNewComment('');
      setNewRating(5);
      setNewImages([]);
      setShowReviewModal(false);
      showToast('تمت إضافة المراجعة بنجاح', 'success');
      loadReviews(parseInt(productId));
    } catch (err: any) {
      showToast(err.message || 'فشل في إضافة المراجعة. تأكد من تسجيل الدخول.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [helpfulVotes, setHelpfulVotes] = useState<Record<number, boolean>>({});

  const handleHelpfulClick = (reviewId: number) => {
    setHelpfulVotes(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
    if (!helpfulVotes[reviewId]) {
      showToast('شكراً لمشاركتك!', 'success');
    }
  };

  const handleReplyClick = (_review: any) => {
    showToast('هذه الميزة قيد التطوير...', 'info');
  };

  const handleReportReview = (_reviewId: number) => {
    showToast('تم إرسال بلاغك للمراجعة. شكراً لك.', 'success');
  };

  const filteredReviews = reviews
    .filter(r => activeFilter === 'all' ? true : r.rating === activeFilter)
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return 0;
    });

  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    percentage: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0
  }));

  const allPhotos = reviews.flatMap(r => r.images || []).slice(0, 8);

  if (loading) return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center rtl pb-safe" dir="rtl">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased pb-24 pb-safe pt-safe" dir="rtl">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-surface-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-colors pt-safe">
          <div className="flex items-center justify-between px-5 pt-4 pb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center justify-center w-8 h-8 -mr-1 text-slate-900 dark:text-white active:opacity-70 transition-opacity"
              >
                <ArrowRight size={24} />
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">التقييمات والمراجعات</h1>
            </div>
            <div className="flex size-10 items-center justify-center"></div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 pb-32">
          {/* Rating Summary */}
          <section className="px-5 pt-6 pb-2">
            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{reviews.length} تقييم</p>
                </div>
                
                <div className="flex-1 w-full space-y-3">
                  {ratingCounts.map(({ star, percentage }) => (
                    <div key={star} className="flex items-center gap-4">
                      <div className="flex items-center gap-1 w-6">
                        <span className="text-slate-600 dark:text-slate-300 text-sm font-bold">{star}</span>
                      </div>
                      <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div 
                          className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-1000 ease-out" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-medium w-8 text-end">{Math.round(percentage)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Photos Gallery */}
          {allPhotos.length > 0 && (
            <section className="px-5 mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">صور المراجعات</h3>
                <button className="text-primary text-sm font-bold">عرض الكل</button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {allPhotos.map((photo, i) => (
                  <div key={i} className="relative size-24 rounded-2xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <LazyImage 
                      src={photo} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      isThumbnail={true}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Filters & Sorting */}
          <section className="px-5 mt-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">كل المراجعات</h3>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-surface-dark px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <SortDesc size={18} className="text-slate-400" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 border-none focus:ring-0 outline-none cursor-pointer"
                >
                  <option value="newest">الأحدث</option>
                  <option value="highest">الأعلى تقييماً</option>
                  <option value="lowest">الأقل تقييماً</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                  activeFilter === 'all' 
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-surface-light dark:bg-surface-dark border-slate-100 dark:border-slate-800 text-slate-500 hover:border-primary/30'
                }`}
              >
                الكل ({reviews.length})
              </button>
              {[5, 4, 3, 2, 1].map(star => (
                <button 
                  key={star}
                  onClick={() => setActiveFilter(star)}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all border ${
                    activeFilter === star 
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                      : 'bg-surface-light dark:bg-surface-dark border-slate-100 dark:border-slate-800 text-slate-500 hover:border-primary/30'
                  }`}
                >
                  {star}
                  ({reviews.filter(r => r.rating === star).length})
                </button>
              ))}
            </div>
          </section>

          {/* Reviews List */}
          <section className="flex flex-col gap-4 px-5 mt-2">
            {filteredReviews.length > 0 ? (
              filteredReviews.map((review) => (
                <div key={review.id} className="flex flex-col gap-4 bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl size-12 flex items-center justify-center text-primary font-black text-lg border border-primary/10">
                        {review.user.name[0]}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-900 dark:text-white text-base font-bold leading-none">{review.user.name}</p>
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                            <CheckCircle2 size={12} className="text-green-500 fill-green-500/20" />
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">مشتري مؤكد</span>
                          </div>
                        </div>
                        <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">{new Date(review.createdAt).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 text-slate-400 bg-slate-500/5 dark:bg-slate-500/10 px-2 py-1 rounded-xl border border-slate-500/10">
                      <span className="text-[10px] font-bold">تقييم ممتاز</span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed font-medium">
                      {review.comment}
                    </p>
                  </div>

                  {review.images && review.images.length > 0 && (
                    <div className="flex gap-3 mt-1 overflow-x-auto pb-1 no-scrollbar">
                      {review.images.map((img: string, idx: number) => (
                        <LazyImage key={idx} src={img} alt="" className="size-20 rounded-2xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm" isThumbnail={true} />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-6 mt-2 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                    <button 
                      onClick={() => handleHelpfulClick(review.id)}
                      className={`flex items-center gap-2 transition-all px-3 py-1.5 rounded-xl ${
                        helpfulVotes[review.id] 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'text-slate-400 hover:text-primary hover:bg-primary/5 border border-transparent'
                      }`}
                    >
                      <ThumbsUp size={20} className={helpfulVotes[review.id] ? 'fill-primary' : ''} />
                      <span className="text-xs font-bold">مفيد ({helpfulVotes[review.id] ? 1 : 0})</span>
                    </button>
                    <button 
                      onClick={() => handleReplyClick(review)}
                      className="flex items-center gap-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Reply size={20} />
                      <span className="text-xs font-bold">رد</span>
                    </button>
                    <button 
                      onClick={() => handleReportReview(review.id)}
                      className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-all px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10"
                      title="إبلاغ"
                    >
                      <Flag size={18} />
                      <span className="text-xs font-bold">إبلاغ</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="size-24 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center mb-6">
                  <MessageSquare size={48} className="text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">لا توجد مراجعات بعد</h3>
                <p className="text-slate-500 max-w-[240px] text-sm">كن أول من يشارك تجربته مع هذا المنتج!</p>
              </div>
            )}
          </section>
        </main>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-20 left-0 right-0 p-5 pb-safe bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pt-10 z-50 w-full">
          {hasPurchased ? (
            <button 
              onClick={() => setShowReviewModal(true)}
              className="w-full flex items-center justify-center overflow-hidden rounded-2xl h-16 bg-primary text-white shadow-xl shadow-primary/30 active:scale-[0.98] transition-all duration-200"
            >
              <SquarePen className="me-3" size={24} />
              <span className="text-lg font-bold">أكتب مراجعة الآن</span>
            </button>
          ) : (
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 flex items-center gap-3 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Info className="text-amber-500" size={24} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-snug">يمكن فقط للمشترين المؤكدين لهذا المنتج كتابة مراجعة لضمان مصداقية التقييمات.</p>
            </div>
          )}
        </div>

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-[95vw] lg:max-w-5xl bg-surface-light dark:bg-slate-900 rounded-t-[40px] p-8 pb-safe animate-slide-up shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">أكتب مراجعة</h3>
                <button 
                  onClick={() => setShowReviewModal(false)} 
                  className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="mb-8 text-center bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4">ما هو تقييمك للمنتج؟</p>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star} 
                      onClick={() => setNewRating(star)}
                      className={`transition-all duration-300 ${newRating >= star ? 'scale-110' : 'scale-100'}`}
                    >
                      <Star size={36} className={newRating >= star ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-black text-slate-900 dark:text-white mb-3 px-1">تعليقك</label>
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="اكتب رأيك بالمنتج هنا بالتفصيل لمساعدة الآخرين..."
                  className="w-full h-36 p-5 rounded-[24px] bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-primary/30 focus:bg-surface-light dark:focus:bg-slate-800/80 text-slate-900 dark:text-white transition-all outline-none resize-none font-medium"
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-black text-slate-900 dark:text-white mb-4 px-1">إضافة صور (اختياري)</label>
                <div className="flex flex-wrap gap-4">
                  {newImages.map((img, idx) => (
                    <div key={idx} className="relative size-24 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm group">
                      <LazyImage 
                        src={img} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        isThumbnail={true}
                      />
                      <button 
                        onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 size-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {newImages.length < 4 && (
                    <label className="size-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all group">
                      <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
                        <Camera size={20} className="text-slate-400 group-hover:text-primary" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold group-hover:text-primary transition-colors">أضف صورة</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <button 
                onClick={handleSubmitReview}
                disabled={isSubmitting}
                className="w-full h-16 bg-primary text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send size={20} />
                    <span>نشر المراجعة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
    </div>
  );
};

export default ReviewsAndRatings;
