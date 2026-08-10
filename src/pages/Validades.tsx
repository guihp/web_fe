import BackToPortal from '../components/layout/BackToPortal';
import './Validades.css';

export default function Validades() {
  return (
    <div className="validades-page">
      <BackToPortal />

      <header className="validades-header">
        <div>
          <h1 className="page-title">Validades</h1>
          <p className="validades-subtitle">
            Módulo liberado para todos os usuários. O conteúdo será construído em seguida.
          </p>
        </div>
      </header>

      <section className="card validades-placeholder">
        <h2>Em breve</h2>
        <p>Aqui ficará o controle de validades da operação.</p>
      </section>
    </div>
  );
}
