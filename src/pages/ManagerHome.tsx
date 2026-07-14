import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAtividadeModal } from '../context/AtividadeModalContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchAllAtividades,
  fetchAtividadeStats,
} from '../services/atividadesService';
import { isAtividadeAberta } from '../utils/atividadesDomain';

export default function ManagerHome() {
  const { openAddAtividade, registerOnCreated } = useAtividadeModal();
  const { user } = useAuth();
  const userName = user?.nome?.split(' ')[0] ?? 'Usuário';

  const [stats, setStats] = useState({ total: 0, pendentes: 0, concluidas: 0, abertas: 0 });
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAllAtividades();
      const computed = fetchAtividadeStats(rows);
      const abertas = rows.filter(isAtividadeAberta).length;
      setStats({
        total: computed.total,
        pendentes: computed.pendentes,
        concluidas: computed.concluidas,
        abertas,
      });
    } catch {
      setStats({ total: 0, pendentes: 0, concluidas: 0, abertas: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const unregister = registerOnCreated(loadSummary);
    return unregister;
  }, [registerOnCreated, loadSummary]);

  const hasAtividades = stats.total > 0;

  return (
    <>
      <h1 className="greeting">👋 Olá, {userName}. Bem-vindo!</h1>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Atividades</h2>
          <p className="card-subtitle">Acompanhe o progresso dos promotores</p>
        </div>

        {loading ? (
          <div className="empty-state">
            <p className="empty-desc">Carregando atividades...</p>
          </div>
        ) : hasAtividades ? (
          <div className="home-atividades-summary">
            <div className="home-atividades-kpis">
              <div className="home-atividades-kpi">
                <span className="home-atividades-kpi-value">{stats.abertas}</span>
                <span className="home-atividades-kpi-label">Em aberto</span>
              </div>
              <div className="home-atividades-kpi">
                <span className="home-atividades-kpi-value warn">{stats.pendentes}</span>
                <span className="home-atividades-kpi-label">Em andamento</span>
              </div>
              <div className="home-atividades-kpi">
                <span className="home-atividades-kpi-value ok">{stats.concluidas}</span>
                <span className="home-atividades-kpi-label">Concluídas</span>
              </div>
              <div className="home-atividades-kpi">
                <span className="home-atividades-kpi-value">{stats.total}</span>
                <span className="home-atividades-kpi-label">Total</span>
              </div>
            </div>
            <div className="home-atividades-actions">
              <Link to="/atividades" className="link-action">
                Ver todas as atividades
              </Link>
              <button type="button" className="link-action" onClick={openAddAtividade}>
                Nova atividade
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">+</div>
            <p className="empty-title">Você ainda não possui atividades</p>
            <p className="empty-desc">
              Crie atividades e envie para os promotores acompanharem no app mobile.
            </p>
            <button type="button" className="link-action" onClick={openAddAtividade}>
              Adicionar atividade
            </button>
          </div>
        )}
      </section>

      <div className="bottom-cards">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Colaboradores</h2>
            <p className="card-subtitle">Veja/Adicione seus colaboradores</p>
          </div>
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p className="empty-title">Gerencie sua equipe</p>
            <p className="empty-desc">
              Cadastre promotores e acompanhe os colaboradores da representação.
            </p>
            <Link to="/colaboradores" className="link-action">
              Ver meus colaboradores
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Treinamentos</h2>
            <p className="card-subtitle">cadastre seus treinamentos</p>
          </div>
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p className="empty-title">Você ainda não possui treinamentos</p>
            <p className="empty-desc">
              No momento, ainda não existem tarefas agendadas para você.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
