/**
 * Tipo real de un archivo según sus primeros bytes. El nombre y el `Content-Type`
 * que manda el navegador los controla quien sube el archivo; la firma, no.
 *
 * Reconoce lo que se acepta como comprobante de una transferencia: fotos (JPG,
 * PNG, WebP, AVIF y HEIC, el formato de las fotos de iPhone) y PDF.
 */

export interface TipoArchivo {
  ext: string
  mime: string
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MARCAS_AVIF = ['avif', 'avis']
const MARCAS_HEIC = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

/** Las marcas de una caja `ftyp` (AVIF y HEIC): la principal y las compatibles. */
function marcasFtyp(b: Buffer): string[] {
  const fin = Math.min(b.readUInt32BE(0), b.length, 64)
  const marcas = [b.toString('latin1', 8, 12)]
  for (let i = 16; i + 4 <= fin; i += 4) marcas.push(b.toString('latin1', i, i + 4))
  return marcas
}

export function tipoDeArchivo(b: Buffer): TipoArchivo | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.subarray(0, 8).equals(PNG)) return { ext: 'png', mime: 'image/png' }
  if (b.toString('latin1', 0, 5) === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' }
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  if (b.toString('latin1', 4, 8) === 'ftyp') {
    const marcas = marcasFtyp(b)
    // Algunos AVIF declaran `mif1` como marca principal y `avif` entre las compatibles.
    if (marcas.some((m) => MARCAS_AVIF.includes(m))) return { ext: 'avif', mime: 'image/avif' }
    if (marcas.some((m) => MARCAS_HEIC.includes(m))) return { ext: 'heic', mime: 'image/heic' }
  }
  return null
}
