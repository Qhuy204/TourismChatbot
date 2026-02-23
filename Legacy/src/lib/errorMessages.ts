/**
 * Utility to map internal error messages to user-friendly messages.
 * This prevents exposing sensitive database/system details to users.
 */

// Known error patterns and their user-friendly messages
const errorMappings: Array<{ pattern: RegExp | string; message: string }> = [
  // Auth errors
  { pattern: 'Invalid login credentials', message: 'Email hoặc mật khẩu không đúng' },
  { pattern: 'already registered', message: 'Email này đã được đăng ký. Vui lòng đăng nhập.' },
  { pattern: 'Email not confirmed', message: 'Vui lòng xác nhận email trước khi đăng nhập' },
  { pattern: 'Password should be at least', message: 'Mật khẩu phải có ít nhất 6 ký tự' },
  { pattern: 'User not found', message: 'Tài khoản không tồn tại' },
  { pattern: 'rate limit', message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau' },
  
  // Database errors (codes)
  { pattern: '23505', message: 'Dữ liệu đã tồn tại trong hệ thống' },
  { pattern: '23503', message: 'Không thể thực hiện vì có dữ liệu liên quan' },
  { pattern: '42501', message: 'Bạn không có quyền thực hiện thao tác này' },
  { pattern: '42P01', message: 'Lỗi hệ thống. Vui lòng thử lại sau' },
  { pattern: 'violates row-level security', message: 'Bạn không có quyền truy cập dữ liệu này' },
  
  // Network errors
  { pattern: 'NetworkError', message: 'Lỗi kết nối mạng. Vui lòng kiểm tra internet' },
  { pattern: 'Failed to fetch', message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại' },
  { pattern: 'timeout', message: 'Yêu cầu đã hết thời gian. Vui lòng thử lại' },
  
  // Storage errors
  { pattern: 'Payload too large', message: 'Dữ liệu quá lớn. Vui lòng giảm kích thước' },
];

/**
 * Maps database/internal error messages to user-friendly messages.
 * @param error The error object or message
 * @param fallbackMessage Optional fallback message if no mapping found
 * @returns User-friendly error message
 */
export function mapErrorToUserMessage(
  error: unknown,
  fallbackMessage = 'Đã xảy ra lỗi. Vui lòng thử lại sau'
): string {
  if (!error) return fallbackMessage;

  // Extract error message
  let errorMessage = '';
  let errorCode = '';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    errorMessage = String(err.message || err.error || '');
    errorCode = String(err.code || '');
  }

  const fullErrorText = `${errorCode} ${errorMessage}`.toLowerCase();

  // Check for known patterns
  for (const mapping of errorMappings) {
    if (typeof mapping.pattern === 'string') {
      if (fullErrorText.includes(mapping.pattern.toLowerCase())) {
        return mapping.message;
      }
    } else if (mapping.pattern.test(fullErrorText)) {
      return mapping.message;
    }
  }

  // Return fallback - never expose raw error details
  return fallbackMessage;
}

/**
 * Logs error details to console for debugging while returning safe user message.
 * Use this when you need to debug but don't want to expose error details.
 */
export function logAndMapError(
  error: unknown,
  context: string,
  fallbackMessage?: string
): string {
  // Log full error for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}] Error:`, error);
  }
  
  return mapErrorToUserMessage(error, fallbackMessage);
}
