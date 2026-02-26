import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Smartphone, ArrowRight } from 'lucide-react';
import { verifyWhatsAppOTP, sendWhatsAppOTP } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';

const VerifyOTP: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const showToast = useToastStore((state) => state.showToast);
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    const state = location.state as { phone?: string };
    if (state?.phone) {
      setPhone(state.phone);
    } else {
      showToast('يرجى إدخال رقم الهاتف أولاً', 'error');
      navigate('/login');
    }
  }, [location, navigate, showToast]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval!);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      showToast('يرجى إدخال كود التحقق كاملاً', 'error');
      return;
    }

    const state = location.state as { 
      phone?: string; 
      fullName?: string; 
      type?: 'login' | 'signup';
      isTestAccount?: boolean;
      testUser?: any;
      testToken?: string;
    };

    // Special handling for test accounts - check BEFORE setting loading
    if (state?.isTestAccount) {
      if (otpCode === '123456') {
        if (state.testToken && state.testUser) {
          setAuth(state.testToken, state.testUser);
          showToast('تم تسجيل الدخول كمراجع تجريبي', 'success');
          navigate('/');
          return;
        }
      } else {
        showToast('كود التحقق غير صحيح', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const { token, user } = await verifyWhatsAppOTP(phone, otpCode, state?.fullName);

      if (token && user) {
        setAuth(token, user);
        showToast(state?.type === 'login' ? 'تم تسجيل الدخول بنجاح' : 'تم إنشاء الحساب وتفعيله بنجاح', 'success');
        navigate('/');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'كود التحقق غير صحيح', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    
    setResending(true);
    try {
      await sendWhatsAppOTP(phone);
      showToast('تم إعادة إرسال الكود بنجاح', 'success');
      setTimer(60);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'فشل إعادة إرسال الكود';
      showToast(errorMessage, 'error');
    } finally {
      setResending(false);
    }
  };

  const isLogin = (location.state as any)?.type === 'login';

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl font-display text-slate-900 dark:text-white transition-colors duration-200 antialiased pt-safe" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col items-center pt-12 pb-8 px-6 pt-safe">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <Smartphone className="text-primary" size={40} />
          </div>
          <h1 className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight text-center leading-tight mb-2">
            تحقق من رقمك
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-base font-normal text-center max-w-[80%]">
            لقد أرسلنا كود التحقق إلى <br />
            <span className="font-bold text-slate-900 dark:text-white" dir="ltr">{phone}</span>
          </p>
          {(location.state as any)?.isTestAccount && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl animate-bounce">
              <p className="text-blue-700 dark:text-blue-300 text-sm font-bold text-center">
                كود التحقق للمراجعة هو: <span className="text-lg">123456</span>
              </p>
            </div>
          )}
        </div>

        {/* OTP Input Section */}
        <form onSubmit={handleSubmit} className="px-6 flex flex-col gap-8">
          <div className="flex justify-between gap-2" dir="ltr">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold bg-surface-light dark:bg-surface-dark border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary dark:focus:border-primary focus:outline-none transition-all shadow-sm"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length < 6}
            className="w-full bg-primary hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              isLogin ? 'تسجيل الدخول' : 'تفعيل الحساب'
            )}
          </button>

          <div className="flex flex-col items-center gap-4">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              لم يصلك الكود؟
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={timer > 0 || resending}
              className="text-primary font-bold hover:underline disabled:text-slate-400 transition-colors"
            >
              {timer > 0 ? `إعادة الإرسال خلال ${timer} ثانية` : 'إعادة إرسال الكود'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-auto py-8 flex justify-center items-center gap-2 text-base pb-10 pb-safe">
          <button 
            onClick={() => navigate('/login')} 
            className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors bg-transparent border-none cursor-pointer flex items-center gap-1"
          >
            <ArrowRight size={16} />
            العودة لتسجيل الدخول
          </button>
        </div>
    </div>
  );
};

export default VerifyOTP;
