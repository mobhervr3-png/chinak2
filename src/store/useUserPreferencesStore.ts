import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferencesState {
  searchHistory: string[];
  categoryScores: Record<string, number>;
  
  addSearchHistory: (term: string) => void;
  incrementCategoryScore: (categoryId: string, amount?: number) => void;
  clearHistory: () => void;
  getSortedCategories: <T extends { id: string }>(categories: T[]) => T[];
}

// Simple keyword mapping for scoring
// Note: These should match the category IDs in Home.tsx
const categoryKeywords: Record<string, string[]> = {
  electronics: ['phone', 'mobile', 'laptop', 'watch', 'tech', 'smart', 'screen', 'audio', 'sound', 'camera', 'إلكترونيات', 'هاتف', 'جوال', 'ساعة', 'ذكية', 'لابتوب', 'كاميرا', 'سماعة'],
  fashion: ['shirt', 'pant', 'dress', 'shoe', 'cloth', 'wear', 'fashion', 'style', 'bag', 'ملابس', 'أزياء', 'موضة', 'قميص', 'بنطلون', 'فستان', 'حذاء', 'شنطة'],
  new: ['new', 'arrival', 'latest', 'جديد', 'وصل', 'حديثاً'],
  under5k: ['cheap', 'deal', 'offer', 'رخيص', 'عرض', 'تخفيض', 'أقل']
};

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set, get) => ({
      searchHistory: [],
      categoryScores: {},

      addSearchHistory: (term: string) => {
        if (!term || !term.trim()) return;
        
        const state = get();
        const searchHistory = state.searchHistory;
        const categoryScores = state.categoryScores;
        
        // Update history (max 10 items)
        const newHistory = [term, ...searchHistory.filter(t => t !== term)].slice(0, 10);
        
        // Update scores based on keywords
        const newScores = { ...categoryScores };
        const lowerTerm = term.toLowerCase();
        
        Object.entries(categoryKeywords).forEach(([catId, keywords]) => {
          if (keywords.some(k => lowerTerm.includes(k.toLowerCase()))) {
            newScores[catId] = (newScores[catId] || 0) + 5; // Big boost for explicit search
          }
        });

        set({ searchHistory: newHistory, categoryScores: newScores });
      },

      incrementCategoryScore: (categoryId: string, amount = 1) => {
        const state = get();
        const currentScore = state.categoryScores[categoryId] || 0;
        
        set({
          categoryScores: {
            ...state.categoryScores,
            [categoryId]: currentScore + amount
          }
        });
      },

      clearHistory: () => set({ searchHistory: [], categoryScores: {} }),

      getSortedCategories: (categories) => {
        const state = get();
        const scores = state.categoryScores;
        
        // Create a shallow copy to sort
        return [...categories].sort((a, b) => {
          // Always keep 'all' at top
          if (a.id === 'all') return -1;
          if (b.id === 'all') return 1;
          
          const scoreA = scores[a.id] || 0;
          const scoreB = scores[b.id] || 0;
          
          // Sort by score descending
          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }
          
          return 0; 
        });
      }
    }),
    {
      name: 'user-preferences-storage', // name of the item in the storage (must be unique)
    }
  )
);
