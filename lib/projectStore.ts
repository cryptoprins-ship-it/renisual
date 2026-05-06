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

  // Path of the chosen render in the offerte-renders bucket. Set when
  // the user clicks "Bereken materiaal →" on /render — that snapshots
  // the current baseline variant into Supabase Storage so the offerte
  // PDF can render it as the "voorgesteld eindresultaat" image.
  renderStoragePath: string | null;
  setRender: (storagePath: string) => void;
  clearRender: () => void;

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
      renderStoragePath: null,
      selectedProduct: null,
      totalArea: null,
      openings: null,
      includeBoeideel: true,

      setPhoto: (storagePath, fileName) =>
        set({ photoStoragePath: storagePath, photoFileName: fileName }),
      clearPhoto: () => set({ photoStoragePath: null, photoFileName: null }),

      setRender: (storagePath) => set({ renderStoragePath: storagePath }),
      clearRender: () => set({ renderStoragePath: null }),

      setProduct: (product) => set({ selectedProduct: product }),
      clearProduct: () => set({ selectedProduct: null }),

      setCalculation: (totalArea, openings) => set({ totalArea, openings }),

      setIncludeBoeideel: (include) => set({ includeBoeideel: include }),

      reset: () =>
        set({
          photoStoragePath: null,
          photoFileName: null,
          renderStoragePath: null,
          selectedProduct: null,
          totalArea: null,
          openings: null,
          includeBoeideel: true,
        }),
    }),
    { name: "renisual-project" }
  )
);
