/**
 * GestionInscripciones — bandeja de solicitudes de preinscripción recibidas
 * desde la web. Desde el listado se abre cada solicitud para revisar todos sus
 * datos y resolverla (ver `DetalleInscripcion`).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import type { Inscripcion } from '../../types'
import { ESTADOS_INSCRIPCION, INSC_COLOR } from '../../constants'
import { badge, btnPrimarySm, card, selectField, tdCell, thCell } from '../../ui/styles'
import { DetalleInscripcion } from './DetalleInscripcion'

export function GestionInscripciones() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('')

  const load = useCallback(async () => {
    const { data } = await api.get<Inscripcion[]>('/inscripciones')
    if (data) setInscripciones(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (detalleId !== null) {
    return (
      <DetalleInscripcion
        idInscripcion={detalleId}
        onClose={() => setDetalleId(null)}
        onCambio={load}
      />
    )
  }

  const filtradas = inscripciones.filter((i) => !filtroEstado || i.estado === filtroEstado)
  const pendientes = inscripciones.filter((i) => i.estado === 'Pendiente').length

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📋 Inscripciones
        {pendientes > 0 && (
          <span style={{ ...badge('#E67E22'), marginLeft: 10 }}>
            {pendientes} sin revisar
          </span>
        )}
      </h2>

      <div className={card}>
        <div className='flex justify-between items-center mb-5 gap-4 flex-wrap'>
          <div className='text-[13px] text-textMuted'>
            Abrí una solicitud para ver todos los datos cargados y aprobarla o rechazarla.
          </div>
          <select
            className={`${selectField} w-[200px]`}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value=''>Todos los estados</option>
            {ESTADOS_INSCRIPCION.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className={thCell}>Aspirante</th>
              <th className={thCell}>Tutor</th>
              <th className={thCell}>Nivel</th>
              <th className={thCell}>Fecha</th>
              <th className={thCell}>Documentación</th>
              <th className={thCell}>Estado</th>
              <th className={thCell}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((i) => (
              <tr key={i.id_inscripcion}>
                <td className={`${tdCell} font-bold`}>
                  {i.nombre_aspirante} {i.apellido_aspirante ?? ''}
                  <br />
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    DNI: {i.dni_aspirante}
                    {i.fecha_nacimiento_aspirante &&
                      ` · Nac: ${new Date(
                        i.fecha_nacimiento_aspirante,
                      ).toLocaleDateString('es-AR')}`}
                  </span>
                </td>
                <td className={tdCell}>
                  {i.nombre_tutor}
                  <br />
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>{i.email_tutor}</span>
                </td>
                <td className={tdCell}>
                  <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {i.nivel_solicitado}
                    {i.grado_anio_solicitado ? ` · ${i.grado_anio_solicitado}` : ''}
                  </span>
                </td>
                <td className={`${tdCell} text-textMuted text-xs`}>
                  {new Date(i.fecha_solicitud).toLocaleDateString('es-AR')}
                </td>
                <td className={tdCell}>
                  <span style={badge(i.documentacion_completa ? '#27AE60' : '#6B6B8A')}>
                    {i.documentacion_completa ? 'Completa' : 'Pendiente'}
                  </span>
                </td>
                <td className={tdCell}>
                  <span style={badge(INSC_COLOR[i.estado] ?? '#6B6B8A')}>{i.estado}</span>
                  {i.id_alumno_creado && (
                    <div className='text-[11px] font-extrabold text-green mt-1'>
                      ✓ Alumno dado de alta
                    </div>
                  )}
                </td>
                <td className={tdCell}>
                  <button
                    className={btnPrimarySm}
                    onClick={() => setDetalleId(i.id_inscripcion)}
                  >
                    Revisar
                  </button>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td className={`${tdCell} text-textMuted`} colSpan={7}>
                  No hay solicitudes con ese estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
