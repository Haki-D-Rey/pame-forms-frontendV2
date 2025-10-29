/* eslint-disable import/no-unresolved */
import { API_BASE_URL } from "@/lib/config";

type Json = Record<string, any>;

async function postJSON<T = any>(path: string, body: Json, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        body: JSON.stringify(body),
        credentials: 'include', // quítalo si no usas cookies
        ...init,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : undefined;

    if (!res.ok) {
        const message = (data && (data.error || data.message)) || `HTTP ${res.status}`;
        throw new Error(message);
    }
    return (data as T) ?? ({} as T);
}

/** 1) Enviar código de recuperación al email */
export async function requestPasswordReset(email: string) {
    console.log(email);
    return postJSON<{ message: string }>(`/api/v1/auth/forgot-password`, { email });
}

/** 2) Verificar código recibido por correo */
export async function verifyResetCode(params: { email: string; code: string }) {
    // El backend podría devolver { resetToken, expiresAt } o solo { message }
    return postJSON<{ resetToken?: string; expiresAt?: string; message?: string }>(
        `/api/v1/auth/verify-code`,
        params
    );
}

/** 3) Establecer nueva contraseña
 *  NOTA: según tu contrato, aquí envías { email, code, newPassword }.
 *  Si tu backend cambia a resetToken, ajusta el payload a { email, resetToken, newPassword }.
 */
export async function resetPassword(params: { email: string; resetToken: string; newPassword: string }) {
    return postJSON<{ message: string }>(`/api/v1/auth/reset-password`, params);
}
