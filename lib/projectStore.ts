import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StoredProduct = {
  id: string;
  sku: string;
  name: string;
  supplier_slug: string;
  image_url: string | null;
};

type ProjectState = {
  photoStoragePath: string | null;
  photoFileName: string | null;
  setPhoto: (storagePath: string, fileName: string) => void;
  clearPhoto: () => void;

  selectedProduct: StoredProduct | null;
  setProduct: (product: StoredProduct) => void;
  clearProduct: () => void;

  totalArea: number | null;
  openings: number | null;
  setCalculation: (totalArea: number, openings: number) => void;

  // Whether the fascia board (boeideel) along the roof edge is replaced
  // along with the wall cladding. Default true = include in replacement.
  includeBoeideel: boolean;
  setIncludeBoeideel: (include: boolean) => void;

  reset: () => void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      photoStoragePath: null,
      photoFileName: null,
      selectedProduct: null,
      totalArea: null,
      openings: null,
      includeBoeideel: true,

      setPhoto: (storagePath, fileName) =>
        set({ photoStoragePath: storagePath, photoFileName: fileName }),
      clearPhoto: () => set({ photoStoragePath: null, photoFileName: null }),

      setProduct: (product) => set({ selectedProduct: product }),
      clearProduct: () => set({ selectedProduct: null }),

      setCalculation: (totalArea, openings) => set({ totalArea, openings }),

      setIncludeBoeideel: (include) => set({ includeBoeideel: include }),

      reset: () =>
        set({
          photoStoragePath: null,
          photoFileName: null,
          selectedProduct: null,
          totalArea: null,
          openings: null,
          includeBoeideel: true,
        }),
    }),
    { name: "renisual-project" }
  )
);
