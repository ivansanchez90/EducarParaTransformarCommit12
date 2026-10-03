import { describe, expect, it } from 'vitest'
import { tipoDeArchivo } from '../src/lib/tipoArchivo.js'

/** Una caja `ftyp` como la de los archivos AVIF y HEIC: tamaño, "ftyp", marca principal y marcas compatibles. */
function ftyp(principal: string, ...compatibles: string[]): Buffer {
  const cuerpo = Buffer.concat([Buffer.from('ftyp'), Buffer.from(principal), Buffer.alloc(4), ...compatibles.map((m) => Buffer.from(m))])
  const tamano = Buffer.alloc(4)
  tamano.writeUInt32BE(cuerpo.length + 4)
  return Buffer.concat([tamano, cuerpo, Buffer.alloc(16)])
}

const relleno = Buffer.alloc(32)

describe('tipoDeArchivo', () => {
  it.each([
    ['JPG', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), relleno]), 'jpg', 'image/jpeg'],
    ['PNG', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), relleno]), 'png', 'image/png'],
    ['PDF', Buffer.concat([Buffer.from('%PDF-1.7\n'), relleno]), 'pdf', 'application/pdf'],
    ['WebP', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), relleno]), 'webp', 'image/webp'],
    ['AVIF', ftyp('avif', 'mif1'), 'avif', 'image/avif'],
    ['AVIF animado', ftyp('avis', 'avif'), 'avif', 'image/avif'],
    ['AVIF con marca principal mif1', ftyp('mif1', 'miaf', 'avif'), 'avif', 'image/avif'],
    ['HEIC', ftyp('heic', 'mif1'), 'heic', 'image/heic'],
    ['HEIC con marca principal mif1', ftyp('mif1', 'heic'), 'heic', 'image/heic'],
  ])('reconoce un %s', (_nombre, contenido, ext, mime) => {
    expect(tipoDeArchivo(contenido)).toEqual({ ext, mime })
  })

  it.each([
    ['un ejecutable', Buffer.concat([Buffer.from('MZ'), relleno])],
    ['un script', Buffer.from('#!/bin/sh\nrm -rf /\n' + 'x'.repeat(20))],
    ['una página HTML', Buffer.from('<html><script>alert(1)</script></html>')],
    ['un SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['un GIF', Buffer.concat([Buffer.from('GIF89a'), relleno])],
    ['un texto cualquiera', Buffer.from('esto no es un comprobante, ni una foto')],
    ['un video MP4', ftyp('isom', 'mp42')],
    ['un archivo vacío o muy corto', Buffer.from([0xff, 0xd8])],
  ])('rechaza %s', (_nombre, contenido) => {
    expect(tipoDeArchivo(contenido)).toBeNull()
  })

  it('no se deja engañar por una firma de imagen en un lugar equivocado', () => {
    expect(tipoDeArchivo(Buffer.concat([Buffer.from('xxxx'), Buffer.from([0xff, 0xd8, 0xff]), relleno]))).toBeNull()
  })
})
