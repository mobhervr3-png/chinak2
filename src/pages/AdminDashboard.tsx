import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Users, 
  Package, 
  ShoppingCart, 
  Search, 
  Plus, 
  Filter,
  MoreVertical,
  TrendingUp as _TrendingUp,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Download,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Settings,
  X,
  Plane,
  Waves,
  Save,
  Truck,
  Share2,
  Globe
} from 'lucide-react';
import { useLocation, Routes, Route, useNavigate as _useNavigate } from 'react-router-dom';
import { 
  fetchAdminStats, 
  fetchAdminUsers, 
  fetchAdminProducts, 
  fetchAdminOrders,
  fetchAdminOrderDetails,
  fetchAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  updateUserRole,
  enqueueBulkImportProducts,
  fetchBulkImportJob,
  updateProduct,
  saveProductOptions,
  deleteProduct,
  bulkDeleteProducts,
  bulkPublishProducts,
  bulkCreateProducts,
  updateOrderStatus,
  updateOrderInternationalFee,
  updateProductPrice,
  fetchSettings,
  updateSettings
} from '../services/api';
import { localProductService } from '../services/localProductService';
import { socket } from '../services/socket';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';
import StatsCards from '../components/admin/StatsCards';
import ProductCard from '../components/admin/ProductCard';
import BestSellers from '../components/admin/BestSellers';
import ProductPerformance from '../components/admin/ProductPerformance';
import ProductEditor from './ProductEditor';
import LazyImage from '../components/LazyImage';

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const showToast = useToastStore((state) => state.showToast);
  const currentUser = useAuthStore((state) => state.user);
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<(number | string)[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [bulkImportJobs, setBulkImportJobs] = useState<Record<string, any>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [couponFormData, setCouponFormData] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minOrderAmount: '',
    maxDiscount: '',
    endDate: '',
    usageLimit: '',
    isPublic: true
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [importText, setImportText] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<number | string | null>(null);
  const [tempPrice, setTempPrice] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const showProductEditor = useState(false)[0];
  const setShowProductEditor = useState(false)[1];
  const editingProductId = useState<number | string | null>(null)[0];
  const setEditingProductId = useState<number | string | null>(null)[1];
  const [showOriginalOptions, setShowOriginalOptions] = useState(false);
  
  const [storeSettings, setStoreSettings] = useState({
    airShippingRate: 15400,
    seaShippingRate: 182000,
    airShippingMinFloor: 0,
    currency: 'د.ع',
    storeName: '',
    contactEmail: '',
    contactPhone: '',
    footerText: '',
    socialLinks: {
      facebook: '',
      instagram: '',
      whatsapp: '',
      telegram: ''
    }
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  
  // Determine active tab from path
  const activeTab = location.pathname === '/admin' ? 'stats' : location.pathname.split('/').pop() || 'stats';

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 20;
  const PRODUCTS_PER_PAGE = 21;

  const getLimit = useCallback(() => activeTab === 'products' ? PRODUCTS_PER_PAGE : ITEMS_PER_PAGE, [activeTab]);

  const getAuthToken = useCallback(() => {
    let token = useAuthStore.getState().token;
    if (!token) {
      token = localStorage.getItem('auth_token');
    }
    return token;
  }, []);

  const bulkImportJobsForUser = useMemo(() => {
    if (!currentUser) return [];
    return Object.values(bulkImportJobs)
      .filter((j: any) => String(j?.userId || '') === String(currentUser.id || ''))
      .sort((a: any, b: any) => {
        const aTime = Date.parse(a?.createdAt || a?.startedAt || a?.finishedAt || '') || 0;
        const bTime = Date.parse(b?.createdAt || b?.startedAt || b?.finishedAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }, [bulkImportJobs, currentUser]);

  const bulkImportJobBufferRef = useRef<Record<string, any>>({});
  const bulkImportJobFlushTimerRef = useRef<number | null>(null);
  const bulkImportJobFlushVersionRef = useRef(0);
  const scheduleProductsReloadTimerRef = useRef<number | null>(null);

  const flushBulkImportJobs = useCallback(() => {
    const buffered = bulkImportJobBufferRef.current;
    const ids = Object.keys(buffered);
    if (ids.length === 0) return;

    bulkImportJobBufferRef.current = {};

    setBulkImportJobs((prev) => {
      let changed = false;
      const next: Record<string, any> = { ...prev };

      for (const id of ids) {
        const incoming = buffered[id];
        if (!incoming) continue;
        const prevJob = prev[id] || {};

        if (
          prevJob.status === incoming.status &&
          Number(prevJob.processed || 0) === Number(incoming.processed || 0) &&
          Number(prevJob.total || 0) === Number(incoming.total || 0) &&
          prevJob.finishedAt === incoming.finishedAt &&
          prevJob.error === incoming.error
        ) {
          continue;
        }

        changed = true;
        next[id] = { ...prevJob, ...incoming };
      }

      if (!changed) return prev;

      const forUser = Object.values(next)
        .filter((j: any) => String(j?.userId || '') === String(currentUser?.id || ''))
        .sort((a: any, b: any) => {
          const aTime = Date.parse(a?.createdAt || a?.startedAt || a?.finishedAt || '') || 0;
          const bTime = Date.parse(b?.createdAt || b?.startedAt || b?.finishedAt || '') || 0;
          return bTime - aTime;
        });

      const trimmed = forUser.slice(0, 25);
      const trimmedIds = new Set(trimmed.map((j: any) => j.id));

      for (const job of forUser.slice(25)) {
        if (job?.status === 'queued' || job?.status === 'processing' || job?.status === 'running') continue;
        delete next[job.id];
      }

      for (const id of Object.keys(next)) {
        const job = next[id];
        if (String(job?.userId || '') !== String(currentUser?.id || '')) continue;
        if (!trimmedIds.has(id) && (job?.status === 'completed' || job?.status === 'failed')) {
          delete next[id];
        }
      }

      return next;
    });
  }, [currentUser]);

  const bufferBulkImportJobUpdate = useCallback(
    (job: any) => {
      if (!job?.id) return;

      bulkImportJobBufferRef.current[job.id] = {
        ...(bulkImportJobBufferRef.current[job.id] || {}),
        ...job
      };

      if (bulkImportJobFlushTimerRef.current) return;

      bulkImportJobFlushVersionRef.current += 1;
      const version = bulkImportJobFlushVersionRef.current;
      bulkImportJobFlushTimerRef.current = window.setTimeout(() => {
        if (bulkImportJobFlushVersionRef.current === version) {
          flushBulkImportJobs();
        }
        bulkImportJobFlushTimerRef.current = null;
      }, 250);
    },
    [flushBulkImportJobs]
  );

  const loadData = useCallback(async (page = currentPage, silent = false, append = false, forceUpdate = false) => {
    if (!silent && !append) setLoading(true);
    if (append) setIsLoadingMore(true);
    
    const limit = getLimit();
    
    // Get token from store or localStorage
    let token = useAuthStore.getState().token;
    if (!token) {
      token = localStorage.getItem('auth_token');
    }
    
    console.log('[AdminDashboard] Loading data...', { 
      activeTab, 
      page, 
      limit, 
      hasToken: !!token,
      tokenLength: token?.length || 0,
      append,
      forceUpdate
    });

    if (!token) {
      console.warn('[AdminDashboard] No auth token found!');
      // Give it one more try after a short delay, maybe it's a race condition
      await new Promise(resolve => setTimeout(resolve, 500));
      token = useAuthStore.getState().token || localStorage.getItem('auth_token');
      
      if (!token) {
        showToast('يرجى تسجيل الدخول للوصول إلى لوحة التحكم', 'error');
        setLoading(false);
        setIsLoadingMore(false);
        return;
      }
    }

    try {
      if (activeTab === 'stats') {
        const data = await fetchAdminStats(token);
        console.log('[AdminDashboard] Stats loaded successfully');
        setStats(data);
      } else if (activeTab === 'users') {
        const data = await fetchAdminUsers(page, limit, searchTerm, token);
        if (append) {
          setUsers(prev => [...prev, ...data.users || []]);
        } else {
          setUsers(data.users || []);
        }
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      } else if (activeTab === 'products') {
        const data = await fetchAdminProducts(page, limit, searchTerm, token, forceUpdate);
        let allProducts = data.products || [];
        
        // Add local drafts if we are on the first page
        if (page === 1) {
          const drafts = localProductService.getAllDrafts();
          const filteredDrafts = searchTerm 
            ? drafts.filter(d => 
                d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (d.chineseName && d.chineseName.toLowerCase().includes(searchTerm.toLowerCase()))
              )
            : drafts;
          
          // Filter out any server products that might have the same ID as a draft (shouldn't happen with local- prefix)
          const draftIds = new Set(filteredDrafts.map(d => d.id));
          const uniqueServerProducts = allProducts.filter((p: any) => !draftIds.has(p.id));
          
          allProducts = [...filteredDrafts, ...uniqueServerProducts];
        }

        if (append) {
          setProducts(prev => [...prev, ...allProducts]);
        } else {
          setProducts(allProducts);
        }

        const localDraftsCount = localProductService.getAllDrafts().length;
        const total = (data.total || 0) + localDraftsCount;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / limit));
      } else if (activeTab === 'orders') {
        const data = await fetchAdminOrders({ 
          page, 
          limit: limit,
          search: searchTerm 
        }, token);
        if (append) {
          setOrders(prev => [...prev, ...data.orders || []]);
        } else {
          setOrders(data.orders || []);
        }
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      } else if (activeTab === 'coupons') {
        const data = await fetchAdminCoupons(token);
        setCoupons(data || []);
        setTotalPages(1);
        setTotalItems(data.length || 0);
      } else if (activeTab === 'settings') {
        const data = await fetchSettings({ skipCache: true });
        console.log('[AdminDashboard] Settings tab: Loaded data:', data);
        if (data) {
          setStoreSettings(prev => {
            const newState = {
              ...prev,
              ...data,
              airShippingRate: data.airShippingRate || 15400,
              seaShippingRate: data.seaShippingRate || 182000,
              airShippingMinFloor: 0,
              socialLinks: typeof data.socialLinks === 'string' ? JSON.parse(data.socialLinks) : (data.socialLinks || prev.socialLinks)
            };
            console.log('[AdminDashboard] Settings tab: Updating storeSettings to:', newState);
            return newState;
          });
        }
      }
    } catch (error: any) {
      console.error('[AdminDashboard] Error loading admin data:', error);
      const errorMsg = error.message || 'فشل تحميل البيانات';
      showToast(`${errorMsg} (تحقق من الاتصال بالسيرفر)`, 'error');
      
      // If it's an auth error, maybe redirect?
      if (error.status === 401 || error.status === 403) {
        // window.location.href = '/login';
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, currentPage, getLimit, searchTerm, showToast]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !isLoadingMore && currentPage < totalPages) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          loadData(nextPage, true, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loading, isLoadingMore, currentPage, totalPages, loadData]);

  const scheduleProductsReload = useCallback(() => {
    if (scheduleProductsReloadTimerRef.current) {
      window.clearTimeout(scheduleProductsReloadTimerRef.current);
    }
    scheduleProductsReloadTimerRef.current = window.setTimeout(() => {
      loadData(1, true, false, true);
      scheduleProductsReloadTimerRef.current = null;
    }, 1500);
  }, [loadData]);

  useEffect(() => {
    // Load store settings once on mount to get shipping rates for price calculations
    const loadStoreSettings = async () => {
      try {
        const data = await fetchSettings({ skipCache: true });
        console.log('[AdminDashboard] Loaded store settings:', data);
        if (data) {
          setStoreSettings(prev => {
            const newState = {
              ...prev,
              ...data,
              airShippingRate: data.airShippingRate || 15400,
              seaShippingRate: data.seaShippingRate || 182000,
              airShippingMinFloor: 0,
              socialLinks: typeof data.socialLinks === 'string' ? JSON.parse(data.socialLinks) : (data.socialLinks || prev.socialLinks)
            };
            console.log('[AdminDashboard] Updating storeSettings state to:', newState);
            return newState;
          });
        }
      } catch (error) {
        console.error('Failed to load store settings:', error);
      }
    };
    loadStoreSettings();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset page when tab changes
    loadData(1, false, false, true); // Load tab data with loading state
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser) return;

    const handler = (payload: any) => {
      if (!payload) return;
      if (String(payload.userId || '') !== String(currentUser.id || '')) return;

      bufferBulkImportJobUpdate(payload);

      if (payload.status === 'completed' && payload.results) {
        const result = payload.results;

        let message = `تم استيراد ونشر ${result.imported} منتج بنجاح.`;
        if (result.skipped > 0) message += ` تم تخطي ${result.skipped} منتج موجود مسبقاً.`;
        if (result.requeued > 0) message += ` تم إعادة جدولة ${result.requeued} منتج للمعالجة (Embedding).`;
        if (result.failed > 0) {
          message += ` فشل استيراد ${result.failed} منتج.`;
          const examples = Array.isArray(result.errors)
            ? result.errors
                .slice(0, 3)
                .map((e: any) => `${e?.name || 'بدون اسم'}: ${e?.error || 'خطأ غير معروف'}`)
                .join(' | ')
            : '';
          if (examples) message += ` أمثلة: ${examples}`;
        }
        if (result.skipped > 0 && Array.isArray(result.skippedDetails) && result.skippedDetails.length > 0) {
          const first = result.skippedDetails[0];
          const matchedBy = Array.isArray(first?.matchedBy) ? first.matchedBy.join(', ') : '';
          const label = matchedBy ? `مطابق: ${matchedBy}` : 'مطابق';
          message += ` مثال: ${first?.name || 'بدون اسم'} (#${first?.existingId || '?'}) - ${label}`;
        }

        showToast(message, result.failed === 0 ? 'success' : 'warning');
        scheduleProductsReload();
      }

      if (payload.status === 'failed') {
        showToast(`فشل استيراد المنتجات: ${payload.error || 'خطأ غير معروف'}`, 'error');
      }
    };

    socket.off('bulk_import_job', handler);
    socket.on('bulk_import_job', handler);

    return () => {
      socket.off('bulk_import_job', handler);
    };
  }, [currentUser, showToast, bufferBulkImportJobUpdate, scheduleProductsReload]);

  useEffect(() => {
    if (!currentUser) return;

    const activeJobIds = bulkImportJobsForUser
      .filter((j: any) => j?.status === 'queued' || j?.status === 'processing' || j?.status === 'running')
      .map((j: any) => j.id)
      .filter(Boolean);

    if (activeJobIds.length === 0) return;

    let cancelled = false;

    const refresh = async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const results = await Promise.all(
          activeJobIds.map(async (jobId) => {
            try {
              const res = await fetchBulkImportJob(String(jobId), token);
              return res?.job;
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;
        for (const job of results) {
          if (job?.id) bufferBulkImportJobUpdate(job);
        }
      } catch {}
    };

    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bulkImportJobsForUser, currentUser, getAuthToken, bufferBulkImportJobUpdate]);

  const handlePasteImport = async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    try {
      const data = JSON.parse(importText);
      const productsToImport = data.products || (Array.isArray(data) ? data : []);
      
      if (productsToImport.length === 0) {
        showToast('لا توجد منتجات للاستيراد', 'error');
        return;
      }

      const token = getAuthToken();
      const queued = await enqueueBulkImportProducts(productsToImport, token);

      const jobId = queued?.job?.id;
      const total = queued?.job?.total || productsToImport.length;
      if (queued?.job) bufferBulkImportJobUpdate(queued.job);
      showToast(`تم إرسال ${total} منتج للمعالجة في الخلفية.${jobId ? ` رقم المهمة: ${jobId}` : ''}`, 'success');
      setImportText('');
    } catch (error) {
      console.error('Bulk import error:', error);
      const msg = String((error as any)?.message || '');
      if (msg.includes('Unauthorized') || msg.includes('Authentication required') || msg.includes('Invalid or expired token')) {
        showToast('انتهت الجلسة أو لا تملك صلاحية الاستيراد. يرجى تسجيل الدخول كمسؤول.', 'error');
      } else if (error instanceof SyntaxError) {
        showToast(`خطأ في تنسيق JSON: ${msg}`, 'error');
      } else {
        showToast(`فشل استيراد المنتجات: ${msg}`, 'error');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateProduct = async (id: number | string, data: any) => {
    try {
      const token = getAuthToken();
      await updateProduct(id, data, token);
      
      // Update local state immediately
      setProducts(prev => prev.map(p => 
        (p.id || p.productId) === id ? { ...p, ...data } : p
      ));
      
      showToast('تم تحديث المنتج بنجاح', 'success');
      if (!String(id).startsWith('local-')) {
        loadData(currentPage, true, false, true);
      }
    } catch (error) {
      showToast('فشل تحديث المنتج', 'error');
    }
  };

  const handleUpdateOptions = async (id: number | string, newOptions: any[], newVariants: any[]) => {
    try {
      const token = getAuthToken();
      await saveProductOptions(id, newOptions, newVariants, token);
      
      // Update local state immediately for instant feedback
      setProducts(prev => prev.map(p => 
        (p.id || p.productId) === id 
          ? { ...p, options: newOptions, variants: newVariants } 
          : p
      ));
      
      showToast('تم تحديث خيارات المنتج بنجاح', 'success');
      // Still loadData to ensure sync with any backend changes if it's a server product
      if (!String(id).startsWith('local-')) {
        loadData(currentPage, true, false, true);
      }
    } catch (error) {
      console.error('Failed to update options:', error);
      showToast('فشل تحديث خيارات المنتج', 'error');
    }
  };

  const handleDeleteProduct = async (id: number | string) => {
     const isDraft = String(id).startsWith('local-');
     if (!isDraft && !window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
     
     try {
       if (isDraft) {
         localProductService.deleteDraft(String(id));
         // Update state immediately for instant feedback
         setProducts(prev => prev.filter(p => (p.id || p.productId) !== id));
         setTotalItems(prev => prev - 1);
         showToast('تم حذف المسودة بنجاح', 'success');
         // No need to loadData() for local drafts if we update state directly
       } else {
         const token = getAuthToken();
         await deleteProduct(id, token);
         showToast('تم حذف المنتج بنجاح', 'success');
         loadData(currentPage, true, false, true);
       }
     } catch (error) {
       showToast('فشل حذف المنتج', 'error');
     }
   };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    
    // Only confirm for server products, drafts are deleted right away
    const serverProducts = selectedProducts.filter(id => !String(id).startsWith('local-'));
    
    if (serverProducts.length > 0 && !window.confirm(`هل أنت متأكد من حذف ${serverProducts.length} منتجات؟`)) return;
    
    try {
      const token = getAuthToken();
      console.log('[AdminDashboard] Bulk deleting products:', selectedProducts);
      await bulkDeleteProducts(selectedProducts, token);
      
      // Update state immediately for instant feedback
      setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id || p.productId)));
      setTotalItems(prev => prev - selectedProducts.length);
      
      showToast('تم حذف المنتجات بنجاح', 'success');
      setSelectedProducts([]);
      loadData(currentPage, true, false, true);
    } catch (error: any) {
      console.error('[AdminDashboard] Bulk delete error:', error);
      showToast(`فشل حذف المنتجات: ${error.message || 'خطأ غير معروف'}`, 'error');
    }
  };

  const handleBulkPublish = async () => {
    if (selectedProducts.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من نشر ${selectedProducts.length} منتجات؟`)) return;
    
    try {
      const token = getAuthToken();
      const localDraftIds = selectedProducts.filter(id => String(id).startsWith('local-'));
      const serverProductIds = selectedProducts.filter(id => !String(id).startsWith('local-'));
      
      // 1. Publish server products (existing ones that were DRAFT status on server)
      if (serverProductIds.length > 0) {
        await bulkPublishProducts(serverProductIds.map(id => Number(id)), token);
      }
      
      // 2. Create local drafts on server
      if (localDraftIds.length > 0) {
        const localDraftsData = products.filter(p => localDraftIds.includes(p.id));
        await bulkCreateProducts(localDraftsData, token);
        
        // Remove from local storage after successful server creation
        localDraftIds.forEach(id => {
          localProductService.deleteDraft(String(id));
        });
      }

      showToast('تم نشر المنتجات بنجاح', 'success');
      setSelectedProducts([]);
      loadData(currentPage, true, false, true);
    } catch (error: any) {
      console.error('Bulk publish error:', error);
      showToast(`فشل نشر المنتجات المختارة: ${error.message || 'خطأ'}`, 'error');
    }
  };

  const handlePriceUpdate = async (item: any) => {
    const newPrice = parseFloat(tempPrice);
    if (isNaN(newPrice)) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      const token = getAuthToken();
      await updateProductPrice({
          productId: item.productId || item.product?.id,
          variantId: item.variantId || item.variant?.id,
          newPrice: newPrice
      }, token);
      showToast('تم تحديث سعر المنتج بنجاح', 'success');
      setEditingPriceId(null);
      
      // Update local state for immediate feedback
      if (selectedOrder) {
        const updatedItems = selectedOrder.items.map((i: any) => 
          i.id === item.id ? { ...i, price: newPrice } : i
        );
        setSelectedOrder({ ...selectedOrder, items: updatedItems });
      }
      loadData(currentPage, true);
    } catch (error) {
      console.error('Price update error:', error);
      showToast('فشل تحديث السعر', 'error');
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getAuthToken();
      if (selectedCoupon) {
        await updateCoupon(selectedCoupon.id, couponFormData, token);
        showToast('تم تحديث الخصم بنجاح', 'success');
      } else {
        await createCoupon(couponFormData, token);
        showToast('تم إنشاء الخصم بنجاح', 'success');
      }
      setShowCouponModal(false);
      loadData(currentPage, true);
    } catch (error) {
      showToast('فشل حفظ الخصم', 'error');
    }
  };

  const handleDeleteCoupon = async (id: number | string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخصم؟')) return;
    try {
      const token = getAuthToken();
      await deleteCoupon(id, token);
      showToast('تم حذف الخصم بنجاح', 'success');
      loadData(currentPage, true);
    } catch (error) {
      showToast('فشل حذف الخصم', 'error');
    }
  };

  const openCouponModal = (coupon: any = null) => {
    if (coupon) {
      setSelectedCoupon(coupon);
      setCouponFormData({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue.toString(),
        minOrderAmount: coupon.minOrderAmount.toString(),
        maxDiscount: coupon.maxDiscount?.toString() || '',
        endDate: new Date(coupon.endDate).toISOString().split('T')[0],
        usageLimit: coupon.usageLimit?.toString() || '',
        isPublic: coupon.isPublic
      });
    } else {
      setSelectedCoupon(null);
      setCouponFormData({
        code: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        minOrderAmount: '',
        maxDiscount: '',
        endDate: '',
        usageLimit: '',
        isPublic: true
      });
    }
    setShowCouponModal(true);
  };

  const handleUpdateOrderStatus = async (orderId: number | string, status: string) => {
    try {
      const token = getAuthToken();
      await updateOrderStatus(orderId, status, token);
      showToast('تم تحديث حالة الطلب بنجاح', 'success');
      loadData(currentPage, true);
    } catch (error) {
      showToast('فشل تحديث حالة الطلب', 'error');
    }
  };

  const handleUpdateInternationalFee = async (orderId: number | string, fee: string) => {
    const numericFee = parseFloat(fee);
    if (isNaN(numericFee)) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      const token = getAuthToken();
      const updatedOrder = await updateOrderInternationalFee(orderId, numericFee, token);
      
      if (updatedOrder.status !== selectedOrder?.status && updatedOrder.status === 'AWAITING_PAYMENT') {
        showToast('تم تحديث رسوم الشحن وتغيير حالة الطلب إلى بانتظار الدفع', 'success');
      } else {
        showToast('تم تحديث رسوم الشحن بنجاح', 'success');
      }
      
      // Update local state for immediate feedback
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updatedOrder);
      }
      
      setOrders(prevOrders => prevOrders.map(order => 
        order.id === orderId ? updatedOrder : order
      ));
      
      loadData(currentPage, true);
    } catch (error) {
      showToast('فشل تحديث رسوم الشحن', 'error');
    }
  };



  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      const token = getAuthToken();
      await updateUserRole(userId, newRole, token);
      showToast('تم تحديث الرتبة بنجاح', 'success');
      loadData(currentPage, true);
    } catch (error) {
      showToast('فشل تحديث الرتبة', 'error');
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = getAuthToken();
      await updateSettings(storeSettings, token);
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('فشل حفظ الإعدادات', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const checkPermission = (_permission: string) => true;

  const renderStats = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">نظرة عامة</h2>
          <p className="text-slate-500 text-sm mt-1">متابعة أداء المتجر والإحصائيات الحالية</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all">
            <Calendar size={18} />
            آخر 30 يوم
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all">
            <Download size={18} />
            تصدير التقرير
          </button>
        </div>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <ProductPerformance products={products} />
        <BestSellers products={products} onViewAll={() => {}} />
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">المنتجات</h2>
          <p className="text-slate-500 text-sm mt-1">إدارة المخزون والأسعار والخصومات</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowImportModal(true)}
            disabled={isImporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {isImporting ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
            ) : (
              <Plus size={20} />
            )}
            <span className="whitespace-nowrap">استيراد بالجملة</span>
          </button>
          <button 
            onClick={() => {
              setEditingProductId(null);
              setShowProductEditor(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all"
          >
            <Plus size={20} />
            <span className="whitespace-nowrap">إضافة منتج</span>
          </button>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[95vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col pt-safe pb-safe">
            <div className="p-4 sm:p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">استيراد المنتجات بالجملة</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">قم بلصق بيانات JSON للمنتجات هنا</p>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePasteImport();
                  }
                }}
                placeholder='{"products": [...] }'
                className="w-full h-48 sm:h-64 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-left font-mono text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={handlePasteImport}
                  disabled={isImporting || !importText.trim()}
                  className="flex-1 bg-primary text-white py-3.5 sm:py-4 rounded-2xl font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {isImporting ? 'جاري الإرسال...' : 'بدء الاستيراد'}
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-8 py-3.5 sm:py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
              </div>

              {bulkImportJobsForUser.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">مهام الاستيراد</div>
                      <div className="text-xs text-slate-500 mt-1">تحديث مباشر أثناء المعالجة في الخلفية</div>
                    </div>
                    <button
                      onClick={() =>
                        setBulkImportJobs((prev) => {
                          const next: Record<string, any> = { ...prev };
                          for (const job of bulkImportJobsForUser) {
                            if (job?.status === 'completed' || job?.status === 'failed') {
                              delete next[job.id];
                            }
                          }
                          return next;
                        })
                      }
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all"
                    >
                      مسح المنتهية
                    </button>
                  </div>

                  <div className="space-y-3 mt-4">
                    {bulkImportJobsForUser.map((job: any) => {
                      const total = Number(job?.total || 0) || 0;
                      const processed = Number(job?.processed || 0) || 0;
                      const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((processed / total) * 100))) : 0;
                      const status = String(job?.status || '');
                      const statusLabel =
                        status === 'queued'
                          ? 'في الانتظار'
                          : status === 'processing' || status === 'running'
                            ? 'قيد المعالجة'
                            : status === 'completed'
                              ? 'مكتملة'
                              : status === 'failed'
                                ? 'فشلت'
                                : status;
                      const statusClass =
                        status === 'completed'
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                          : status === 'failed'
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

                      return (
                        <div
                          key={job.id}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              {job?.id ? `#${String(job.id).slice(0, 10)}` : 'مهمة'}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass}`}>{statusLabel}</div>
                          </div>

                          <div className="mt-3">
                            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {processed}/{total || '?'}
                              </span>
                              <span>{percent}%</span>
                            </div>
                          </div>

                          {status === 'failed' && job?.error && (
                            <div className="mt-2 text-xs font-bold text-red-600 dark:text-red-300">{String(job.error)}</div>
                          )}

                          {status === 'completed' && job?.results && (
                            <div className="mt-2 text-xs font-bold text-green-700 dark:text-green-300">
                              تم استيراد {job.results.imported || 0} • تم تخطي {job.results.skipped || 0} • فشل {job.results.failed || 0}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 flex-1 md:flex-none">
            <input 
              type="checkbox" 
              checked={products.length > 0 && selectedProducts.length === products.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedProducts(products.map(p => p.id));
                } else {
                  setSelectedProducts([]);
                }
              }}
              className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-bold text-slate-500">الكل</span>
          </div>
          
          <button 
            onClick={() => {
              const drafts = products.filter(p => p.status === 'DRAFT').map(p => p.id);
              setSelectedProducts(drafts);
            }}
            className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex-1 md:flex-none"
          >
            تحديد المسودات
          </button>
        </div>

        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData(1)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pr-12 pl-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button 
            onClick={() => loadData(1)}
            className="px-6 py-3.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all"
          >
            بحث
          </button>
          <button className="px-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            isSelected={selectedProducts.includes(product.id)}
            onToggleSelection={(id) => {
              setSelectedProducts((prev) => 
                prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
              );
            }}
            onUpdateStatus={handleUpdateProduct}
            onUpdateOptions={handleUpdateOptions}
            onEdit={(product) => {
              setEditingProductId(product.id);
              setShowProductEditor(true);
            }} 
            onDelete={handleDeleteProduct} 
            onImportReviews={() => {}}
            onAddPictures={() => {}}
            checkPermission={checkPermission}
            rates={{
              airRate: storeSettings.airShippingRate,
              seaRate: storeSettings.seaShippingRate,
              minFloor: storeSettings.airShippingMinFloor
            }}
          />
        ))}
      </div>

      {/* Infinite Scroll Loader */}
      {(isLoadingMore || currentPage < totalPages) && (
        <div ref={loaderRef} className="py-8 flex justify-center w-full">
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل المزيد...</p>
            </div>
          ) : (
            <div className="h-8" />
          )}
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedProducts.length > 0 && (
        <div className="fixed bottom-6 sm:bottom-8 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 duration-300">
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-8 border border-slate-800">
            <div className="flex items-center gap-3 sm:border-l sm:border-slate-700 sm:pl-8 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-black">
                  {selectedProducts.length}
                </span>
                <span className="text-sm font-bold">منتجات مختارة</span>
              </div>
              <button 
                onClick={() => setSelectedProducts([])}
                className="sm:hidden text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                إلغاء
              </button>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button 
                onClick={() => setSelectedProducts([])}
                className="hidden sm:block text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                إلغاء التحديد
              </button>
              
              <button 
                onClick={handleBulkPublish}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 size={18} />
                <span className="whitespace-nowrap">نشر</span>
              </button>

              <button 
                onClick={handleBulkDelete}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-500/20"
              >
                <Trash2 size={18} />
                <span className="whitespace-nowrap">حذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCoupons = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">إدارة الخصومات والكوبونات</h2>
          <p className="text-slate-500 text-sm mt-1">إنشاء وإدارة أكواد الخصم للمتجر</p>
        </div>
        <button 
          onClick={() => openCouponModal()}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all w-full sm:w-auto"
        >
          <Plus size={20} />
          <span className="whitespace-nowrap">إضافة كوبون جديد</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <table className="w-full text-right min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">الكود</th>
                <th className="px-6 py-4">النوع</th>
                <th className="px-6 py-4">القيمة</th>
                <th className="px-6 py-4">الحد الأدنى للطلب</th>
                <th className="px-6 py-4">النوع (عام/خاص)</th>
                <th className="px-6 py-4">الاستخدام</th>
                <th className="px-6 py-4">تاريخ الانتهاء</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      {coupon.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold">
                    {coupon.discountType === 'PERCENTAGE' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-primary">
                    {coupon.discountValue} {coupon.discountType === 'PERCENTAGE' ? '%' : 'د.ع'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold">
                    {coupon.minOrderAmount.toLocaleString()} د.ع
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${coupon.isPublic ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {coupon.isPublic ? 'عام (مرة لكل مستخدم)' : 'خاص (مرة واحدة)'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="font-bold text-slate-900 dark:text-white">{coupon.usageCount}</span>
                    {coupon.usageLimit && <span className="text-slate-400"> / {coupon.usageLimit}</span>}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">
                    {new Date(coupon.endDate).toLocaleDateString('ar-IQ')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${coupon.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {coupon.isActive ? 'نشط' : 'متوقف'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openCouponModal(coupon)}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCouponModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[95vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col pt-safe pb-safe">
            <div className="p-4 sm:p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {selectedCoupon ? 'تعديل كوبون' : 'إضافة كوبون جديد'}
              </h3>
              <button onClick={() => setShowCouponModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCoupon} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">كود الكوبون</label>
                <input 
                  type="text"
                  required
                  value={couponFormData.code}
                  onChange={(e) => setCouponFormData({...couponFormData, code: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="مثال: SAVE20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">نوع الخصم</label>
                  <select 
                    value={couponFormData.discountType}
                    onChange={(e) => setCouponFormData({...couponFormData, discountType: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="PERCENTAGE">نسبة مئوية</option>
                    <option value="FIXED">مبلغ ثابت</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">القيمة</label>
                  <input 
                    type="number"
                    required
                    value={couponFormData.discountValue}
                    onChange={(e) => setCouponFormData({...couponFormData, discountValue: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">الحد الأدنى للطلب</label>
                  <input 
                    type="number"
                    required
                    value={couponFormData.minOrderAmount}
                    onChange={(e) => setCouponFormData({...couponFormData, minOrderAmount: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">تاريخ الانتهاء</label>
                  <input 
                    type="date"
                    required
                    value={couponFormData.endDate}
                    onChange={(e) => setCouponFormData({...couponFormData, endDate: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">النوع</label>
                  <select 
                    value={couponFormData.isPublic ? 'true' : 'false'}
                    onChange={(e) => setCouponFormData({...couponFormData, isPublic: e.target.value === 'true'})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="true">عام (لكل مستخدم مرة)</option>
                    <option value="false">خاص (مرة واحدة فقط)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 mb-2 uppercase">حد الاستخدام</label>
                  <input 
                    type="number"
                    value={couponFormData.usageLimit}
                    onChange={(e) => setCouponFormData({...couponFormData, usageLimit: e.target.value})}
                    placeholder="اختياري"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 transition-all order-2 sm:order-1"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all order-1 sm:order-2"
                >
                  {selectedCoupon ? 'تحديث' : 'إنشاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">المستخدمين</h2>
          <p className="text-slate-500 text-sm mt-1">إدارة صلاحيات المستخدمين والبيانات الشخصية</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="ابحث بالاسم، الهاتف، أو البريد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData(1)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pr-11 pl-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <button 
          onClick={() => loadData(1)}
          className="px-6 py-3.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all w-full sm:w-auto"
        >
          بحث
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <table className="w-full text-right min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-wider">
              <th className="px-6 py-4">المستخدم</th>
              <th className="px-6 py-4">معلومات الاتصال</th>
              <th className="px-6 py-4 text-center">الرتبة</th>
              <th className="px-6 py-4">تاريخ الانضمام</th>
              <th className="px-6 py-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {u.name?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{u.name || 'مستخدم جديد'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">ID: #{u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{u.email || 'لا يوجد بريد'}</p>
                  <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{u.phone || '-'}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleRoleUpdate(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${
                      u.role === 'ADMIN' 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {u.role}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-500 font-medium">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-IQ') : '-'}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-primary transition-all">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      {/* Infinite Scroll Loader */}
      {(isLoadingMore || currentPage < totalPages) && (
        <div ref={loaderRef} className="py-8 flex justify-center w-full">
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل المزيد...</p>
            </div>
          ) : (
            <div className="h-8" />
          )}
        </div>
      )}
    </div>
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'قيد المراجعة', class: 'bg-slate-100 text-slate-600' };
      case 'AWAITING_PAYMENT':
        return { label: 'بانتظار الدفع', class: 'bg-amber-100 text-amber-600' };
      case 'PREPARING':
        return { label: 'قيد التجهيز', class: 'bg-indigo-100 text-indigo-600' };
      case 'SHIPPED':
        return { label: 'تم الشحن', class: 'bg-blue-100 text-blue-600' };
      case 'ARRIVED_IRAQ':
        return { label: 'وصل إلى العراق', class: 'bg-cyan-100 text-cyan-600' };
      case 'DELIVERED':
        return { label: 'تم التسليم بنجاح', class: 'bg-emerald-100 text-emerald-600' };
      case 'CANCELLED':
        return { label: 'ملغي', class: 'bg-rose-100 text-rose-600' };
      default:
        return { label: status, class: 'bg-slate-100 text-slate-600' };
    }
  };

  const renderOrderDetailsModal = () => {
    if (!selectedOrder) return null;

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-900 w-full max-w-[95vw] lg:max-w-7xl max-h-[95vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col pt-safe pb-safe">
          {/* Modal Header */}
          <div className="p-4 sm:p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">تفاصيل الطلب #{selectedOrder.id}</h3>
                <span className={`w-fit px-3 py-1 rounded-full text-[10px] font-black ${getStatusConfig(selectedOrder.status).class}`}>
                  {getStatusConfig(selectedOrder.status).label}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                تم الطلب في {new Date(selectedOrder.createdAt).toLocaleString('ar-IQ')}
              </p>
            </div>
            <button 
              onClick={() => setShowOrderModal(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-8">
            {modalLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold">جاري تحميل تفاصيل الطلب...</p>
              </div>
            ) : (
              <>
                {/* Customer & Shipping Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800">
                <h4 className="font-black text-xs sm:text-sm mb-4 flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  معلومات العميل
                </h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <p><span className="text-slate-500">الاسم:</span> <span className="font-bold">{selectedOrder.user?.name || 'مستخدم'}</span></p>
                  <p><span className="text-slate-500">الهاتف:</span> <span className="font-bold">{selectedOrder.address?.phone || '-'}</span></p>
                  <p><span className="text-slate-500">البريد:</span> <span className="font-bold">{selectedOrder.user?.email || '-'}</span></p>
                  <p>
                    <span className="text-slate-500">طريقة الدفع:</span> 
                    <span className="font-bold text-primary mr-1">
                      {selectedOrder.paymentMethod === 'credit_card' ? 'بطاقة ائتمان' :
                       selectedOrder.paymentMethod === 'cash' ? 'دفع نقدي' :
                       selectedOrder.paymentMethod === 'zain_cash' ? 'زين كاش' : 
                       selectedOrder.paymentMethod === 'super_key' ? 'سوبر كي' : (selectedOrder.paymentMethod || '---')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800">
                <h4 className="font-black text-xs sm:text-sm mb-4 flex items-center gap-2">
                  <Package size={16} className="text-primary" />
                  عنوان الشحن
                </h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <p><span className="text-slate-500">المدينة:</span> <span className="font-bold">{selectedOrder.address?.city || '-'}</span></p>
                  <p><span className="text-slate-500">الشارع:</span> <span className="font-bold">{selectedOrder.address?.street || '-'}</span></p>
                  <p><span className="text-slate-500">البناية/الطابق:</span> <span className="font-bold">{selectedOrder.address?.buildingNo || '-'}{selectedOrder.address?.floorNo ? ` / ${selectedOrder.address.floorNo}` : ''}</span></p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-xs sm:text-sm flex items-center gap-2">
                  <ShoppingCart size={16} className="text-primary" />
                  المنتجات المطلوبة ({selectedOrder.items?.length || 0})
                </h4>
                <button
                  onClick={() => setShowOriginalOptions(!showOriginalOptions)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    showOriginalOptions 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                      : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <Globe size={12} />
                  {showOriginalOptions ? 'إخفاء الأصل' : 'عرض الأصل'}
                </button>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-right text-xs sm:text-sm min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase">
                      <tr>
                        <th className="px-4 py-3 text-right">المنتج</th>
                        <th className="px-4 py-3 text-right">الاختيارات</th>
                        <th className="px-4 py-3 text-center">طريقة الشحن</th>
                        <th className="px-4 py-3 text-center">الكمية</th>
                        <th className="px-4 py-3 text-right">السعر</th>
                        <th className="px-4 py-3 text-right">الإجمالي</th>
                        <th className="px-4 py-3 text-center">الرابط</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {selectedOrder.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => setPreviewImage(item.variant?.image || item.product?.image)}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                <LazyImage 
                                  src={item.variant?.image || item.product?.image} 
                                  alt={item.product?.name} 
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                                  isThumbnail={true}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold truncate lg:max-w-none">{item.product?.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">#{item.product?.id || item.productId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {(item.variant && item.variant.combination || item.selectedOptions) && (
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  try {
                                    const combination = item.selectedOptions 
                                      ? (typeof item.selectedOptions === 'string' ? JSON.parse(item.selectedOptions) : item.selectedOptions)
                                      : (item.variant && typeof item.variant.combination === 'string' 
                                        ? JSON.parse(item.variant.combination) 
                                        : item.variant?.combination);
                                    
                                    if (!combination || Object.keys(combination).length === 0) {
                                      const rawCombination = item.selectedOptions || item.variant?.combination;
                                      if (!rawCombination) return null;
                                      return (
                                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                          {String(rawCombination)}
                                        </span>
                                      );
                                    }

                                    return Object.entries(combination).map(([key, value]) => {
                                      let originalValue = null;
                                      if (showOriginalOptions && item.product?.options) {
                                        const opt = item.product.options.find((o: any) => o.name === key || (o.name === 'اللون' && key === 'Color') || (o.name === 'المقاس' && key === 'Size'));
                                        if (opt && opt.values && opt.originalValues) {
                                          try {
                                            const vals = JSON.parse(opt.values);
                                            const origVals = JSON.parse(opt.originalValues);
                                            const idx = vals.indexOf(String(value));
                                            if (idx !== -1 && origVals[idx]) {
                                              originalValue = origVals[idx];
                                            }
                                          } catch (e) {}
                                        }
                                      }

                                      return (
                                        <span key={key} className="flex flex-col gap-0.5 text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                          <span>{key}: {String(value)}</span>
                                          {originalValue && <span className="text-emerald-600 font-bold">{originalValue}</span>}
                                        </span>
                                      );
                                    });
                                  } catch (e) {
                                    const rawCombination = item.selectedOptions || item.variant?.combination;
                                    if (!rawCombination) return null;
                                    return (
                                      <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                        {String(rawCombination)}
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            {!item.variant && !item.selectedOptions && (
                              <span className="text-slate-400 text-[10px]">منتج أساسي</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              item.shippingMethod === 'sea' 
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {item.shippingMethod === 'sea' ? 'بحري' : 'جوي'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-bold">
                            {item.quantity}
                          </td>
                          <td 
                            className="px-4 py-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors select-none"
                            onDoubleClick={() => {
                              setEditingPriceId(item.id);
                              setTempPrice(item.price.toString());
                            }}
                            title="انقر مرتين لتعديل السعر"
                          >
                            {editingPriceId === item.id ? (
                              <input
                                autoFocus
                                type="number"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(e.target.value)}
                                onBlur={() => handlePriceUpdate(item)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePriceUpdate(item);
                                  if (e.key === 'Escape') setEditingPriceId(null);
                                }}
                                className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border-2 border-primary rounded-lg outline-none text-center text-sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>{item.price.toLocaleString()} د.ع</span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-bold text-primary">
                            {(item.price * item.quantity).toLocaleString()} د.ع
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Internal App Link */}
                              <a 
                                href={`/product?id=${item.product?.id || item.productId}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:scale-110 transition-all"
                                title="عرض في التطبيق"
                              >
                                <Eye size={16} />
                              </a>

                              {/* External 1688 Link */}
                              {item.product?.purchaseUrl ? (
                                <a 
                                  href={item.product.purchaseUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg hover:scale-110 transition-all"
                                  title="رابط شراء المنتج (1688)"
                                >
                                  <ArrowLeft size={16} className="rotate-[135deg]" />
                                </a>
                              ) : (
                                <span className="text-slate-300 text-[10px]">لا يوجد رابط 1688</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="flex justify-end">
              <div className="w-full sm:w-80 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-500 font-bold">المجموع الفرعي:</span>
                  <span className="font-black">
                    {selectedOrder.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0).toLocaleString()} د.ع
                  </span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-green-600 dark:text-green-400 font-bold">
                    <span>الخصم:</span>
                    <span>- {selectedOrder.discountAmount.toLocaleString()} د.ع</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-500 font-bold">رسوم الشحن الدولي:</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      defaultValue={selectedOrder.internationalShippingFee || ''}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        if (val !== (selectedOrder.internationalShippingFee || 0)) {
                          handleUpdateInternationalFee(selectedOrder.id, val.toString());
                        }
                      }}
                      className="w-24 sm:w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-black text-blue-600 focus:ring-1 focus:ring-primary/50 outline-none transition-all text-left"
                    />
                    <span className="text-[10px] font-bold text-slate-400">د.ع</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-black text-sm sm:text-base">الإجمالي الكلي:</span>
                  <span className="font-black text-lg sm:text-xl text-primary">{selectedOrder.total.toLocaleString()} د.ع</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Footer */}
          <div className="p-4 sm:p-6 border-t border-slate-50 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowOrderModal(false)}
              className="flex-1 py-3.5 sm:py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 transition-all order-2 sm:order-1"
            >
              إغلاق
            </button>
            <button
              onClick={() => {
                window.print();
              }}
              className="px-8 py-3.5 sm:py-4 bg-primary/10 text-primary rounded-2xl font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <Download size={20} />
              طباعة
            </button>
          </div>
          {/* Image Preview Modal */}
          {previewImage && (
            <div 
              className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
                >
                  <X size={24} />
                </button>
                <img 
                  src={previewImage} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">الطلبات</h2>
          <p className="text-slate-500 text-sm mt-1">متابعة حالة الطلبات والشحن والمدفوعات</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="ابحث برقم الطلب، اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData(1)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pr-12 pl-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <button 
          onClick={() => loadData(1)}
          className="px-6 py-3.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all w-full sm:w-auto"
        >
          بحث
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <table className="w-full text-right min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-wider">
              <th className="px-6 py-4">رقم الطلب</th>
              <th className="px-6 py-4">العميل</th>
              <th className="px-6 py-4">التاريخ</th>
              <th className="px-6 py-4">طريقة الدفع</th>
              <th className="px-6 py-4">المبلغ الإجمالي</th>
              <th className="px-6 py-4">رسوم الشحن (د.ع)</th>
              <th className="px-6 py-4 text-center">الحالة</th>
              <th className="px-6 py-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-black text-sm text-slate-900 dark:text-white">
                  #{order.id}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">
                      {order.user?.name?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{order.user?.name || 'مستخدم'}</p>
                      <p className="text-[10px] text-slate-400">{order.address?.phone || '-'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock size={14} />
                    <span>{new Date(order.createdAt).toLocaleDateString('ar-IQ')}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {order.paymentMethod === 'credit_card' ? 'بطاقة ائتمان' :
                   order.paymentMethod === 'cash' ? 'دفع نقدي' :
                   order.paymentMethod === 'zain_cash' ? 'زين كاش' : 
                   order.paymentMethod === 'super_key' ? 'سوبر كي' : (order.paymentMethod || '---')}
                </td>
                <td className="px-6 py-4 font-black text-primary">
                  {(order.total || 0).toLocaleString()} د.ع
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      defaultValue={order.internationalShippingFee || ''}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        if (val !== (order.internationalShippingFee || 0)) {
                          handleUpdateInternationalFee(order.id, val.toString());
                        }
                      }}
                      className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    />
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <select 
                    value={order.status}
                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black border-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all ${getStatusConfig(order.status).class}`}
                  >
                    <option value="PENDING">قيد المراجعة</option>
                    <option value="AWAITING_PAYMENT">بانتظار الدفع</option>
                    <option value="PREPARING">قيد التجهيز</option>
                    <option value="SHIPPED">تم الشحن</option>
                    <option value="ARRIVED_IRAQ">وصل إلى العراق</option>
                    <option value="DELIVERED">تم التسليم بنجاح</option>
                    <option value="CANCELLED">ملغي</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={async () => {
                        try {
                          setModalLoading(true);
                          setSelectedOrder(order);
                          setShowOrderModal(true);
                          const token = getAuthToken();
                          const fullOrder = await fetchAdminOrderDetails(order.id, token);
                          setSelectedOrder(fullOrder);
                        } catch (error) {
                          showToast('فشل تحميل تفاصيل الطلب', 'error');
                        } finally {
                          setModalLoading(false);
                        }
                      }}
                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-500 transition-all" 
                      title="عرض التفاصيل"
                    >
                      <Eye size={18} />
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-all">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {orders.length === 0 && (
          <div className="py-20 text-center">
            <ShoppingCart className="mx-auto mb-4 text-slate-200" size={48} />
            <h3 className="text-lg font-black text-slate-400">لا توجد طلبات حالياً</h3>
          </div>
        )}
      </div>
      {/* Infinite Scroll Loader */}
      {(isLoadingMore || currentPage < totalPages) && (
        <div ref={loaderRef} className="py-8 flex justify-center w-full">
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل المزيد...</p>
            </div>
          ) : (
            <div className="h-8" />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-lg font-black text-slate-900 dark:text-white">جاري تحضير البيانات</p>
            <p className="text-sm text-slate-500 mt-1 animate-pulse">يرجى الانتظار قليلاً...</p>
          </div>
        </div>
      ) : (
        <Routes>
          <Route index element={renderStats()} />
          <Route path="products" element={renderProducts()} />
          <Route path="users" element={renderUsers()} />
          <Route path="orders" element={renderOrders()} />
          <Route path="coupons" element={renderCoupons()} />
          <Route path="settings" element={
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">إعدادات النظام</h2>
                  <p className="text-slate-500 text-sm mt-1">التحكم في أسعار الشحن ومعلومات المتجر</p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-8 py-3.5 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Save size={20} />
                  )}
                  حفظ التغييرات
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Shipping Rates Settings */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Truck size={24} />
                    </div>
                    <h3 className="text-lg font-black">إعدادات تكاليف الشحن الدولي</h3>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Plane size={16} className="text-blue-500" />
                        سعر الشحن الجوي (لكل 1 كجم)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={storeSettings.airShippingRate}
                          onChange={(e) => setStoreSettings({...storeSettings, airShippingRate: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-black text-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-400">د.ع</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">سيتم حساب الشحن الجوي بناءً على الوزن الفعلي فقط.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Plane size={16} className="text-blue-500" />
                        الحد الأدنى لتكلفة الشحن الجوي
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={storeSettings.airShippingMinFloor}
                          onChange={(e) => setStoreSettings({...storeSettings, airShippingMinFloor: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-black text-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-400">د.ع</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">أقل مبلغ يتم احتسابه لأي طرد مشحون جوياً.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Waves size={16} className="text-cyan-500" />
                        سعر الشحن البحري (لكل 1 CBM)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={storeSettings.seaShippingRate}
                          onChange={(e) => setStoreSettings({...storeSettings, seaShippingRate: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-black text-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-400">د.ع</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">سيتم حساب الشحن البحري بناءً على حجم الطرد (CBM) فقط.</p>
                    </div>
                  </div>
                </div>

                {/* General Settings */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Settings size={24} />
                    </div>
                    <h3 className="text-lg font-black">معلومات المتجر العامة</h3>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم المتجر</label>
                      <input
                        type="text"
                        value={storeSettings.storeName}
                        onChange={(e) => setStoreSettings({...storeSettings, storeName: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رقم الهاتف</label>
                        <input
                          type="text"
                          value={storeSettings.contactPhone}
                          onChange={(e) => setStoreSettings({...storeSettings, contactPhone: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">البريد الإلكتروني</label>
                        <input
                          type="email"
                          value={storeSettings.contactEmail}
                          onChange={(e) => setStoreSettings({...storeSettings, contactEmail: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">العملة الافتراضية</label>
                      <input
                        type="text"
                        value={storeSettings.currency}
                        onChange={(e) => setStoreSettings({...storeSettings, currency: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">نص أسفل الصفحة (Footer)</label>
                      <textarea
                        value={storeSettings.footerText}
                        onChange={(e) => setStoreSettings({...storeSettings, footerText: e.target.value})}
                        rows={3}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Links Settings */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                      <Share2 size={24} />
                    </div>
                    <h3 className="text-lg font-black">روابط التواصل الاجتماعي</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">فيسبوك (Facebook)</label>
                        <input
                          type="text"
                          placeholder="https://facebook.com/..."
                          value={storeSettings.socialLinks.facebook}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings, 
                            socialLinks: { ...storeSettings.socialLinks, facebook: e.target.value }
                          })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">إنستغرام (Instagram)</label>
                        <input
                          type="text"
                          placeholder="https://instagram.com/..."
                          value={storeSettings.socialLinks.instagram}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings, 
                            socialLinks: { ...storeSettings.socialLinks, instagram: e.target.value }
                          })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">واتساب (WhatsApp)</label>
                        <input
                          type="text"
                          placeholder="+964..."
                          value={storeSettings.socialLinks.whatsapp}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings, 
                            socialLinks: { ...storeSettings.socialLinks, whatsapp: e.target.value }
                          })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">تيليجرام (Telegram)</label>
                        <input
                          type="text"
                          placeholder="https://t.me/..."
                          value={storeSettings.socialLinks.telegram}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings, 
                            socialLinks: { ...storeSettings.socialLinks, telegram: e.target.value }
                          })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          } />
        </Routes>
      )}
      {showOrderModal && renderOrderDetailsModal()}
      {showProductEditor && (
        <ProductEditor 
          productId={editingProductId}
          storeSettings={storeSettings}
          onClose={() => {
            setShowProductEditor(false);
            setEditingProductId(null);
          }}
          onSuccess={() => {
            // Refresh products list after edit/create
            loadData(currentPage);
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
