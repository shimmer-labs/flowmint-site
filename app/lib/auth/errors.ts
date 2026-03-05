export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred'

  const message = error.message || error.error_description || ''

  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Please verify your email address before signing in.'
  }
  if (message.includes('User already registered')) {
    return 'An account with this email already exists.'
  }
  if (message.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.'
  }
  if (message.includes('Unable to validate email address')) {
    return 'Please enter a valid email address.'
  }
  if (message.includes('Email rate limit exceeded')) {
    return 'Too many attempts. Please try again in a few minutes.'
  }

  return message || 'An error occurred. Please try again.'
}
