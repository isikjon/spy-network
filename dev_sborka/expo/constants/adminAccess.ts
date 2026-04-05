export const ALLOWED_ADMIN_PHONES = ['+79184764713', '+79181190465'] as const;

export function isAdminPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = phone.replace(/\D/g, '');
  return ALLOWED_ADMIN_PHONES.some(
    (p) => p.replace(/\D/g, '') === normalized,
  );
}
