import { Link } from 'react-router-dom';
import AppIcon from '../components/icons/AppIcon';
import { useAuth } from '../context/AuthContext';
import {
  PORTAL_MODULES,
  firstPathForModule,
  userHasModuleAccess,
} from '../data/portalModules';
import './PortalHome.css';

export default function PortalHome() {
  const { user } = useAuth();
  const firstName = user?.nome?.split(' ')[0] ?? 'Usuário';

  const modules = PORTAL_MODULES.filter((mod) =>
    userHasModuleAccess(
      user?.cargo ?? '',
      user?.modulos_acesso,
      mod.id,
      user?.secoes_acesso,
      {
        isSuperAdmin: user?.is_super_admin,
        hubSistemas: user?.hub_sistemas,
      },
    ),
  );

  return (
    <div className="portal-home">
      <header className="portal-hero">
        <h1 className="portal-greeting">Bem-vindo, {firstName}!</h1>
        <p className="portal-subtitle">
          Selecione o módulo que deseja acessar para começar suas atividades.
        </p>
      </header>

      <div className="portal-grid">
        {modules.map((mod) => (
          <article key={mod.id} className="portal-card">
            <div className="portal-card-top">
              <span className="portal-status">
                <span className="portal-status-dot" aria-hidden />
                Ativo
              </span>
              <span className="portal-badge">{mod.badge}</span>
            </div>

            <div className="portal-card-icon" aria-hidden>
              <AppIcon name={mod.icon} size={26} />
            </div>

            <h2 className="portal-card-title">{mod.title}</h2>
            <p className="portal-card-desc">{mod.description}</p>

            <Link
              to={firstPathForModule(mod.id, user?.secoes_acesso)}
              className="portal-card-cta"
            >
              Acessar
              <span aria-hidden>→</span>
            </Link>
          </article>
        ))}
      </div>

      {modules.length === 0 && (
        <p className="portal-subtitle">
          Nenhum módulo liberado para o seu usuário. Fale com um gerente ou administrador.
        </p>
      )}
    </div>
  );
}
