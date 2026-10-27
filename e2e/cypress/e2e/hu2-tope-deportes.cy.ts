import type { Actividad, Alumno } from '../support/commands'

/**
 * CP-HU2-01 (Unidad 5): un alumno con 2 deportes no puede inscribirse a un tercero.
 * El segundo `it` es la prueba de regresión de la misma regla (límite inferior: el 2.º deporte sí se acepta).
 *
 * La preparación de datos va por API (rápida y determinista); lo que se verifica va por pantalla.
 */
describe('HU2 – Tope de 2 deportes por alumno', () => {
  const api = () => Cypress.expose('apiUrl') as string
  let headers: { Authorization: string }
  let alumno: Alumno
  let deportes: Actividad[] // [A, B, C]: A y B no se superponen en horario (lo garantiza el seed)
  let todosLosDeportes: Actividad[] // también los desactivados: siguen contando para el tope

  // Fecha de hoy en Argentina, como la valida el backend (con toISOString, después de las 21 h ya sería mañana).
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const darDeBajaDeTodo = () =>
    todosLosDeportes.forEach((d) =>
      cy.request({ method: 'DELETE', url: `${api()}/actividades/${d.id_actividad}/inscripciones/${alumno.id_alumno}`, headers, failOnStatusCode: false }),
    )

  before(() => {
    cy.apiToken().then((token) => {
      headers = { Authorization: `Bearer ${token}` }

      cy.request({ url: `${api()}/alumnos?activo=true`, headers }).then(({ body }) => {
        alumno = (body as Alumno[])[0]
      })
      cy.request({ url: `${api()}/actividades?activo=true`, headers }).then(({ body }) => {
        deportes = (body as Actividad[]).filter((a) => a.tipo === 'Deporte' && a.inscriptos < a.cupo_maximo).slice(0, 3)
        expect(deportes, 'el seed tiene al menos 3 deportes con cupo').to.have.length(3)
      })
      cy.request({ url: `${api()}/actividades`, headers }).then(({ body }) => {
        todosLosDeportes = (body as Actividad[]).filter((a) => a.tipo === 'Deporte')
      })
    })
    // Certificado de aptitud vigente (hace falta para inscribirse). Una vez por corrida: el backend rechaza con 409
    // un segundo certificado del mismo día, que es justo lo que pasa si la prueba se repite o se reintenta.
    cy.then(() =>
      cy.request({ method: 'POST', url: `${api()}/salud/alumnos/${alumno.id_alumno}/aptitud`, headers, body: { fecha_emision: hoy() }, failOnStatusCode: false })
        .its('status').should('be.oneOf', [201, 409]),
    )
  })

  beforeEach(() => {
    // Estado de partida: el alumno sin ningún deporte (el seed pudo haberlo anotado en otros además de A, B y C).
    darDeBajaDeTodo()
  })

  /** Abre Extracurriculares → inscriptos del deporte y elige al alumno en el selector. */
  const elegirAlumnoEn = (deporte: Actividad) => {
    cy.loginComoAdminPorPantalla()
    cy.contains('button', 'Extracurriculares').click()
    cy.contains('tr', deporte.nombre).contains('button', 'Inscriptos').click()
    cy.contains('span', `Inscribir alumno a ${deporte.nombre}`)
      .parent()
      .find('select')
      .select(String(alumno.id_alumno))
  }

  it('CP-HU2-01: rechaza el tercer deporte con mensaje descriptivo y no inscribe', () => {
    const [A, B, C] = deportes
    ;[A, B].forEach((d) =>
      cy.request({ method: 'POST', url: `${api()}/actividades/${d.id_actividad}/inscripciones`, headers, body: { id_alumno: alumno.id_alumno } }).its('status').should('eq', 201),
    )

    elegirAlumnoEn(C)
    cy.contains('button', '+ Inscribir').click()

    cy.contains('❌ Error:')
      .should('contain', 'ya está inscripto en 2 deportes')
      .and('contain', A.nombre)
      .and('contain', B.nombre)
      .and('contain', 'primero dalo de baja')
    cy.contains('✅ Alumno inscripto correctamente.').should('not.exist')

    // El alumno sigue sin estar en el tercer deporte (se comprueba contra la API, no solo en pantalla).
    cy.request({ url: `${api()}/actividades/${C.id_actividad}/inscripciones`, headers })
      .its('body')
      .then((inscriptos: { id_alumno: number }[]) => {
        expect(inscriptos.map((i) => i.id_alumno)).not.to.include(alumno.id_alumno)
      })
  })

  it('REGRESIÓN: con un solo deporte, el segundo sí se acepta', () => {
    const [A, B] = deportes
    cy.request({ method: 'POST', url: `${api()}/actividades/${A.id_actividad}/inscripciones`, headers, body: { id_alumno: alumno.id_alumno } })

    elegirAlumnoEn(B)
    cy.contains('button', '+ Inscribir').click()

    cy.contains('✅ Alumno inscripto correctamente.').should('be.visible')
  })

  after(() => {
    // Deja al alumno sin deportes para no ensuciar la demo.
    darDeBajaDeTodo()
  })
})
