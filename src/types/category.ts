export interface Category {
  id: number;
  name_en: string;
  name_ar: string;
  icon: string;
  children?: Category[];
}
