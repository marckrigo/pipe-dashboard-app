import '../styles/landing-page.css';

/** Informational page shown only outside Pipefy, where there is no session to read pipe data. */
export function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <span className="landing-eyebrow">Pipefy · Pipe Dashboard</span>
        <h1>Seu pipe visto por inteiro, sem esperar de novo</h1>
        <p>
          Este app transforma os cards de um pipe em gráficos configuráveis. Ele guarda os dados no
          navegador e busca do Pipefy apenas o que mudou desde a última sincronização.
        </p>
        <div className="landing-badges">
          <span>Gráficos interativos</span>
          <span>Cache local</span>
          <span>Sync incremental</span>
        </div>
      </section>

      <section className="landing-grid" aria-label="Recursos do dashboard">
        <article className="landing-card">
          <span className="landing-number">01</span>
          <h2>Carga completa uma vez</h2>
          <p>
            A primeira abertura percorre o pipe em páginas de 50 cards e salva cada página no
            IndexedDB junto com o cursor. Se fechar no meio, a próxima abertura retoma de onde
            parou.
          </p>
        </article>

        <article className="landing-card">
          <span className="landing-number">02</span>
          <h2>Atualização incremental</h2>
          <p>
            Quando a carga inicial terminou, a abertura do dashboard pede só os cards com{' '}
            <code>updated_at</code> posterior ao último marco salvo. Cards novos ou alterados entram
            no cache sem reler o pipe inteiro.
          </p>
        </article>

        <article className="landing-card">
          <span className="landing-number">03</span>
          <h2>Gráficos sob medida</h2>
          <p>
            Escolha barras, linha, área ou pizza e o campo de agrupamento. Filtros dinâmicos refinam
            a agregação sobre todos os cards já cacheados.
          </p>
        </article>

        <article className="landing-card">
          <span className="landing-number">04</span>
          <h2>Funciona com a rede instável</h2>
          <p>
            Se a consulta ao Pipefy falhar, o dashboard continua mostrando o que já estava no cache.
          </p>
        </article>
      </section>

      <section className="landing-note">
        <strong>Como usar</strong>
        <p>
          Abra este aplicativo dentro de um pipe no Pipefy e selecione a aba <b>Dashboard</b> na
          visualização do pipe. Fora do Pipefy esta página é apenas informativa, porque a integração
          depende da sessão do usuário e da API disponível no ambiente do Pipefy.
        </p>
      </section>
    </main>
  );
}
