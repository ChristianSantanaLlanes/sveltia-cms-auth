export const meta = {
  name: 'kurogane-fix',
  description: 'Segunda pasada: cada pieza vuelve a su constructor con el veredicto del crítico y la brecha nombrada',
  phases: [{ title: 'Rehacer', detail: 'un constructor por pieza perdida, contexto fresco' }],
}

const ROOT = '/home/user/sveltia-cms-auth'
const SCRATCH = '/tmp/claude-0/-home-user-sveltia-cms-auth/1330c57c-df42-5ebc-aecf-14a4f255d383/scratchpad'

const PROMPT = (job) => `Eres el constructor de UNA pieza de la landing + tienda de katanas KUROGANE (${ROOT}).
Pieza: **${job.piece}**. Ya existe una versión tuya y ha pasado por un crítico ciego que la ha comparado con la misma zona de apple.com/airpods-pro sin etiquetas.

LEE PRIMERO: ${ROOT}/site/src/CONTRACT.md (reglas duras, IDs obligatorios, API de JS, nombres de imagen).

Veredicto del crítico (ronda ${job.round}):
${job.verdictText}

Mira con tus propios ojos antes de tocar nada:
- Nuestra pieza ahora mismo: ${job.ourDesktop} y ${job.ourMobile}
- La referencia de Apple para esta zona: ${job.refDesktop}${job.refMobile ? ` y ${job.refMobile}` : ''}
${job.extra ? `\nAdemás hay que arreglar esto sí o sí:\n${job.extra}\n` : ''}
Tus archivos (no toques ningún otro):
${job.files.map((f) => `- ${f}`).join('\n')}

Trabajo:
1. Ataca la brecha nombrada por el crítico como prioridad número uno. No repartas el esfuerzo: si la brecha es la jerarquía tipográfica, rehaz la jerarquía tipográfica.
2. No hagas retoques cosméticos que no cambien el veredicto. Si hace falta rehacer la composición entera, rehazla.
3. Verifica que sigue compilando: cd ${ROOT} && node tools/build.mjs
4. No rompas los ganchos de comportamiento (data-*) ni los IDs: los usan los tests.

Devuelve como texto final, máximo 6 líneas: qué cambiaste para cerrar la brecha y qué has decidido NO cambiar y por qué.`

phase('Rehacer')
const results = await parallel(
  args.jobs.map((job) => () => agent(PROMPT(job), { label: `fix:${job.piece}`, phase: 'Rehacer' })),
)
return { fixed: results.map((r, i) => ({ piece: args.jobs[i].piece, summary: (r || '').slice(0, 300) })) }
