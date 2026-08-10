import { useTheme } from '../context/ThemeContext';

export default function InfoPage() {
  const { theme, headerColor } = useTheme();

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className={`text-xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        Información
      </h1>

      <div className="ui-panel p-4 sm:p-6 space-y-6">
        <section>
          <h2 className="ui-label ui-label-lg mb-3" style={{ color: headerColor }}>
            Bienvenido a Nutri11
          </h2>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed">
            Anotá qué comés en cada momento del día. Simple: elegís el momento, escribís qué
            comiste y, si querés, la hora.
          </p>
        </section>

        <section>
          <h2 className="ui-label ui-label-lg mb-3" style={{ color: headerColor }}>
            Cómo empezar
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-[var(--text-muted)] text-sm">
            <li>
              <strong className="text-[var(--text)]">Pack inicial</strong> — Al entrar tenés Desayuno,
              Media mañana, Almuerzo, Merienda y Cena
            </li>
            <li>
              <strong className="text-[var(--text)]">Anotar</strong> — Tocá Anotar, elegí el momento y
              escribí qué comiste (la hora es opcional)
            </li>
            <li>
              <strong className="text-[var(--text)]">Historial</strong> — Revisá, editá o borrá registros
              anteriores
            </li>
            <li>
              <strong className="text-[var(--text)]">Gestión</strong> — Agregá o reordená momentos si
              querés personalizarlos
            </li>
          </ol>
        </section>

        <section>
          <h2 className="ui-label ui-label-lg mb-3" style={{ color: headerColor }}>
            Tips
          </h2>
          <ul className="space-y-2 text-[var(--text-muted)] text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: headerColor }} />
              Podés anotar con detalle (“tostadas con palta y huevo”) o corto (“almuerzo casero”).
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: headerColor }} />
              La hora es opcional: sirve si querés ver a qué hora comiste.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: headerColor }} />
              En el perfil podés cambiar el color del header y el título de la app.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
