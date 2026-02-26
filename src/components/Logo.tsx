import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = false }) => {
  const sizeClasses = {
    sm: 'size-6 text-xl',
    md: 'size-10 text-2xl',
    lg: 'size-14 text-3xl',
    xl: 'size-20 text-4xl',
  };

  const containerSizeClasses = {
    sm: 'size-8 rounded-lg',
    md: 'size-12 rounded-xl',
    lg: 'size-16 rounded-2xl',
    xl: 'size-24 rounded-[2rem]',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex items-center justify-center overflow-hidden ${containerSizeClasses[size]} shrink-0`}>
        <img 
          src="/logo.png" 
          alt="Chinak Logo" 
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback to text if image fails to load
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const span = document.createElement('span');
              span.className = `text-primary font-bold ${sizeClasses[size].split(' ')[1]}`;
              span.innerText = 'C';
              parent.appendChild(span);
              parent.classList.add('bg-primary/10', 'dark:bg-primary/20');
            }
          }}
        />
      </div>
      {showText && (
        <span className={`font-bold text-slate-900 dark:text-white ${size === 'xl' ? 'text-2xl' : 'text-xl'}`}>
          Chinak
        </span>
      )}
    </div>
  );
};

export default Logo;