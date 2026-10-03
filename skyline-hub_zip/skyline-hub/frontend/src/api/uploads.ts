import { httpPostForm } from './client';

export const uploadsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return httpPostForm<{ url: string; name: string; size: number }>('/uploads', form);
  },
};
