export const ACCOUNT_DOMAIN = "ph1.tsqmt.edu.vn";
export const ACCOUNT_EMAIL_PATTERN =
  /^[a-z][a-z0-9._-]{2,49}@ph1\.tsqmt\.edu\.vn$/i;
export function accountUsername(input: string) {
  const value = input.trim().toLowerCase();
  const local = value.endsWith(`@${ACCOUNT_DOMAIN}`)
    ? value.slice(0, -(ACCOUNT_DOMAIN.length + 1))
    : value;
  if (!/^[a-z][a-z0-9._-]{2,49}$/.test(local))
    throw new Error(
      `Tài khoản phải có dạng ten@${ACCOUNT_DOMAIN}, phần tên gồm 3–50 ký tự không dấu.`,
    );
  return local;
}
export function accountEmail(username: string) {
  return `${accountUsername(username)}@${ACCOUNT_DOMAIN}`;
}
