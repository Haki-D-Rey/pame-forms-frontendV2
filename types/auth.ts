// src/types/api.ts

/** Respuesta genérica del backend */
export type ApiResponse<T> = {
    status: boolean;         // true si la operación fue exitosa
    error?: string | null;   // mensaje de error si status=false
    data?: T;                // payload cuando status=true
};

/** Usuario básico (ajusta tipos si tu backend usa string para id/roleId) */
export type UserDTO = {
    id: number;
    email: string;
    roleId: number;
};

/** Info del token; en responses JSON conviene serializar la fecha como ISO string */
export type TokenInfoDTO = {
    payload: Record<string, unknown>;  // el decoded del JWT
    /** ISO string o null. Ej: "2025-10-17T12:34:56.000Z" */
    expiresAt: string | null;
};

/** ---- LOGIN ---- */

/** Request de login */
export type LoginRequest = {
    email: string;
    password: string;
};

/** Payload específico de login (lo que viene en data) */
export type LoginPayload = {
    message: 'Login exitoso';
    accessToken: string;
    refreshToken: string;
    user: UserDTO;
    tokenInfo: TokenInfoDTO;
};

/** Respuesta completa de login */
export type LoginResponse = ApiResponse<LoginPayload>;

/** ---- REGISTER ---- */

/** Request de registro (ajusta campos si tu backend pide más datos) */
export type RegisterRequest = {
    email: string;
    password: string;
    // nombre?: string;
    // apellido?: string;
};

/**
 * Payload de registro.
 * Algunos backends devuelven tokens tras registrarse; si no es tu caso,
 * deja accessToken/refreshToken como opcionales o elimínalos.
 */
export type RegisterPayload = {
    message: 'Registro exitoso';
    user: UserDTO;
    accessToken?: string;
    refreshToken?: string;
    tokenInfo?: TokenInfoDTO;
};

/** Respuesta completa de registro */
export type RegisterResponse = ApiResponse<RegisterPayload>;

export type RoleSafeDTO = {
    id: number;
    name: string;
    status: boolean;
    createdAt: Date;
    updatedAt?: Date; // null -> undefined en el mapeo
};

export type PermissionSafeDTO = RoleSafeDTO;

