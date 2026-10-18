/**
 * GestionDocentes — módulo de profesores (HU 4 de la Parte 2): alta y edición
 * con legajo, DNI, especialidad, título, correo, teléfono y estado, y las
 * materias que dicta en cada curso.
 *
 * Cada materia tiene un solo profesor por curso: si al asignarla ya la dicta
 * otro, el backend avisa y se puede reemplazar (los horarios pasan al nuevo).
 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import { api } from '../../lib/api'
import type { Curso, Docente, Materia } from '../../types'
import {
  Card,
  EstadoBadge,
  Field,
  FormMessage,
  PasswordInput,
  ResponsiveTable,
  SectionHeader,
  type Columna,
} from '../../ui/components'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSecondarySm,
  fieldLabel,
  selectField,
  touchTarget,
} from '../../ui/styles'

type FiltroEstado = 'activos' | 'inactivos' | 'todos'

const FORM_VACIO = {
  nombre: '',
  apellido: '',
  dni: '',
  especialidad: '',
  titulo: '',
  email: '',
  telefono: '',
  fecha_ingreso: '',
  password: '',
}

const nombreDe = (d: Docente) => (d.usuarios ? `${d.usuarios.apellido}, ${d.usuarios.nombre}` : `Docente ${d.id_docente}`)
const cursoTexto = (c: { nivel: string; grado_anio: string; division: string }) => `${c.nivel} · ${c.grado_anio}° ${c.division}`

export function GestionDocentes() {
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [filtro, setFiltro] = useState<FiltroEstado>('activos')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Docente | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  // Docente cuyas materias se están mirando o editando.
  const [idFicha, setIdFicha] = useState<number | null>(null)
  const [nueva, setNueva] = useState({ id_curso: '', id_materia: '' })
  const [msgFicha, setMsgFicha] = useState<{ ok: boolean; texto: string } | null>(null)
  // Se incrementa para volver a pedir los datos después de guardar.
  const [version, setVersion] = useState(0)
  const recargar = () => setVersion((v) => v + 1)
  // En el celular "Editar" y "Materias" están abajo, en la lista: se lleva la vista al panel que se abre.
  const refForm = useRef<HTMLDivElement>(null)
  const refFicha = useRef<HTMLDivElement>(null)
  const mostrar = (ref: RefObject<HTMLDivElement | null>) =>
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

  useEffect(() => {
    let vigente = true
    Promise.all([
      api.get<Docente[]>('/docentes'),
      api.get<Materia[]>('/materias?activo=true'),
      api.get<Curso[]>('/cursos'),
    ]).then(([{ data: d }, { data: m }, { data: c }]) => {
      if (!vigente) return
      if (d) setDocentes(d)
      if (m) setMaterias(m)
      if (c) setCursos(c)
    })
    return () => {
      vigente = false
    }
  }, [version])

  const campo = (k: keyof typeof FORM_VACIO) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setMsg(null)
    setShowForm((v) => !v || !!editando)
  }

  const abrirEdicion = (d: Docente) => {
    setEditando(d)
    setForm({
      nombre: d.usuarios?.nombre ?? '',
      apellido: d.usuarios?.apellido ?? '',
      dni: d.dni ?? '',
      especialidad: d.especialidad ?? '',
      titulo: d.titulo ?? '',
      email: d.usuarios?.email ?? '',
      telefono: d.usuarios?.telefono ?? '',
      fecha_ingreso: d.fecha_ingreso?.slice(0, 10) ?? '',
      password: '',
    })
    setMsg(null)
    setShowForm(true)
    mostrar(refForm)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const { password, ...datos } = form
    const { error } = editando
      ? await api.put(`/docentes/${editando.id_docente}`, datos)
      : await api.post('/docentes', { ...datos, password })
    if (error) {
      setMsg({ ok: false, texto: error.message })
      return
    }
    setMsg({ ok: true, texto: editando ? 'Docente actualizado.' : 'Docente creado: ya puede entrar con su correo y la contraseña inicial.' })
    setEditando(null)
    setForm(FORM_VACIO)
    if (editando) setShowForm(false)
    recargar()
  }

  const cambiarEstado = async (d: Docente) => {
    setMsg(null)
    const enviar = (confirmar?: boolean) => api.patch(`/docentes/${d.id_docente}`, { activo: !d.activo, confirmar })
    let error = (await enviar()).error
    // Con materias a cargo el backend pide confirmar la baja.
    if (error?.code === 'DOCENTE_CON_ASIGNACIONES') {
      if (!confirm(error.message)) return
      error = (await enviar(true)).error
    }
    if (error) setMsg({ ok: false, texto: error.message })
    else setMsg({ ok: true, texto: d.activo ? `Se dio de baja a ${nombreDe(d)}.` : `Se reactivó a ${nombreDe(d)}.` })
    recargar()
  }

  const ficha = docentes.find((d) => d.id_docente === idFicha) ?? null

  const asignar = async (e: FormEvent) => {
    e.preventDefault()
    if (!ficha) return
    setMsgFicha(null)
    const enviar = (reemplazar?: boolean) =>
      api.post('/asignaciones', {
        id_docente: ficha.id_docente,
        id_materia: Number(nueva.id_materia),
        id_curso: Number(nueva.id_curso),
        reemplazar,
      })
    let error = (await enviar()).error
    // La materia ya tiene profesor en ese curso: se ofrece reemplazarlo.
    if (error?.code === 'MATERIA_CON_PROFESOR') {
      if (!confirm(error.message)) return
      error = (await enviar(true)).error
    }
    if (error) {
      setMsgFicha({ ok: false, texto: error.message })
      return
    }
    setMsgFicha({ ok: true, texto: 'Materia asignada.' })
    setNueva((n) => ({ ...n, id_materia: '' }))
    recargar()
  }

  const quitar = async (idAsignacion: number, texto: string) => {
    if (!confirm(`¿Quitar ${texto}? Las notas y la asistencia ya cargadas se conservan.`)) return
    setMsgFicha(null)
    const { error } = await api.patch(`/asignaciones/${idAsignacion}`, { activo: false })
    if (error) setMsgFicha({ ok: false, texto: error.message })
    recargar()
  }

  const visibles = docentes.filter((d) => (filtro === 'todos' ? true : filtro === 'activos' ? d.activo : !d.activo))

  const columnas: Columna<Docente>[] = [
    { key: 'docente', header: 'Docente', movil: 'titulo', className: 'font-bold', render: nombreDe },
    { key: 'legajo', header: 'Legajo', render: (d) => d.id_docente },
    { key: 'dni', header: 'DNI', render: (d) => d.dni ?? '—' },
    { key: 'especialidad', header: 'Especialidad', render: (d) => d.especialidad ?? '—' },
    { key: 'email', header: 'Correo', className: 'text-textMuted', render: (d) => d.usuarios?.email ?? '—' },
    { key: 'telefono', header: 'Teléfono', render: (d) => d.usuarios?.telefono ?? '—' },
    { key: 'materias', header: 'Materias', render: (d) => d.asignaciones.length },
    { key: 'estado', header: 'Estado', render: (d) => <EstadoBadge activo={d.activo} /> },
    {
      key: 'acciones',
      header: 'Acciones',
      movil: 'pie',
      render: (d) => (
        <div className='flex gap-1.5 flex-wrap'>
          <button className={`${btnSecondarySm} ${touchTarget}`} onClick={() => abrirEdicion(d)}>
            Editar
          </button>
          <button
            className={`${btnSecondarySm} ${touchTarget}`}
            onClick={() => {
              setIdFicha(d.id_docente)
              setMsgFicha(null)
              mostrar(refFicha)
            }}
          >
            Materias
          </button>
          <button className={`${d.activo ? btnDanger : btnSecondarySm} ${touchTarget}`} onClick={() => cambiarEstado(d)}>
            {d.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <SectionHeader
        title='👨‍🏫 Docentes'
        action={
          <button className={btnPrimary} onClick={abrirNuevo}>
            {showForm && !editando ? 'Cancelar' : '+ Nuevo docente'}
          </button>
        }
      />

      {showForm && (
        <div ref={refForm} className='scroll-mt-20'>
          <Card className='mb-5'>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              {editando ? `Editar a ${nombreDe(editando)} · Legajo ${editando.id_docente}` : 'Nuevo docente'}
            </div>
            <form onSubmit={guardar} className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[14px] items-end'>
              <Field label='Nombre' required value={form.nombre} onChange={campo('nombre')} />
              <Field label='Apellido' required value={form.apellido} onChange={campo('apellido')} />
              <Field label='DNI' required placeholder='Sin puntos' value={form.dni} onChange={campo('dni')} />
              <Field label='Especialidad' placeholder='Ej: Matemática' value={form.especialidad} onChange={campo('especialidad')} />
              <Field label='Título' placeholder='Ej: Profesorado' value={form.titulo} onChange={campo('titulo')} />
              <Field label='Fecha de ingreso' type='date' value={form.fecha_ingreso} onChange={campo('fecha_ingreso')} />
              <Field label='Correo' type='email' required value={form.email} onChange={campo('email')} />
              <Field label='Teléfono' type='tel' value={form.telefono} onChange={campo('telefono')} />
              {!editando && (
                <div>
                  <label className={fieldLabel} htmlFor='docente-password'>
                    Contraseña inicial
                  </label>
                  <PasswordInput
                    id='docente-password'
                    required
                    minLength={6}
                    autoComplete='new-password'
                    value={form.password}
                    onChange={(e) => campo('password')(e.target.value)}
                  />
                </div>
              )}
              <div className='col-span-full flex flex-col md:flex-row md:items-center gap-3'>
                <button type='submit' className={`${btnPrimary} ${touchTarget} w-full md:w-auto`}>
                  {editando ? 'Guardar cambios' : 'Crear docente'}
                </button>
                {editando && (
                  <button
                    type='button'
                    className={`${btnSecondary} ${touchTarget} w-full md:w-auto`}
                    onClick={() => {
                      setEditando(null)
                      setShowForm(false)
                    }}
                  >
                    Cancelar
                  </button>
                )}
                {msg && (
                  <span role='status'>
                    <FormMessage ok={msg.ok}>{msg.texto}</FormMessage>
                  </span>
                )}
              </div>
            </form>
            {!editando && (
              <p className='text-[12px] text-textMuted mt-4 mb-0'>
                El docente entra al sistema con su correo y esta contraseña, y puede cambiarla desde "Mi contraseña".
              </p>
            )}
          </Card>
        </div>
      )}

      {!showForm && msg && (
        <div className='mb-4' role='status'>
          <FormMessage ok={msg.ok}>{msg.texto}</FormMessage>
        </div>
      )}

      {ficha && (
        <div ref={refFicha} className='scroll-mt-20'>
          <Card className='mb-5'>
            <div className='flex flex-wrap gap-3 justify-between items-center mb-4'>
              <div className='text-[15px] font-extrabold text-text'>
                Materias de {nombreDe(ficha)} · Legajo {ficha.id_docente}
              </div>
              <button className={`${btnSecondarySm} ${touchTarget}`} onClick={() => setIdFicha(null)}>
                Cerrar
              </button>
            </div>

            {ficha.asignaciones.length === 0 ? (
              <p className='text-[13px] text-textMuted m-0 mb-4'>Todavía no tiene materias a cargo.</p>
            ) : (
              <ul className='list-none m-0 mb-4 p-0 flex flex-col gap-2'>
                {ficha.asignaciones.map((a) => {
                  const texto = `${a.materias.nombre} de ${a.cursos.grado_anio}° ${a.cursos.division}`
                  return (
                    <li key={a.id_asignacion} className='flex flex-wrap gap-2 items-center justify-between border border-border rounded-input px-3 py-2'>
                      <span className='text-[13px]'>
                        <strong>{a.materias.nombre}</strong> <span className='text-textMuted'>· {cursoTexto(a.cursos)}</span>
                      </span>
                      {ficha.activo && (
                        <button className={`${btnDanger} ${touchTarget}`} onClick={() => quitar(a.id_asignacion, texto)}>
                          Quitar
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {ficha.activo ? (
              <form onSubmit={asignar} className='grid grid-cols-1 sm:grid-cols-3 gap-[14px] items-end'>
                <div>
                  <label className={fieldLabel} htmlFor='asignar-curso'>
                    Curso
                  </label>
                  <select
                    id='asignar-curso'
                    className={selectField}
                    required
                    value={nueva.id_curso}
                    onChange={(e) => setNueva((n) => ({ ...n, id_curso: e.target.value }))}
                  >
                    <option value=''>Seleccioná...</option>
                    {cursos.map((c) => (
                      <option key={c.id_curso} value={c.id_curso}>
                        {cursoTexto(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor='asignar-materia'>
                    Materia
                  </label>
                  <select
                    id='asignar-materia'
                    className={selectField}
                    required
                    value={nueva.id_materia}
                    onChange={(e) => setNueva((n) => ({ ...n, id_materia: e.target.value }))}
                  >
                    <option value=''>Seleccioná...</option>
                    {materias.map((m) => (
                      <option key={m.id_materia} value={m.id_materia}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <button type='submit' className={`${btnPrimary} ${touchTarget}`}>
                  Asignar materia
                </button>
                {msgFicha && (
                  <div className='col-span-full' role='status'>
                    <FormMessage ok={msgFicha.ok}>{msgFicha.texto}</FormMessage>
                  </div>
                )}
              </form>
            ) : (
              <p className='text-[13px] text-textMuted m-0'>Está de baja: reactivá su legajo para asignarle materias.</p>
            )}
          </Card>
        </div>
      )}

      <Card>
        <div className='flex flex-wrap gap-2 items-center mb-5'>
          {(['activos', 'inactivos', 'todos'] as const).map((f) => (
            <button
              key={f}
              type='button'
              aria-pressed={filtro === f}
              className={`${filtro === f ? btnPrimary : btnSecondary} ${touchTarget}`}
              onClick={() => setFiltro(f)}
            >
              {f === 'activos' ? 'Activos' : f === 'inactivos' ? 'De baja' : 'Todos'}
            </button>
          ))}
        </div>
        <ResponsiveTable columnas={columnas} filas={visibles} filaKey={(d) => d.id_docente} vacio='No hay docentes con ese filtro.' />
      </Card>
    </div>
  )
}
