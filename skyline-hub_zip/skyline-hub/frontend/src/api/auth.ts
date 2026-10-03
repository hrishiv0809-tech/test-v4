import { httpGet, httpPatch, httpPost } from './client';
import type { AuthResponse, User } from './types';

export interface LoginInput {
  email: string;
  password: string;
}
export interface SignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  student_id?: string;
  plan_id: number;
}

export const authApi = {
  login: (payload: LoginInput) => httpPost<AuthResponse>('/auth/login', payload),
  signup: (payload: SignupInput) => httpPost<AuthResponse>('/auth/signup', payload),
  me: () => httpGet<User>('/auth/me'),
  updateMe: (payload: Partial<Pick<User, 'name' | 'phone' | 'student_id'>>) => httpPatch<User>('/auth/me', payload),
};
