## Qué resuelve
<!-- Una o dos frases. Enlazá la tarjeta de Jira o la HU (p. ej. HU2, HU4, Salud). -->

## Qué cambia
<!-- Archivos o módulos tocados, en una lista corta. Un PR = un tema; si necesita más de ~400 líneas, partilo. -->
-

## Cómo probarlo
<!-- Pasos para que el revisor lo reproduzca (usuario del seed, pantalla, resultado esperado). -->
1.

## Migraciones y datos
- [ ] No hay migraciones de Prisma
- [ ] Hay migración (nombre: ...) y avisé a mi compañero antes de correrla

## Checklist del autor
- [ ] `npm run lint` y `npm test` del backend pasan en mi máquina; `pnpm run build` del frontend compila
- [ ] Agregué o actualicé pruebas para la regla que toqué (o expliqué abajo por qué no)
- [ ] Sin secretos, `.env` ni datos reales de alumnos en el diff
- [ ] Actualicé `PENDIENTES.md` / `PRUEBAS-P3.md` si cambió el alcance, y `BITACORA-IA.md` si usé IA
- [ ] El código nuevo no repite clases largas de Tailwind (se usan las constantes de `ui/styles.ts`) y el acceso a datos va en hooks, no en componentes

## Para revisar (puntos donde quiero ojos del compañero)
<!-- Decisiones dudosas, partes riesgosas, cosas que no pude probar. -->

## Checklist del revisor
- [ ] Entendí el cambio sin preguntar (nombres claros, funciones chicas)
- [ ] Probé los pasos de "Cómo probarlo"
- [ ] Las pruebas cubren el caso feliz y al menos un caso de error
- [ ] Los checks del PR están en verde (CI y SonarCloud)
