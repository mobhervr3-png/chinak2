import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClasses = "animate-pulse bg-slate-200 dark:bg-slate-700";
  
  let variantClasses = "";
  switch (variant) {
    case 'text':
      variantClasses = "h-4 w-full rounded";
      break;
    case 'circle':
      variantClasses = "rounded-full";
      break;
    case 'rect':
    default:
      variantClasses = "rounded-2xl";
      break;
  }

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`} />
  );
};

export default Skeleton;
