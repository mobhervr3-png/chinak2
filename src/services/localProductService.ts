
const LOCAL_DRAFTS_KEY = 'admin_local_drafts';

export interface LocalProduct {
  id: string; // prefixed with 'local-'
  name: string;
  chineseName?: string;
  description?: string;
  price: number;
  basePriceRMB?: number;
  image?: string;
  status: 'DRAFT';
  isActive: boolean;
  isFeatured: boolean;
  isLocal: boolean;
  purchaseUrl?: string;
  videoUrl?: string;
  specs?: unknown;
  options?: unknown[];
  variants?: unknown[];
  images?: unknown[];
  detailImages?: unknown[];
  createdAt: string;
  updatedAt: string;
  deliveryTime?: string;
}

export const localProductService = {
  getAllDrafts: (): LocalProduct[] => {
    const stored = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (!stored) return [];
    try {
      const drafts = JSON.parse(stored);
      // Fix duplicated IDs and ensure uniqueness
      const seenIds = new Set();
      let hasChanged = false;
      const fixedDrafts = drafts.map((d: { id?: string; options?: { id?: string }[] }, index: number) => {
        let draftChanged = false;
        const newDraft = { ...d };

        // Fix duplicated or missing IDs
        if (!newDraft.id || typeof newDraft.id !== 'string' || seenIds.has(newDraft.id)) {
          hasChanged = true;
          draftChanged = true;
          newDraft.id = `local-${Date.now()}-${index}-${Math.floor(Math.random() * 1000000)}`;
        }
        seenIds.add(newDraft.id);

        // Fix missing IDs for options
        if (newDraft.options && Array.isArray(newDraft.options)) {
          newDraft.options = newDraft.options.map((opt: { id?: string }, optIdx: number) => {
            if (!opt.id) {
              hasChanged = true;
              draftChanged = true;
              return { 
                ...opt, 
                id: `opt-${Date.now()}-${index}-${optIdx}-${Math.floor(Math.random() * 1000)}` 
              };
            }
            return opt;
          });
        }

        return draftChanged ? (newDraft as LocalProduct) : (d as LocalProduct);
      });

      if (hasChanged) {
        console.log('[LocalProductService] Fixed duplicate or missing IDs in drafts');
        localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(fixedDrafts));
        return fixedDrafts;
      }
      return drafts;
    } catch (_e) {
      console.error('Failed to parse local drafts:', _e);
      return [];
    }
  },

  saveDraft: (product: Partial<LocalProduct>): LocalProduct => {
    const drafts = localProductService.getAllDrafts();
    const now = new Date().toISOString();
    
    let updatedProduct: LocalProduct;
    
    if (product.id && product.id.startsWith('local-')) {
      // Update existing
      const index = drafts.findIndex(d => d.id === product.id);
      if (index !== -1) {
        updatedProduct = {
          ...drafts[index],
          ...product,
          updatedAt: now,
          status: 'DRAFT', // Ensure status remains DRAFT
          isLocal: true
        } as LocalProduct;
        drafts[index] = updatedProduct;
      } else {
        // ID provided but not found, create new
        updatedProduct = {
        ...product,
        id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: now,
        updatedAt: now,
        status: 'DRAFT',
        isLocal: true
      } as LocalProduct;
      drafts.push(updatedProduct);
    }
  } else {
    // Create new
    updatedProduct = {
      ...product,
      id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
      status: 'DRAFT',
      isLocal: true
    } as LocalProduct;
    drafts.push(updatedProduct);
  }

    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
    return updatedProduct;
  },

  deleteDraft: (id: string): void => {
    const drafts = localProductService.getAllDrafts();
    const filtered = drafts.filter(d => d.id !== id);
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(filtered));
  },

  getDraftById: (id: string): LocalProduct | undefined => {
    return localProductService.getAllDrafts().find(d => d.id === id);
  }
};
