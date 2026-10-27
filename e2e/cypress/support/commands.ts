/// <reference types="cypress" />

export interface Alumno {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
}

export interface Actividad {
  id_actividad: number
  nombre: string
  tipo: string
  cupo_maximo: number
  inscriptos: number
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Inicia sesión por API y devuelve el token (para preparar datos sin pasar por la pantalla). */
      apiToken(): Chainable<string>
      /** Inicia sesión como admin usando el formulario de /login, como lo hace una persona. */
      loginComoAdminPorPantalla(): Chainable<void>
    }
  }
}

Cypress.Commands.add('apiToken', () =>
  cy
    .request('POST', `${Cypress.expose('apiUrl')}/auth/login`, {
      email: Cypress.expose('adminEmail'),
      password: Cypress.expose('adminPassword'),
    })
    .its('body.token'),
)

Cypress.Commands.add('loginComoAdminPorPantalla', () => {
  cy.visit('/login')
  cy.get('input[type="email"]').type(Cypress.expose('adminEmail'))
  cy.get('input[type="password"]').type(Cypress.expose('adminPassword'), { log: false })
  cy.contains('button[type="submit"]', 'Ingresar').click()
  cy.location('pathname').should('eq', '/admin')
})

export {}
