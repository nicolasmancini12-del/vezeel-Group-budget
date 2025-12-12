import { supabase } from './supabase';
import { AppUser, AccessLog } from '../types';

export const authService = {
  // Login simple verificando tabla app_users
  login: async (email: string, password: string): Promise<AppUser | null> => {
    if (!supabase) return null; // Mock fallback could be added here

    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .eq('password', password) // En un app real, usar hash (bcrypt)
      .single();

    if (error || !data) {
      return null;
    }

    // Registrar Log
    await authService.logAccess(data.email, 'LOGIN', 'Ingreso exitoso al sistema');

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as 'ADMIN' | 'USER'
    };
  },

  getUsers: async (): Promise<AppUser[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('app_users').select('*');
    return data || [];
  },

  createUser: async (user: Omit<AppUser, 'id'>) => {
    if (!supabase) return;
    await supabase.from('app_users').insert({
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role
    });
  },

  updateUser: async (user: AppUser) => {
      if (!supabase) return;
      const payload: any = {
          email: user.email,
          name: user.name,
          role: user.role
      };
      // Solo actualizamos password si el usuario escribió algo nuevo
      if (user.password && user.password.trim() !== '') {
          payload.password = user.password;
      }
      
      await supabase.from('app_users').update(payload).eq('id', user.id);
  },

  deleteUser: async (id: string) => {
    if (!supabase) return;
    await supabase.from('app_users').delete().eq('id', id);
  },

  logAccess: async (email: string, action: string, details: string) => {
    if (!supabase) return;
    await supabase.from('access_logs').insert({
      user_email: email,
      action,
      details
    });
  }
};
