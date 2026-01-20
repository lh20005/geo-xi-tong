/**
 * 图库状态管理
 * 使用本地 API（SQLite + 文件系统）存储图库数据
 */

import { create } from 'zustand';
import { localGalleryApi, type LocalAlbum, type LocalImage, type CreateAlbumParams } from '../api';

interface GalleryStats {
  totalAlbums: number;
  totalImages: number;
  totalSize: number;
}

type UploadFile = {
  name: string;
  type: string;
  size?: number;
  path?: string;
  buffer?: number[];
};

interface GalleryState {
  // 数据
  albums: LocalAlbum[];
  currentAlbum: LocalAlbum | null;
  images: LocalImage[];
  currentImage: LocalImage | null;
  stats: GalleryStats | null;
  
  // 状态
  loading: boolean;
  uploading: boolean;
  error: string | null;
  
  // 相册操作
  fetchAlbums: () => Promise<void>;
  fetchAlbum: (albumId: number) => Promise<void>;
  createAlbum: (params: CreateAlbumParams) => Promise<LocalAlbum | null>;
  updateAlbum: (albumId: number, params: Partial<CreateAlbumParams>) => Promise<boolean>;
  deleteAlbum: (albumId: number) => Promise<boolean>;
  
  // 图片操作
  uploadImages: (albumId: number, files: UploadFile[]) => Promise<boolean>;
  fetchImages: (albumId: number) => Promise<void>;
  fetchImage: (imageId: number) => Promise<void>;
  deleteImage: (imageId: number) => Promise<boolean>;
  deleteImages: (imageIds: number[]) => Promise<{ success: boolean; deletedCount: number }>;
  moveImage: (imageId: number, targetAlbumId: number) => Promise<boolean>;
  readImageFile: (imageId: number) => Promise<{ data: string; mimeType: string } | null>;
  
  fetchStats: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  albums: [],
  currentAlbum: null,
  images: [],
  currentImage: null,
  stats: null,
  loading: false,
  uploading: false,
  error: null,
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useGalleryStore = create<GalleryState>((set, get) => ({
  ...initialState,
  
  // 相册操作
  fetchAlbums: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.findAlbums();
      if (result.success) {
        set({ albums: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取相册列表失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取相册列表失败'), loading: false });
    }
  },
  
  fetchAlbum: async (albumId) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.getAlbum(albumId);
      if (result.success) {
        set({ currentAlbum: result.data, loading: false });
      } else {
        set({ error: result.error || '获取相册详情失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取相册详情失败'), loading: false });
    }
  },
  
  createAlbum: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.createAlbum(params);
      if (result.success) {
        await get().fetchAlbums();
        set({ loading: false });
        return result.data;
      } else {
        set({ error: result.error || '创建相册失败', loading: false });
        return null;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '创建相册失败'), loading: false });
      return null;
    }
  },
  
  updateAlbum: async (albumId, params) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.updateAlbum(albumId, params);
      if (result.success) {
        if (get().currentAlbum?.id === albumId) {
          set({ currentAlbum: result.data });
        }
        await get().fetchAlbums();
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '更新相册失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '更新相册失败'), loading: false });
      return false;
    }
  },
  
  deleteAlbum: async (albumId) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.deleteAlbum(albumId);
      if (result.success) {
        await get().fetchAlbums();
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '删除相册失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '删除相册失败'), loading: false });
      return false;
    }
  },
  
  // 图片操作
  uploadImages: async (albumId, files) => {
    set({ uploading: true, error: null });
    try {
      const result = await localGalleryApi.uploadImage(albumId, files);
      if (result.success) {
        await get().fetchImages(albumId);
        set({ uploading: false });
        return true;
      } else {
        set({ error: result.error || '上传图片失败', uploading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '上传图片失败'), uploading: false });
      return false;
    }
  },
  
  fetchImages: async (albumId) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.findImages(albumId);
      if (result.success) {
        set({ images: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取图片列表失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取图片列表失败'), loading: false });
    }
  },
  
  fetchImage: async (imageId) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.getImage(imageId);
      if (result.success) {
        set({ currentImage: result.data, loading: false });
      } else {
        set({ error: result.error || '获取图片详情失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取图片详情失败'), loading: false });
    }
  },
  
  deleteImage: async (imageId) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.deleteImage(imageId);
      if (result.success) {
        // 从当前图片列表中移除
        set(state => ({
          images: state.images.filter(i => i.id !== imageId),
          loading: false,
        }));
        return true;
      } else {
        set({ error: result.error || '删除图片失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '删除图片失败'), loading: false });
      return false;
    }
  },
  
  deleteImages: async (imageIds) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.deleteImages(imageIds);
      if (result.success) {
        // 从当前图片列表中移除
        set(state => ({
          images: state.images.filter(i => !imageIds.includes(i.id)),
          loading: false,
        }));
        return { success: true, deletedCount: result.data?.deletedCount || imageIds.length };
      } else {
        set({ error: result.error || '批量删除图片失败', loading: false });
        return { success: false, deletedCount: 0 };
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '批量删除图片失败'), loading: false });
      return { success: false, deletedCount: 0 };
    }
  },
  
  moveImage: async (imageId, targetAlbumId) => {
    set({ loading: true, error: null });
    try {
      const result = await localGalleryApi.moveImage(imageId, targetAlbumId);
      if (result.success) {
        // 从当前图片列表中移除
        set(state => ({
          images: state.images.filter(i => i.id !== imageId),
          loading: false,
        }));
        return true;
      } else {
        set({ error: result.error || '移动图片失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '移动图片失败'), loading: false });
      return false;
    }
  },
  
  readImageFile: async (imageId) => {
    try {
      const result = await localGalleryApi.readImageFile(imageId);
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (error: unknown) {
      console.error('读取图片文件失败:', error);
      return null;
    }
  },
  
  fetchStats: async () => {
    try {
      const result = await localGalleryApi.getStats();
      if (result.success) {
        set({ stats: result.data });
      }
    } catch (error: unknown) {
      console.error('获取图库统计失败:', error);
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set(initialState),
}));
