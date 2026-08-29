import { ALLOW, type Guard } from './guard.ts'

/**
 * Minimal glob matcher covering the two patterns the config documents:
 * `*` matches within one path segment, `**` matches across segments.
 * Deliberately hand-rolled — a dependency here would break the zero-dep rule.
 */
export function matchGlob(pattern: string, p: string): boolean {
  // Patterns arrive already ~-expanded from loadConfig. A pattern still
  // starting with ~ could never match an absolute candidate path, and a keep
  // rule that silently never matches is worse than no keep rule.
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const parts = escaped.split('**')
  const rx = parts
    .map((part) => part.replace(/\*/g, '[^/]*').replace(/\//g, '\\/'))
    .join('.*')
  return new RegExp(`^${rx}$`).test(p)
}

export const keepGuard: Guard = {
  name: 'keep',
  check(c, ctx) {
    for (const g of ctx.keepGlobs) {
      if (matchGlob(g, c.path)) return { action: 'block', warning: `matches keep rule ${g}` }
    }
    return ALLOW
  },
}
