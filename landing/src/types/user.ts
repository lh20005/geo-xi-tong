export interface User {
  id: number;
  username: string;
  invitationCode: string;
  invitedByCode?: string;
  role: 'admin' | 'user';
  isTempPassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  invitationCode?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
  message?: string;
}

export interface InvitedUser {
  username: string;
  createdAt: string;
}

export interface InvitationStats {
  invitationCode: string;
  totalInvites: number;
  invitedUsers: InvitedUser[];
}

export interface UserListResponse {
  success: boolean;
  data: {
    users: Array<User & { invitedCount: number }>;
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
