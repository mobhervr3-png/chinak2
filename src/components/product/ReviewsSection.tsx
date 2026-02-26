import React, { useState } from 'react';
import LazyImage from '../LazyImage';
import { CheckCircle2, Star, X, ImageIcon, MessageCircle } from 'lucide-react';

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: { name: string };
  images?: string[];
}

interface ReviewSummary {
  countText?: string;
  positiveRate?: string;
  tags?: { label: string; count: number }[];
  comments?: string[];
  reviews?: {
    user: string;
    comment: string;
    avatar?: string;
    images?: string[];
  }[];
  images?: string[];
  detailedReviews?: {
    user: string;
    comments: string[];
    images: string[];
  }[];
}

interface ReviewsSectionProps {
  reviews: Review[];
  reviewSummary?: ReviewSummary;
  loading?: boolean;
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  reviews,
  reviewSummary,
  loading = false
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAllReviewsModalOpen, setIsAllReviewsModalOpen] = useState(false);
  const [isAllCommentsModalOpen, setIsAllCommentsModalOpen] = useState(false);
  
  const hasRealReviews = reviews.length > 0 || (reviewSummary && (
    (reviewSummary.tags && reviewSummary.tags.length > 0) ||
    (reviewSummary.comments && reviewSummary.comments.length > 0) ||
    (reviewSummary.reviews && reviewSummary.reviews.length > 0) ||
    (reviewSummary.detailedReviews && reviewSummary.detailedReviews.length > 0) ||
    (reviewSummary.images && reviewSummary.images.length > 0)
  ));
  
  const displayReviews = reviews.slice(0, 2);
  const hasMoreReviews = reviews.length > 2;
  const displaySummaryComments = reviewSummary?.comments?.slice(0, 2) || [];
  const hasMoreSummaryComments = (reviewSummary?.comments?.length || 0) > 2;

  if (!hasRealReviews && loading) {
    return (
      <div className="mb-12 px-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h3 className="text-slate-900 dark:text-white text-2xl font-black">المراجعات</h3>
            <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md mt-2" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 p-6 rounded-[35px] border border-slate-100 dark:border-white/5 animate-pulse">
              <div className="flex items-center gap-3.5 mb-5">
                <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-700" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-100 dark:bg-slate-700 rounded-md" />
                  <div className="h-3 w-16 bg-slate-100 dark:bg-slate-700 rounded-md" />
                </div>
              </div>
              <div className="h-12 w-full bg-slate-100 dark:bg-slate-700 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasRealReviews) return null;

  const renderReviewCard = (review: Review, idx: number) => (
    <div key={review.id || idx} className="bg-white dark:bg-slate-800/60 p-6 rounded-[35px] border border-slate-100 dark:border-white/5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-black text-lg shadow-inner border border-primary/5">
            {review.user?.name?.charAt(0) || 'ع'}
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              {review.user?.name || 'عميل'}
              <CheckCircle2 size={16} className="text-blue-500 fill-blue-500/20" />
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700 fill-slate-200 dark:fill-slate-700'}
                />
              ))}
              <span className="text-[10px] text-slate-400 font-bold mr-1">
                {(() => {
                  if (!review.createdAt) return 'الآن';
                  try {
                    const date = new Date(review.createdAt);
                    return isNaN(date.getTime()) ? 'الآن' : date.toLocaleDateString('ar-IQ');
                  } catch (e) {
                    return 'الآن';
                  }
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3.5 mb-6">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          {review.comment}
        </p>
      </div>

      {review.images && review.images.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pt-2">
          {review.images.map((img: string, i: number) => (
            <div 
              key={i} 
              onClick={() => setSelectedImage(img)}
              className="size-24 shrink-0 rounded-2xl overflow-hidden border-2 border-slate-50 dark:border-slate-700 cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              <LazyImage 
                src={img} 
                alt={`Review ${idx}-${i}`} 
                className="w-full h-full" 
                isThumbnail={true}
                width={200}
                height={200}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mb-12 px-5">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex flex-col">
          <h3 className="text-slate-900 dark:text-white text-xl font-black">اراء العملاء الموجوده في التطبيق الصيني</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-wide">تجارب حقيقية من مشتري المنتج</p>
        </div>
        <div className="bg-primary/5 text-primary px-3 py-1 rounded-full text-[10px] font-black border border-primary/10">
          {(reviews.length > 0 ? reviews.length : (reviewSummary?.countText || '0'))} تقييم
        </div>
      </div>

      {/* Review Summary Tags */}
      {reviewSummary?.tags && reviewSummary.tags.length > 0 && !reviews.some(r => r.id < 0) && (
        <div className="flex flex-wrap gap-2 mb-8">
          {reviewSummary.tags.map((tag: any, idx: number) => (
            <div key={idx} className="px-3 py-1.5 bg-primary/5 dark:bg-primary/10 text-primary rounded-xl text-[11px] font-bold border border-primary/10">
              {tag.label} {tag.count && <span className="opacity-60 ml-0.5">({tag.count})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Review Images Gallery */}
      {reviewSummary?.images && reviewSummary.images.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 px-1">
            <ImageIcon size={20} className="text-amber-500" />
            <span className="text-sm font-black text-slate-700 dark:text-slate-300">صور من المراجعات</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {reviewSummary.images.map((img: string, idx: number) => (
              <div 
                key={idx} 
                onClick={() => setSelectedImage(img)}
                className="size-20 shrink-0 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                <LazyImage 
                  src={img} 
                  alt={`Review Summary ${idx}`} 
                  className="w-full h-full" 
                  isThumbnail={true}
                  width={160}
                  height={160}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Reviews from Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {displayReviews.map((review, idx) => renderReviewCard(review, idx))}
        
        {/* If no real reviews but have summary comments, show them */}
        {reviews.length === 0 && displaySummaryComments.map((comment, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800/60 p-5 rounded-[25px] border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                ع
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {comment}
            </p>
          </div>
        ))}

        {loading && reviews.length > 0 && (
          <div className="col-span-full flex justify-center py-4">
            <div className="h-6 w-6 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {hasMoreReviews && (
        <div className="flex justify-center mb-8">
          <button 
            onClick={() => setIsAllReviewsModalOpen(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary px-8 py-4 rounded-[25px] text-sm font-black hover:bg-primary/20 active:scale-95 transition-all border border-primary/5"
          >
            <MessageCircle size={20} />
            عرض جميع التقييمات ({reviews.length})
          </button>
        </div>
      )}
      {!reviews.length && hasMoreSummaryComments && (
        <div className="flex justify-center mb-8">
          <button 
            onClick={() => setIsAllCommentsModalOpen(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary px-8 py-4 rounded-[25px] text-sm font-black hover:bg-primary/20 active:scale-95 transition-all border border-primary/5"
          >
            <MessageCircle size={20} />
            عرض جميع التعليقات ({reviewSummary?.comments?.length || 0})
          </button>
        </div>
      )}

      {/* All Reviews Modal */}
      {isAllReviewsModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsAllReviewsModalOpen(false)}>
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-[32px] overflow-hidden flex flex-col shadow-xl animate-in slide-in-from-bottom-10 duration-500 border border-slate-100 dark:border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex flex-col">
                <h3 className="text-slate-900 dark:text-white text-xl font-black">جميع التقييمات</h3>
                <p className="text-[12px] text-slate-500 font-bold mt-1">
                  {reviews.length} تقييم من عملاء حقيقيين
                </p>
              </div>
              <button 
                onClick={() => setIsAllReviewsModalOpen(false)}
                className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviews.map((review, idx) => renderReviewCard(review, idx))}
              </div>
            </div>
          </div>
        </div>
      )}
      {isAllCommentsModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsAllCommentsModalOpen(false)}>
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-[32px] overflow-hidden flex flex-col shadow-xl animate-in slide-in-from-bottom-10 duration-500 border border-slate-100 dark:border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex flex-col">
                <h3 className="text-slate-900 dark:text-white text-xl font-black">جميع التعليقات</h3>
                <p className="text-[12px] text-slate-500 font-bold mt-1">
                  {reviewSummary?.comments?.length || 0} تعليق
                </p>
              </div>
              <button 
                onClick={() => setIsAllCommentsModalOpen(false)}
                className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(reviewSummary?.comments || []).map((comment, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800/60 p-5 rounded-[25px] border border-slate-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                        ع
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[120] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-12 right-8 size-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all hover:rotate-90 active:scale-90"
            onClick={() => setSelectedImage(null)}
          >
            <X size={32} />
          </button>
          
          <div className="relative w-full max-w-7xl h-[75vh] flex items-center justify-center">
            <LazyImage 
              src={selectedImage} 
              alt="Zoomed review" 
              className="max-w-full max-h-full object-contain rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-500 border-4 border-white/10"
              isThumbnail={false}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          </div>
          
          <div className="mt-8 flex gap-4 animate-in slide-in-from-bottom-4 duration-700">
            <button 
              onClick={() => setSelectedImage(null)}
              className="bg-white text-slate-900 px-10 py-4 rounded-full text-sm font-black shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              إغلاق المعاينة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
