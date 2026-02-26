import { categoriesPart1 } from './categoriesPart1';
import { categoriesPart2 } from './categoriesPart2';
import { categoriesPart3 } from './categoriesPart3';
import { categoriesPart4 } from './categoriesPart4';
import { categoriesPart5 } from './categoriesPart5';
import { categoriesPart6 } from './categoriesPart6';
import { categoriesPart7 } from './categoriesPart7';
import { categoriesPart8Additions } from './categoriesPart8';

// Helper to deep clone to avoid mutating original parts if needed, 
// though here we are just constructing a new array.
// We will build the final array sequentially.

// 1. Start with Part 1 (Categories 1000, 2000)
const finalCategories = [...categoriesPart1];

// 2. Add Part 2 (Categories 3000, 4000)
// Note: Category 4000 (Home & Living) is here but incomplete (only has 4001, 4002)
finalCategories.push(...categoriesPart2);

// 3. Process Part 3
// Part 3 contains extensions for 4000 (4003, 4004, 4005) and new roots (5000, 6000)
const homeAndLiving = finalCategories.find(c => c.id === 4000);
if (homeAndLiving) {
  // Extract extensions for Home & Living (IDs starting with 4)
  const homeExtensions = categoriesPart3.filter(c => c.id >= 4003 && c.id < 5000);
  
  if (!homeAndLiving.children) {
    homeAndLiving.children = [];
  }
  // Append the extended subcategories
  homeAndLiving.children.push(...homeExtensions);
}

// Add new roots from Part 3 (5000, 6000)
// 6000 (Mother & Baby) is here but incomplete (6002 has empty children)
const part3Roots = categoriesPart3.filter(c => c.id >= 5000);
finalCategories.push(...part3Roots);

// 4. Process Part 4
// Part 4 has:
// - childrenOf6002: Children for Category 6002 (Baby Care & Liquids)
// - siblingsOf6002: Sibling categories for 6002 (e.g. 6003 Toys & Play)
// - newTopLevelCategories: 7000, 8000

const motherAndBaby = finalCategories.find(c => c.id === 6000);
if (motherAndBaby) {
  // Add siblings (like 6003)
  if (categoriesPart4.siblingsOf6002) {
    if (!motherAndBaby.children) motherAndBaby.children = [];
    motherAndBaby.children.push(...categoriesPart4.siblingsOf6002);
  }

  // Populate children of 6002
  const babyCare = motherAndBaby.children?.find(c => c.id === 6002);
  if (babyCare && categoriesPart4.childrenOf6002) {
    if (!babyCare.children) babyCare.children = [];
    babyCare.children.push(...categoriesPart4.childrenOf6002);
  }
}

// Add new top level categories from Part 4 (7000, 8000)
if (categoriesPart4.newTopLevelCategories) {
  finalCategories.push(...categoriesPart4.newTopLevelCategories);
}

// 5. Add Part 5 (Category 9000)
finalCategories.push(...categoriesPart5);

// 6. Add Part 6 (Tools, Stationery, Pets, Health, Improvement, Jewelry)
finalCategories.push(...categoriesPart6);

// 7. Add Part 7 (Bags, Smart Home, Photography, Party, Sewing, Gaming)
finalCategories.push(...categoriesPart7);

// 8. Add Sub-category Additions from Part 8
categoriesPart8Additions.forEach(addition => {
  // Find parent category (could be main category or sub-category group)
  const findAndAdd = (nodes: any[]) => {
    for (let node of nodes) {
      if (node.id === addition.parentId) {
        if (addition.items) {
          if (!node.children) node.children = [];
          node.children.push(...addition.items);
        } else if (addition.newGroup) {
          if (!node.children) node.children = [];
          node.children.push(addition.newGroup);
        }
        return true;
      }
      if (node.children && findAndAdd(node.children)) return true;
    }
    return false;
  };
  findAndAdd(finalCategories);
});

export const categories = finalCategories;
