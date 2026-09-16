import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BookOwnedUser } from './BookOwnedUser'

describe('BookOwnedUser', () => {
  it('is a book-owned Account trigger using the approved idle artwork', () => {
    const markup = renderToStaticMarkup(<BookOwnedUser onOpenAccount={() => {}} />)
    expect(markup).toContain('stage-user')
    expect(markup).toContain('Open your account')
    expect(markup).toContain('user-idle')
  })
})
