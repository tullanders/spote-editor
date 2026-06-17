import { describe, it, expect } from 'vitest'
import {
  nextUploadId, placeholderSrc, placeholderMarkdown, imageMarkdown,
  findPlaceholderRange, imageFilesFrom,
} from './imageUpload'

describe('imageUpload helpers', () => {
  it('nextUploadId returns a fresh id each call', () => {
    expect(nextUploadId()).not.toBe(nextUploadId())
  })

  it('placeholder + markdown builders are consistent', () => {
    const id = 'abc'
    expect(placeholderSrc(id)).toBe('uploading:abc')
    expect(placeholderMarkdown(id)).toBe('![laddar…](uploading:abc)')
    expect(imageMarkdown('https://x/y.png')).toBe('![](https://x/y.png)')
  })

  it('findPlaceholderRange locates the placeholder substring', () => {
    const ph = placeholderMarkdown('abc')
    const doc = 'before ' + ph + ' after'
    const range = findPlaceholderRange(doc, 'abc')
    expect(range).toEqual({ from: 7, to: 7 + ph.length })
    expect(doc.slice(range!.from, range!.to)).toBe(ph)
  })

  it('findPlaceholderRange returns null when absent', () => {
    expect(findPlaceholderRange('nothing here', 'abc')).toBeNull()
  })

  it('imageFilesFrom keeps only image files and tolerates null', () => {
    const img = new File([''], 'a.png', { type: 'image/png' })
    const txt = new File([''], 'b.txt', { type: 'text/plain' })
    const list = [img, txt] as unknown as FileList
    expect(imageFilesFrom(list)).toEqual([img])
    expect(imageFilesFrom(null)).toEqual([])
    expect(imageFilesFrom(undefined)).toEqual([])
  })
})
