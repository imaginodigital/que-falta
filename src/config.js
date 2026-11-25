// Datos generales de la app. Para cambiar el nombre, cámbialo solo aquí.
export const APP_NAME = 'Qué Falta'
// (Si cambias el nombre, cámbialo también en index.html y public/manifest.json)

// Enlace de la app. Cuando esté en Vercel se toma solo de la dirección de la página.
// Si quieres fijarlo a mano, agrega VITE_APP_URL en .env.local / Vercel.
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

// Mensaje que se envía al tocar "Compartir app" (WhatsApp, correo, etc.).
// Los *asteriscos* se ven en negrita en WhatsApp.
export function shareAppText() {
  return [
    `Te invito a usar *${APP_NAME}* para compartir listas (compras, pendientes y más):`,
    APP_URL,
    '',
    '*Para tenerla como app en tu teléfono:*',
    '',
    '*Android (Chrome)*',
    '• Abre el enlace en Chrome',
    '• Toca ⋮ (arriba a la derecha)',
    '• Toca "Agregar a la pantalla principal" o "Instalar app"',
    '',
    '*iPhone (Safari)*',
    '• Abre el enlace en Safari',
    '• Toca Compartir (cuadrado con flecha ↑)',
    '• Toca "Agregar a inicio"',
    '',
    'Para entrar, escribe tu correo y abre el enlace que te llega. No necesitas contraseña.',
  ].join('\n')
}
