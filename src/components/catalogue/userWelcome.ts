export const USER_WELCOME_GREETING_MS = 3_000
export const USER_WELCOME_HINT_MS = 6_000
export const USER_ACCOUNT_HINT = 'Click me anytime to manage your account and orders.'

export function welcomeGreeting(firstName: string | null | undefined) {
  const name = firstName?.trim()
  return name ? `Welcome back, ${name}!` : 'Welcome back!'
}
