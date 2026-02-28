import { useEffect, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';
import Toast from './components/Toast';
import { useAuthStore } from './store/useAuthStore';
import { useCartStore } from './store/useCartStore';
// import { useWishlistStore } from './store/useWishlistStore';
import { useNotificationStore } from './store/useNotificationStore';
import { useThemeStore } from './store/useThemeStore';
import { useChatStore } from './store/useChatStore';
import { useMaintenanceStore } from './store/useMaintenanceStore';
import { useToastStore } from './store/useToastStore';
import { socket, connectSocket, disconnectSocket } from './services/socket';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenanceScreen from './components/MaintenanceScreen';
import AppUpdateChecker from './components/AppUpdateChecker';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const CartEmpty = lazy(() => import('./pages/CartEmpty'));
const Profile = lazy(() => import('./pages/Profile'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Categories = lazy(() => import('./pages/Categories'));
const Notifications = lazy(() => import('./pages/Notifications'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const ShippingTracking = lazy(() => import('./pages/ShippingTracking'));
const CheckoutShipping = lazy(() => import('./pages/CheckoutShipping'));
const CheckoutPaymentAddress = lazy(() => import('./pages/CheckoutPaymentAddress'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const OrderNotFound = lazy(() => import('./pages/OrderNotFound'));
const SavedAddresses = lazy(() => import('./pages/SavedAddresses'));
const AddAddress = lazy(() => import('./pages/AddAddress'));
const EditAddress = lazy(() => import('./pages/EditAddress'));
const ChatList = lazy(() => import('./pages/ChatList'));
const Chat = lazy(() => import('./pages/Chat'));
const FAQ = lazy(() => import('./pages/FAQ'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const CustomerSupport = lazy(() => import('./pages/CustomerSupport'));
const ReviewsAndRatings = lazy(() => import('./pages/ReviewsAndRatings'));
const AdvancedSettings = lazy(() => import('./pages/AdvancedSettings'));
const DeleteAccountConfirm = lazy(() => import('./pages/DeleteAccountConfirm'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const AgentProductLoading = lazy(() => import('./pages/AgentProductLoading'));

import { performCacheMaintenance } from './services/api';

import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

const AdminLayout = lazy(() => import('./components/AdminLayout'));

// Loading fallback
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark min-h-[60vh]">
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1 mb-2">
          <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
          <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
          <div className="size-1.5 rounded-full bg-primary animate-bounce"></div>
        </div>
        <p className="text-sm font-bold text-slate-500 animate-pulse">
          جاري تحضير طلبك...
        </p>
      </div>
    </div>
  </div>
);

function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToastStore((state) => state.showToast);
  const lastBackPress = useRef<number>(0);
  const locationPathRef = useRef(location.pathname);

  // Update ref when location changes so the listener always has the latest path
  useEffect(() => {
    locationPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    let backButtonListener: PluginListenerHandle | undefined;
    let isMounted = true;
    
    const setupBackButton = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
            const currentPath = locationPathRef.current;
            
            if (currentPath === '/') {
              const now = Date.now();
              if (now - lastBackPress.current < 2000) {
                CapApp.exitApp();
              } else {
                lastBackPress.current = now;
                showToast('اضغط مرة أخرى للخروج', 'info', 2000);
              }
            } else if (canGoBack) {
              window.history.back();
            } else {
              navigate('/', { replace: true });
            }
          });

          if (isMounted) {
            backButtonListener = listener;
          } else {
            listener.remove();
          }
        } catch (error) {
          console.error('Error adding back button listener:', error);
        }
      }
    };

    setupBackButton();

    return () => {
      isMounted = false;
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [navigate, showToast]); // Removed location dependency to avoid re-binding

  return null;
}

function MainLayout() {
  const location = useLocation();
  const noBottomNavPaths = [
    '/login', '/verify-otp', '/onboarding', '/checkout/shipping', 
    '/checkout/payment-address', '/chat', '/product', '/shipping-tracking',
    '/order-confirmation', '/addresses/add', '/addresses/edit', '/reviews',
    '/customer-support', '/contact-us', '/privacy-policy', '/terms-of-service',
    '/advanced-settings', '/delete-account', '/order-not-found', '/cart/empty',
    '/faq', '/cart', '/search'
  ];
  
  const showBottomNav = !noBottomNavPaths.includes(location.pathname) && 
                       !noBottomNavPaths.some(path => location.pathname.startsWith(path));

  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-900 shadow-xl relative flex flex-col">
      <AppUpdateChecker />
      <div className="flex-1 flex flex-col relative">
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}

function AdminRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>
        <Routes>
          <Route 
            path="/*" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <div className="p-8 text-center text-gray-500">
                  Dashboard under construction
                </div>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </AdminLayout>
    </Suspense>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/onboarding" element={<PageTransition><Onboarding /></PageTransition>} />
        <Route path="/cart" element={
          <ProtectedRoute>
            <PageTransition><Cart /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/cart/empty" element={<PageTransition><CartEmpty /></PageTransition>} />
        <Route path="/categories" element={<PageTransition><Categories /></PageTransition>} />
        <Route path="/order-not-found" element={<PageTransition><OrderNotFound /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/verify-otp" element={<PageTransition><VerifyOTP /></PageTransition>} />
        <Route path="/product" element={<PageTransition><ProductDetails /></PageTransition>} />
        <Route path="/search" element={
          <ProtectedRoute>
            <PageTransition><SearchResults /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/about-us" element={<PageTransition><AboutUs /></PageTransition>} />
        <Route path="/faq" element={<PageTransition><FAQ /></PageTransition>} />
        <Route path="/shipping-tracking" element={
          <ProtectedRoute>
            <PageTransition><ShippingTracking /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/checkout/shipping" element={
          <ProtectedRoute>
            <PageTransition><CheckoutShipping /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/checkout/payment" element={
          <ProtectedRoute>
            <PageTransition><CheckoutPaymentAddress /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/order-confirmation/:id" element={
          <ProtectedRoute>
            <PageTransition><OrderConfirmation /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute>
            <PageTransition><MyOrders /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <PageTransition><Profile /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/advanced-settings" element={
          <ProtectedRoute>
            <PageTransition><AdvancedSettings /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/delete-account" element={
          <ProtectedRoute>
            <PageTransition><DeleteAccountConfirm /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/customer-support" element={<CustomerSupport />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/agent/product" element={<PageTransition><AgentProductLoading /></PageTransition>} />
        <Route path="/chats" element={
          <ProtectedRoute>
            <PageTransition><ChatList /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute>
            <PageTransition><Chat /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <PageTransition><Notifications /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/favorites" element={
          <ProtectedRoute>
            <PageTransition><Favorites /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/addresses" element={
          <ProtectedRoute>
            <PageTransition><SavedAddresses /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/addresses/add" element={
          <ProtectedRoute>
            <PageTransition><AddAddress /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/addresses/edit/:id" element={
          <ProtectedRoute>
            <PageTransition><EditAddress /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/about" element={<PageTransition><AboutUs /></PageTransition>} />
        <Route path="/reviews" element={<PageTransition><ReviewsAndRatings /></PageTransition>} />
      </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const fetchCart = useCartStore((state) => state.fetchCart);
  // const fetchWishlist = useWishlistStore((state) => state.fetchWishlist); // Removed unused
  
  const { isAuthenticated, user, isLoading } = useAuthStore(
    useShallow((state) => ({ 
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      isLoading: state.isLoading
    }))
  );
  
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const initChatSocket = useChatStore((state) => state.initSocket);
  
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const initNotificationSocket = useNotificationStore((state) => state.initSocket);
  const cleanupNotificationSocket = useNotificationStore((state) => state.cleanupSocket);
  const isServerDown = useMaintenanceStore((state) => state.isServerDown);

  useEffect(() => {
    performCacheMaintenance();
    checkAuth();
    initChatSocket();

    // Listen for unauthorized errors from API
    const handleUnauthorized = () => {
      console.warn('Unauthorized access detected, logging out...');
      useAuthStore.getState().logout();
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, [checkAuth, initChatSocket]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Only connect socket and fetch user data when we are fully authenticated and done loading
    if (isAuthenticated && user && !isLoading) {
      fetchCart();
      // fetchWishlist(); // Removed as wishlist is now local storage only
      fetchNotifications();
      
      // OPTIMIZATION: Delay socket connection to prevent startup lag
      setTimeout(() => {
        connectSocket();
        if (String(user.role || '').toUpperCase() === 'ADMIN') {
          socket.emit('join_admin_room');
        }
        initNotificationSocket(user.id);
      }, 2000);

      return () => {
        cleanupNotificationSocket(user.id);
      };
    } else if (!isAuthenticated && !isLoading) {
      disconnectSocket();
    }
  }, [isAuthenticated, user, isLoading, fetchCart, fetchNotifications, initNotificationSocket, cleanupNotificationSocket]);

  if (isServerDown) {
    return <MaintenanceScreen />;
  }

  return (
    <Router>
      <BackButtonHandler />
      <ScrollToTop />
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <Toast />
        <ErrorBoundary>
          <Routes>
            <Route path="/admin/*" element={<AdminRoutes />} />
            <Route path="/*" element={
              <Suspense fallback={<PageLoader />}>
                <MainLayout />
              </Suspense>
            } />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  );
}

export default App
