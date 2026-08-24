export const meta = {
  name: 'kurogane-critics',
  description: 'Jueces ciegos por pieza: comparan nuestra captura contra la referencia sin etiquetas y nombran la brecha',
  phases: [{ title: 'Juicio', detail: 'un crítico por pieza y viewport, contexto fresco' }],
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['winner', 'margin', 'why', 'gap_A', 'gap_B', 'one_line'],
  properties: {
    winner: { type: 'string', enum: ['A', 'B'] },
    margin: { type: 'string', enum: ['aplastante', 'claro', 'ajustado'] },
    why: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
    gap_A: { type: 'string' },
    gap_B: { type: 'string' },
    one_line: { type: 'string' },
  },
}

const PROMPT = (piece, dir, viewport) => `Eres crítico de diseño de producto. Duro. El elogio no sirve para nada: tu trabajo es encontrar el fallo, no repartir cumplidos.

Se te dan dos capturas de la MISMA zona funcional ("${piece}", viewport ${viewport}) de dos páginas de producto distintas:
- ${dir}/A.png
- ${dir}/B.png

Ábrelas las dos con Read y míralas de verdad, a fondo, antes de escribir nada. Una de las dos pertenece a una de las mejores páginas de producto del mundo; la otra no. No sabes cuál es cuál, y no debes intentar adivinarlo: si reconoces una marca, un producto o un logotipo, es información irrelevante y contaminada — juzga solo el oficio. Alguna zona puede aparecer tapada con un rectángulo gris: es intencionado, ignóralo.

Juzga por este orden de importancia:
1. Jerarquía: ¿sabes en un segundo qué es lo importante? ¿El titular manda de verdad o compite con el resto?
2. Tipografía: escala, tracking, medida de línea, ritmo vertical, equilibrio de pesos, viudas y huérfanas, alineación óptica.
3. Espacio: ¿el aire está distribuido con intención o es relleno? ¿Los márgenes se corresponden entre sí?
4. Imagen: calidad de la foto, integración con el texto, recorte, si la imagen aporta información o solo decora.
5. Color y materia: disciplina de paleta, contraste real de lectura, coherencia.
6. Detalle de acabado: bordes, sombras, estados, alineaciones a subpíxel, cosas mal centradas, texto pisado.
7. Contenido: ¿dice algo concreto o son frases de relleno?

Reglas del veredicto:
- Elige un ganador aunque la diferencia sea pequeña. Nada de empates.
- "margin" es cuánto le saca el ganador al perdedor.
- "why": de 3 a 5 razones CONCRETAS y observables ("el titular de B tiene tracking positivo y se deshilacha a 3 líneas"), nunca genéricas ("A se ve más limpio").
- "gap_A" y "gap_B": para cada imagen, LA ÚNICA brecha más grande que le queda, formulada como un cambio accionable. Si una gana, su gap es lo que aún le falta para ser incuestionable.
- "one_line": una frase de sentencia, sin adornos.

No inventes lo que no puedas ver en las imágenes. No comentes rendimiento ni código: aquí solo se juzga lo que se ve.`

phase('Juicio')

const pairs = args.pairs // [{ piece, dir, viewport }]
const verdicts = await parallel(
  pairs.map((p) => () =>
    agent(PROMPT(p.piece, p.dir, p.viewport), {
      label: `juez:${p.piece}:${p.viewport}`,
      phase: 'Juicio',
      schema: VERDICT,
    }).then((v) => ({ ...p, verdict: v })),
  ),
)

return { verdicts: verdicts.filter(Boolean) }
