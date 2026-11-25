// Traduce los errores de inicio de sesión de Supabase a mensajes claros.
export function authErrorMessage(error) {
  if (!error) return ''
  const code = error.code || ''
  const msg = (error.message || '').toLowerCase()
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials'))
    return 'Correo o contraseña incorrectos.'
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return 'Ese correo ya tiene una cuenta. Entra con tu contraseña.'
  if (code === 'weak_password' || msg.includes('at least 6'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (code === 'same_password' || msg.includes('different from the old'))
    return 'La contraseña nueva debe ser distinta de la actual.'
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.'
  if (code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('security purposes'))
    return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.'
  if (code === 'validation_failed' || msg.includes('invalid format'))
    return 'Revisa que el correo esté bien escrito.'
  return error.message
}
