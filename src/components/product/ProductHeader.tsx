import React from 'react';
import { ArrowLeft, Heart, Share2 } from 'lucide-react';

interface ProductHeaderProps {
  onBack: () => void;
  onShare: () => void;
  onToggleWishlist: () => void;
  isWishlisted: boolean;
}

const ProductHeader: React.FC<ProductHeaderProps> = ({
  onBack,
  onShare,
  onToggleWishlist,
  isWishlisted,
}) => {
  return (
    <header className="fixed top-0 w-full z-20 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] transition-all duration-300">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-slate-900/50 backdrop-blur-md shadow-sm text-slate-900 dark:text-white hover:bg-white transition-colors"
      >
        <ArrowLeft size={20} className="transform rotate-180" />
      </button>
      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleWishlist}
          className={`flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-slate-900/50 backdrop-blur-md shadow-sm transition-colors ${isWishlisted ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}
        >
          <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} strokeWidth={2.5} />
        </button>
        <button 
          onClick={onShare}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-slate-900/50 backdrop-blur-md shadow-sm text-slate-900 dark:text-white hover:bg-white transition-colors"
        >
          <Share2 size={20} />
        </button>
      </div>
    </header>
  );
};

export default ProductHeader;