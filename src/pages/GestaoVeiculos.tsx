import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import HodometroFotoField from '../components/veiculos/HodometroFotoField';
import ExcluirVeiculoModal from '../components/veiculos/ExcluirVeiculoModal';
import VeiculoFilePicker from '../components/veiculos/VeiculoFilePicker';
import DateBrField from '../components/veiculos/DateBrField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatNumberBr, parseNumberBr } from '../lib/numberBr';
import {
  canAccessGestaoVeiculos,
  canApproveVeiculoPrestacao,
  canManageUsers,
  userHasSectionAccess,
} from '../data/portalModules';
import {
  acaoAprovacao,
  abrirManutencao,
  calcCombustivel,
  concluirManutencao,
  createResponsabilidade,
  createVeiculo,
  deleteVeiculo,
  fetchAuditoria,
  fetchConfigVeiculo,
  fetchDashboardVeiculos,
  fetchEntregaDetalhe,
  fetchEntregas,
  fetchManutencoes,
  fetchQuemEstaComVeiculo,
  fetchResponsabilidades,
  fetchRetiradaByResp,
  fetchUsuariosVeiculoElegiveis,
  fetchVeiculos,
  formatDateBR,
  formatMoneyBR,
  registrarEntrega,
  registrarRetirada,
  updateConfigVeiculo,
  updateVeiculo,
  uploadVeiculoAnexo,
  type Veiculo,
  type VeiculoAbastecimento,
  type VeiculoEntrega,
  type VeiculoInput,
  type VeiculoManutencao,
  type VeiculoResponsabilidade,
  type VeiculoSituacao,
  type VeiculoTipo,
} from '../services/veiculosService';
import './GestaoVeiculos.css';

type Variant = 'admin' | 'fe';

type TabId =
  | 'frota'
  | 'responsabilidades'
  | 'meus'
  | 'aprovacao'
  | 'manutencao'
  | 'quem'
  | 'dashboard'
  | 'config'
  | 'historico'
  | 'relatorios';

function labelStatusEntrega(status: string): string {
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    veiculo_retirado: 'Veículo retirado',
    aguardando_aprovacao: 'Aguardando aprovação',
    correcao_solicitada: 'Correção solicitada',
    rejeitado: 'Rejeitado',
    aprovado: 'Aprovado',
    finalizado: 'Finalizado',
  };
  return map[status] ?? status;
}

function toneStatusEntrega(status: string): 'ok' | 'warn' | 'err' | 'info' | 'muted' {
  if (status === 'aprovado' || status === 'finalizado') return 'ok';
  if (status === 'rejeitado') return 'err';
  if (status === 'correcao_solicitada' || status === 'aguardando_aprovacao') return 'warn';
  if (status === 'veiculo_retirado') return 'info';
  return 'muted';
}

function StatusEntregaBadge({ status }: { status: string }) {
  return (
    <span className={`gv-status-badge gv-status-${toneStatusEntrega(status)}`}>
      {labelStatusEntrega(status)}
    </span>
  );
}

function emptyVeiculo(): VeiculoInput {
  return {
    tipo: 'carro',
    marca: '',
    modelo: '',
    placa: '',
    ano: null,
    cor: '',
    consumo_medio_km_l: null,
    foto_url: null,
    situacao: 'disponivel',
  };
}

export default function GestaoVeiculos({ variant }: { variant: Variant }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const cargo = user?.cargo ?? '';
  const canUse = canAccessGestaoVeiculos(cargo, user?.tipo_usuario);
  const canApprove = canApproveVeiculoPrestacao(cargo);
  const isAdminHub = variant === 'admin';

  const sectionOk = isAdminHub
    ? canManageUsers(cargo) &&
      userHasSectionAccess(cargo, user?.secoes_acesso, 'administrador.veiculos')
    : canUse && userHasSectionAccess(cargo, user?.secoes_acesso, 'fe-representacoes.veiculos');

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string }[] = [];
    if (isAdminHub || canApprove) list.push({ id: 'frota', label: 'Frota' });
    if (isAdminHub) {
      list.push({ id: 'responsabilidades', label: 'Responsabilidades' });
      list.push({ id: 'dashboard', label: 'Dashboard' });
      list.push({ id: 'config', label: 'Config' });
      list.push({ id: 'historico', label: 'Histórico' });
    }
    if (!isAdminHub) {
      list.push({ id: 'meus', label: 'Meus veículos' });
      if (canApprove) {
        list.push({ id: 'aprovacao', label: 'Aprovação' });
        list.push({ id: 'relatorios', label: 'Relatórios' });
      }
    }
    list.push({ id: 'manutencao', label: 'Manutenção' });
    list.push({ id: 'quem', label: 'Quem está com o veículo' });
    return list;
  }, [isAdminHub, canApprove]);

  const tab = (params.get('tab') as TabId) || tabs[0]?.id || 'meus';
  const setTab = (id: TabId) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    next.delete('resp');
    next.delete('entrega');
    next.delete('step');
    setParams(next);
  };

  if (!user || !sectionOk) {
    return <Navigate to={isAdminHub ? '/administrador' : '/fe-representacoes'} replace />;
  }

  const backTo = isAdminHub ? '/administrador' : '/fe-representacoes';
  const backLabel = isAdminHub ? 'Voltar ao Administrador' : 'Voltar a Fé Representações';

  return (
    <div className="gestao-veiculos-page">
      <BackToPortal to={backTo} label={backLabel} />
      <header className="gestao-veiculos-header">
        <h1 className="page-title">Gestão de Veículos</h1>
        <p className="gestao-veiculos-sub">
          Controle de frota, responsabilidades semanais e prestação de contas.
        </p>
      </header>

      <nav className="gestao-veiculos-tabs" aria-label="Seções">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="gestao-veiculos-body">
        {tab === 'frota' && canApprove && (
          <FrotaPanel
            actor={{ id: Number(user.id), cargo }}
            onToast={showToast}
          />
        )}
        {tab === 'responsabilidades' && isAdminHub && (
          <ResponsabilidadesPanel actor={{ id: Number(user.id), cargo }} onToast={showToast} />
        )}
        {tab === 'meus' && !isAdminHub && (
          <MeusVeiculosPanel
            actor={{ id: Number(user.id), cargo, nome: user.nome ?? '' }}
            onToast={showToast}
            canEditDates={canApprove}
          />
        )}
        {tab === 'aprovacao' && canApprove && (
          <AprovacaoPanel actor={{ id: Number(user.id), cargo }} onToast={showToast} />
        )}
        {tab === 'manutencao' && (
          <ManutencaoPanel
            actor={{ id: Number(user.id), cargo }}
            onToast={showToast}
            canEdit={canApprove}
          />
        )}
        {tab === 'quem' && <QuemPanel />}
        {tab === 'dashboard' && isAdminHub && <DashboardPanel />}
        {tab === 'config' && isAdminHub && canApprove && (
          <ConfigPanel actor={{ id: Number(user.id), cargo }} onToast={showToast} />
        )}
        {tab === 'historico' && isAdminHub && <HistoricoPanel />}
        {tab === 'relatorios' && canApprove && <RelatoriosPanel />}
      </div>
    </div>
  );
}

function FrotaPanel({
  actor,
  onToast,
}: {
  actor: { id: number; cargo: string };
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [items, setItems] = useState<Veiculo[]>([]);
  const [form, setForm] = useState<VeiculoInput>(emptyVeiculo());
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Veiculo | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchVeiculos());
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao carregar frota.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await updateVeiculo(editId, form, actor);
      else await createVeiculo(form, actor);
      onToast(editId ? 'Veículo atualizado.' : 'Veículo cadastrado.', 'success');
      setForm(emptyVeiculo());
      setEditId(null);
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onFoto = async (file: File | null) => {
    if (!file) return;
    try {
      const url = await uploadVeiculoAnexo(actor.id, 'frota', file);
      setForm((f) => ({ ...f, foto_url: url }));
      onToast('Foto enviada.', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha no upload.', 'error');
    }
  };

  return (
    <div className="gv-grid-2">
      <form className="gv-card" onSubmit={onSubmit}>
        <h2>{editId ? 'Editar veículo' : 'Novo veículo'}</h2>
        <label>
          Tipo
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as VeiculoTipo })}
          >
            <option value="carro">Carro</option>
            <option value="moto">Moto</option>
          </select>
        </label>
        <label>
          Marca
          <input
            required
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
          />
        </label>
        <label>
          Modelo
          <input
            required
            value={form.modelo}
            onChange={(e) => setForm({ ...form, modelo: e.target.value })}
          />
        </label>
        <label>
          Placa
          <input
            required
            value={form.placa}
            onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
          />
        </label>
        <label>
          Ano
          <input
            type="number"
            value={form.ano ?? ''}
            onChange={(e) =>
              setForm({ ...form, ano: e.target.value ? Number(e.target.value) : null })
            }
          />
        </label>
        <label>
          Cor
          <input value={form.cor ?? ''} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
        </label>
        <label>
          Consumo médio (km/l)
          <input
            type="number"
            step="0.1"
            value={form.consumo_medio_km_l ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                consumo_medio_km_l: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label>
          Situação
          <select
            value={form.situacao}
            onChange={(e) => setForm({ ...form, situacao: e.target.value as VeiculoSituacao })}
          >
            <option value="disponivel">Disponível</option>
            <option value="em_uso">Em uso</option>
            <option value="manutencao">Em manutenção</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
        <VeiculoFilePicker
          label="Foto do veículo"
          accept="image/*"
          capture="environment"
          buttonText="Escolher foto"
          emptyText="Nenhuma foto selecionada"
          onFile={(file) => void onFoto(file)}
        />
        {form.foto_url && (
          <img src={form.foto_url} alt="Prévia" className="gv-thumb" />
        )}
        <div className="gv-actions">
          <button type="submit" className="gv-btn primary" disabled={saving}>
            {saving ? 'Salvando…' : editId ? 'Salvar' : 'Cadastrar'}
          </button>
          {editId && (
            <button
              type="button"
              className="gv-btn"
              onClick={() => {
                setEditId(null);
                setForm(emptyVeiculo());
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="gv-card">
        <h2>Frota ({items.length})</h2>
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <ul className="gv-list">
            {items.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>
                    {v.placa} — {v.marca} {v.modelo}
                  </strong>
                  <span className="gv-muted">
                    {v.tipo} · {v.situacao}
                    {v.ano ? ` · ${v.ano}` : ''}
                  </span>
                </div>
                <div className="gv-actions">
                  <button
                    type="button"
                    className="gv-btn"
                    onClick={() => {
                      setEditId(v.id);
                      setForm({
                        tipo: v.tipo,
                        marca: v.marca,
                        modelo: v.modelo,
                        placa: v.placa,
                        ano: v.ano,
                        cor: v.cor ?? '',
                        consumo_medio_km_l: v.consumo_medio_km_l,
                        foto_url: v.foto_url,
                        situacao: v.situacao,
                      });
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="gv-btn danger"
                    onClick={() => setPendingDelete(v)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingDelete && (
        <ExcluirVeiculoModal
          veiculo={pendingDelete}
          deleting={deletingId === pendingDelete.id}
          onClose={() => {
            if (deletingId) return;
            setPendingDelete(null);
          }}
          onConfirm={async () => {
            const target = pendingDelete;
            setDeletingId(target.id);
            try {
              await deleteVeiculo(target.id, actor);
              onToast('Veículo removido/inativado.', 'success');
              setPendingDelete(null);
              if (editId === target.id) {
                setEditId(null);
                setForm(emptyVeiculo());
              }
              await load();
            } catch (err) {
              onToast(err instanceof Error ? err.message : 'Erro.', 'error');
            } finally {
              setDeletingId(null);
            }
          }}
        />
      )}
    </div>
  );
}

function ResponsabilidadesPanel({
  actor,
  onToast,
}: {
  actor: { id: number; cargo: string };
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [users, setUsers] = useState<{ id: number; nome: string; cargo: string }[]>([]);
  const [rows, setRows] = useState<VeiculoResponsabilidade[]>([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [veiculoId, setVeiculoId] = useState('');
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 16));
  const [prevista, setPrevista] = useState('');
  const [obs, setObs] = useState('');

  const load = async () => {
    const [v, u, r] = await Promise.all([
      fetchVeiculos(),
      fetchUsuariosVeiculoElegiveis(),
      fetchResponsabilidades(),
    ]);
    setVeiculos(v.filter((x) => x.situacao !== 'inativo'));
    setUsers(u);
    setRows(r);
  };

  useEffect(() => {
    void load().catch((e) => onToast(e instanceof Error ? e.message : 'Erro.', 'error'));
  }, []);

  return (
    <div className="gv-grid-2">
      <form
        className="gv-card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await createResponsabilidade(
              {
                usuario_id: Number(usuarioId),
                veiculo_id: veiculoId,
                inicio_em: new Date(inicio).toISOString(),
                devolucao_prevista_em: prevista ? new Date(prevista).toISOString() : null,
                observacoes: obs || null,
              },
              actor,
            );
            onToast('Responsabilidade registrada.', 'success');
            setObs('');
            await load();
          } catch (err) {
            onToast(err instanceof Error ? err.message : 'Erro.', 'error');
          }
        }}
      >
        <h2>Vincular responsável</h2>
        <label>
          Funcionário
          <select required value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Selecione</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} ({u.cargo})
              </option>
            ))}
          </select>
        </label>
        <label>
          Veículo
          <select required value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} — {v.marca} {v.modelo} [{v.situacao}]
              </option>
            ))}
          </select>
        </label>
        <label>
          Início
          <input type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Devolução prevista
          <input type="datetime-local" value={prevista} onChange={(e) => setPrevista(e.target.value)} />
        </label>
        <label>
          Observações
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
        </label>
        <button type="submit" className="gv-btn primary">
          Salvar vínculo
        </button>
      </form>
      <div className="gv-card">
        <h2>Histórico de vínculos</h2>
        <ul className="gv-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div>
                <strong>
                  {r.veiculos?.placa ?? r.veiculo_id} · {r.usuario_nome}
                </strong>
                <span className="gv-muted">
                  {r.status} · {formatDateBR(r.inicio_em)}
                  {r.devolucao_prevista_em ? ` → ${formatDateBR(r.devolucao_prevista_em)}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MeusVeiculosPanel({
  actor,
  onToast,
  canEditDates,
}: {
  actor: { id: number; cargo: string; nome: string };
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  canEditDates: boolean;
}) {
  const [rows, setRows] = useState<VeiculoResponsabilidade[]>([]);
  const [selected, setSelected] = useState<VeiculoResponsabilidade | null>(null);
  const [mode, setMode] = useState<'list' | 'retirada' | 'entrega' | 'resumo'>('list');
  const [retiradaDone, setRetiradaDone] = useState(false);

  // retirada state
  const [fotoIni, setFotoIni] = useState('');
  const [kmIni, setKmIni] = useState('');
  const [kmIniIa, setKmIniIa] = useState<number | null>(null);
  const [combIni, setCombIni] = useState('1/2');
  const [conserv, setConserv] = useState('Bom');
  const [obsRet, setObsRet] = useState('');
  const [retiradaEm, setRetiradaEm] = useState(() => new Date().toISOString().slice(0, 16));

  // entrega state
  const [fotoFim, setFotoFim] = useState('');
  const [kmFim, setKmFim] = useState('');
  const [kmFimIa, setKmFimIa] = useState<number | null>(null);
  const [combFim, setCombFim] = useState('1/2');
  const [lavado, setLavado] = useState(false);
  const [precoComb, setPrecoComb] = useState('6');
  const [obsEnt, setObsEnt] = useState('');
  const [lavagemValor, setLavagemValor] = useState('');
  const [lavagemData, setLavagemData] = useState(() => new Date().toISOString().slice(0, 10));
  const [lavagemEst, setLavagemEst] = useState('');
  const [lavagemComp, setLavagemComp] = useState('');
  const [abasts, setAbasts] = useState<VeiculoAbastecimento[]>([]);
  const [formula, setFormula] = useState<'km_x_preco' | 'km_div_consumo_x_litro'>('km_x_preco');
  const [kmIniNum, setKmIniNum] = useState(0);
  const [entregasUser, setEntregasUser] = useState<VeiculoEntrega[]>([]);

  const load = async () => {
    const [r, cfg, ents] = await Promise.all([
      fetchResponsabilidades({ usuarioId: actor.id }),
      fetchConfigVeiculo(),
      fetchEntregas({ usuarioId: actor.id }),
    ]);
    setRows(r);
    setFormula(cfg.formula_combustivel);
    if (cfg.preco_padrao) setPrecoComb(String(cfg.preco_padrao));
    setEntregasUser(ents);
  };

  useEffect(() => {
    void load().catch((e) => onToast(e instanceof Error ? e.message : 'Erro.', 'error'));
  }, []);

  const openRetirada = async (r: VeiculoResponsabilidade) => {
    setSelected(r);
    const existing = await fetchRetiradaByResp(r.id);
    setRetiradaDone(!!existing);
    if (existing) setKmIniNum(Number(existing.km_confirmado));
    setMode(existing ? 'entrega' : 'retirada');
  };

  const kmFimNum = parseNumberBr(kmFim);
  const kmRodados =
    kmFimNum != null && kmIniNum >= 0 ? Math.max(0, kmFimNum - kmIniNum) : 0;
  const valorComb = calcCombustivel({
    kmRodados,
    preco: Number(precoComb) || 0,
    formula,
    consumoMedio: selected?.veiculos?.consumo_medio_km_l,
  });
  const valorLav = lavado ? Number(lavagemValor) || 0 : 0;
  const valorAbast = abasts.reduce((s, a) => s + Number(a.valor || 0), 0);
  const total = valorComb + valorLav;

  return (
    <div className="gv-stack">
      {mode === 'list' && (
        <>
          <div className="gv-card">
            <h2>Meus veículos</h2>
            <ul className="gv-list">
              {rows.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>
                      {r.veiculos?.placa} — {r.veiculos?.marca} {r.veiculos?.modelo}
                    </strong>
                    <span className="gv-muted">
                      {r.status} · início {formatDateBR(r.inicio_em)}
                    </span>
                  </div>
                  {['programado', 'em_uso', 'aguardando_aprovacao'].includes(r.status) && (
                    <button type="button" className="gv-btn primary" onClick={() => void openRetirada(r)}>
                      {r.status === 'programado' ? 'Registrar retirada' : 'Continuar / entregar'}
                    </button>
                  )}
                </li>
              ))}
              {rows.length === 0 && <p className="gv-muted">Nenhum veículo sob sua responsabilidade.</p>}
            </ul>
          </div>
          <div className="gv-card">
            <h2>Minhas prestações</h2>
            <ul className="gv-list">
              {entregasUser.map((e) => (
                <li key={e.id}>
                  <div>
                    <strong>{e.veiculos?.placa}</strong>
                    <div className="gv-list-meta">
                      <StatusEntregaBadge status={e.status} />
                      <span className="gv-muted">
                        {formatDateBR(e.entrega_em)} · {formatMoneyBR(e.total_estimado)}
                      </span>
                    </div>
                    {e.status === 'aprovado' && (
                      <p className="gv-ok">
                        Prestação de contas aprovada. Os dados e valores da entrega foram confirmados.
                      </p>
                    )}
                    {e.status === 'rejeitado' && (
                      <p className="gv-err">
                        Prestação de contas rejeitada. Verifique o motivo informado e faça os ajustes
                        necessários.
                        {e.motivo_correcao ? ` Motivo: ${e.motivo_correcao}` : ''}
                      </p>
                    )}
                    {e.status === 'correcao_solicitada' && (
                      <p className="gv-warn">
                        Correção solicitada: {e.motivo_correcao || '—'}
                      </p>
                    )}
                  </div>
                  {(e.status === 'correcao_solicitada' || e.status === 'rejeitado') && (
                    <button
                      type="button"
                      className="gv-btn primary"
                      onClick={async () => {
                        const resp = rows.find((r) => r.id === e.responsabilidade_id);
                        if (resp) await openRetirada(resp);
                      }}
                    >
                      Corrigir prestação de contas
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {mode === 'retirada' && selected && (
        <form
          className="gv-card"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const km = parseNumberBr(kmIni);
              if (km == null) throw new Error('Informe a quilometragem no formato brasileiro.');
              await registrarRetirada(
                {
                  responsabilidade_id: selected.id,
                  foto_hodometro_url: fotoIni,
                  km_confirmado: km,
                  km_ia: kmIniIa,
                  combustivel_nivel: combIni,
                  conservacao: conserv,
                  observacoes: obsRet,
                  retirada_em: canEditDates ? new Date(retiradaEm).toISOString() : undefined,
                },
                actor,
              );
              onToast('Retirada registrada.', 'success');
              setKmIniNum(km);
              setRetiradaDone(true);
              setMode('entrega');
              await load();
            } catch (err) {
              onToast(err instanceof Error ? err.message : 'Erro.', 'error');
            }
          }}
        >
          <h2>Retirada</h2>
          <p className="gv-muted">
            {actor.nome} · {selected.veiculos?.tipo} · {selected.veiculos?.marca}{' '}
            {selected.veiculos?.modelo} · {selected.veiculos?.placa}
          </p>
          <label>
            Data/hora da retirada
            <input
              type="datetime-local"
              value={retiradaEm}
              disabled={!canEditDates}
              onChange={(e) => setRetiradaEm(e.target.value)}
            />
          </label>
          <HodometroFotoField
            label="Foto inicial do hodômetro"
            usuarioId={actor.id}
            required
            onUploaded={(url, km) => {
              setFotoIni(url);
              if (km != null) {
                setKmIniIa(km);
                setKmIni(formatNumberBr(km));
              }
            }}
            kmValue={kmIni}
            onKmChange={setKmIni}
            kmIa={kmIniIa}
          />
          {!fotoIni && (
            <p className="gv-warn">
              É obrigatório anexar a foto do hodômetro. Digite o km da foto no formato brasileiro
              (ex.: 200.000,00).
            </p>
          )}
          <p className="gv-muted">
            Comprovantes de abastecimento, lavagem ou notas fiscais entram na etapa de{' '}
            <strong>entrega</strong> do veículo (depois da retirada), não nesta tela.
          </p>
          <label>
            Nível inicial de combustível
            <select value={combIni} onChange={(e) => setCombIni(e.target.value)}>
              <option>Cheio</option>
              <option>3/4</option>
              <option>1/2</option>
              <option>1/4</option>
              <option>Reserva</option>
            </select>
          </label>
          <label>
            Estado de conservação
            <select value={conserv} onChange={(e) => setConserv(e.target.value)}>
              <option>Excelente</option>
              <option>Bom</option>
              <option>Regular</option>
              <option>Ruim</option>
            </select>
          </label>
          <label>
            Observações
            <textarea value={obsRet} onChange={(e) => setObsRet(e.target.value)} rows={2} />
          </label>
          <div className="gv-actions">
            <button type="button" className="gv-btn" onClick={() => setMode('list')}>
              Voltar
            </button>
            <button
              type="submit"
              className="gv-btn primary"
              disabled={!fotoIni || parseNumberBr(kmIni) == null}
              title={
                !fotoIni
                  ? 'Anexe a foto do hodômetro para continuar'
                  : parseNumberBr(kmIni) == null
                    ? 'Informe a quilometragem (ex.: 200.000,00)'
                    : undefined
              }
            >
              Confirmar retirada
            </button>
          </div>
        </form>
      )}

      {(mode === 'entrega' || mode === 'resumo') && selected && retiradaDone && (
        <div className="gv-card">
          <h2>{mode === 'resumo' ? 'Conferência da entrega' : 'Entrega'}</h2>
          <p className="gv-muted">
            {selected.veiculos?.placa} · km inicial {formatNumberBr(kmIniNum)}
          </p>
          {mode === 'entrega' && (
            <>
              <HodometroFotoField
                label="Foto final do hodômetro"
                usuarioId={actor.id}
                required
                onUploaded={(url, km) => {
                  setFotoFim(url);
                  if (km != null) {
                    setKmFimIa(km);
                    setKmFim(formatNumberBr(km));
                  }
                }}
                kmValue={kmFim}
                onKmChange={setKmFim}
                kmIa={kmFimIa}
              />
              {kmFimNum != null && kmFimNum < kmIniNum && (
                <p className="gv-err">A quilometragem final não pode ser menor que a inicial.</p>
              )}
              {kmFimNum != null && kmFimNum >= kmIniNum && (
                <p className="gv-ok">
                  Km rodados: {formatNumberBr(kmRodados)} · combustível estimado:{' '}
                  {formatMoneyBR(valorComb)}
                </p>
              )}
              <label>
                Nível final de combustível
                <select value={combFim} onChange={(e) => setCombFim(e.target.value)}>
                  <option>Cheio</option>
                  <option>3/4</option>
                  <option>1/2</option>
                  <option>1/4</option>
                  <option>Reserva</option>
                </select>
              </label>
              <label>
                Preço atual do combustível (R$)
                <input
                  type="number"
                  step="0.01"
                  value={precoComb}
                  onChange={(e) => setPrecoComb(e.target.value)}
                />
              </label>
              <fieldset className="gv-fieldset">
                <legend>Veículo lavado?</legend>
                <label className="gv-inline">
                  <input
                    type="radio"
                    checked={!lavado}
                    onChange={() => setLavado(false)}
                  />{' '}
                  Não
                </label>
                <label className="gv-inline">
                  <input type="radio" checked={lavado} onChange={() => setLavado(true)} /> Sim
                </label>
              </fieldset>
              {lavado && (
                <div className="gv-nested">
                  <label>
                    Valor da lavagem
                    <input
                      type="number"
                      step="0.01"
                      value={lavagemValor}
                      onChange={(e) => setLavagemValor(e.target.value)}
                    />
                  </label>
                  <DateBrField
                    label="Data"
                    valueIso={lavagemData}
                    onChangeIso={setLavagemData}
                  />
                  <label>
                    Estabelecimento
                    <input value={lavagemEst} onChange={(e) => setLavagemEst(e.target.value)} />
                  </label>
                  <VeiculoFilePicker
                    label="Comprovante"
                    accept="image/*,application/pdf"
                    buttonText="Anexar comprovante"
                    emptyText="Nenhum comprovante"
                    onFile={async (f) => {
                      if (!f) return;
                      try {
                        setLavagemComp(await uploadVeiculoAnexo(actor.id, 'lavagem', f));
                      } catch (err) {
                        onToast(err instanceof Error ? err.message : 'Upload falhou.', 'error');
                      }
                    }}
                  />
                </div>
              )}
              <div className="gv-nested">
                <h3>Abastecimentos</h3>
                {abasts.map((a, i) => (
                  <div key={i} className="gv-abast">
                    <span>
                      {a.data} · {formatMoneyBR(a.valor)} · {a.posto || '—'}
                    </span>
                    <button
                      type="button"
                      className="gv-btn"
                      onClick={() => setAbasts(abasts.filter((_, j) => j !== i))}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <AbastecimentoForm
                  usuarioId={actor.id}
                  onAdd={(row) => setAbasts([...abasts, row])}
                  onToast={onToast}
                />
              </div>
              <label>
                Observações
                <textarea value={obsEnt} onChange={(e) => setObsEnt(e.target.value)} rows={2} />
              </label>
              <div className="gv-actions">
                <button type="button" className="gv-btn" onClick={() => setMode('list')}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="gv-btn primary"
                  disabled={
                    !fotoFim || kmFimNum == null || kmFimNum < kmIniNum
                  }
                  onClick={() => setMode('resumo')}
                >
                  Revisar e enviar
                </button>
              </div>
            </>
          )}
          {mode === 'resumo' && (
            <>
              <ul className="gv-resumo">
                <li>Funcionário: {actor.nome}</li>
                <li>
                  Veículo: {selected.veiculos?.marca} {selected.veiculos?.modelo}
                </li>
                <li>Placa: {selected.veiculos?.placa}</li>
                <li>Km inicial: {formatNumberBr(kmIniNum)}</li>
                <li>Km final: {kmFim || formatNumberBr(kmFimNum)}</li>
                <li>Km rodados: {formatNumberBr(kmRodados)}</li>
                <li>Preço combustível: {formatMoneyBR(Number(precoComb))}</li>
                <li>Valor combustível: {formatMoneyBR(valorComb)}</li>
                <li>Abastecido com nota: {formatMoneyBR(valorAbast)}</li>
                <li>Lavagem: {formatMoneyBR(valorLav)}</li>
                <li>
                  <strong>Total estimado a debitar: {formatMoneyBR(total)}</strong>
                </li>
              </ul>
              <div className="gv-thumbs">
                {fotoIni && <img src={fotoIni} alt="Hodômetro inicial" />}
                {fotoFim && <img src={fotoFim} alt="Hodômetro final" />}
              </div>
              <div className="gv-actions">
                <button type="button" className="gv-btn" onClick={() => setMode('entrega')}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="gv-btn primary"
                  onClick={async () => {
                    if (!confirm('Confirma o envio para aprovação?')) return;
                    try {
                      if (kmFimNum == null) {
                        throw new Error('Informe a quilometragem final no formato brasileiro.');
                      }
                      if (kmFimNum < kmIniNum) {
                        throw new Error('A quilometragem final não pode ser menor que a inicial.');
                      }
                      await registrarEntrega(
                        {
                          responsabilidade_id: selected.id,
                          foto_hodometro_url: fotoFim,
                          km_confirmado: kmFimNum,
                          km_ia: kmFimIa,
                          combustivel_nivel: combFim,
                          lavado,
                          preco_combustivel: Number(precoComb) || 0,
                          observacoes: obsEnt,
                          enviarAprovacao: true,
                          lavagem: lavado
                            ? {
                                valor: Number(lavagemValor) || 0,
                                data: lavagemData,
                                estabelecimento: lavagemEst,
                                comprovante_url: lavagemComp || undefined,
                              }
                            : null,
                          abastecimentos: abasts,
                        },
                        actor,
                      );
                      onToast('Enviado para aprovação.', 'success');
                      setMode('list');
                      setSelected(null);
                      await load();
                    } catch (err) {
                      onToast(err instanceof Error ? err.message : 'Erro.', 'error');
                    }
                  }}
                >
                  Enviar para aprovação
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AbastecimentoForm({
  usuarioId,
  onAdd,
  onToast,
}: {
  usuarioId: number;
  onAdd: (row: VeiculoAbastecimento) => void;
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState('');
  const [preco, setPreco] = useState('');
  const [litros, setLitros] = useState('');
  const [posto, setPosto] = useState('');
  const [nota, setNota] = useState('');
  return (
    <div className="gv-abast-form">
      <DateBrField valueIso={data} onChangeIso={setData} />
      <input
        type="number"
        placeholder="Valor"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <input
        type="number"
        placeholder="R$/L"
        value={preco}
        onChange={(e) => setPreco(e.target.value)}
      />
      <input
        type="number"
        placeholder="Litros"
        value={litros}
        onChange={(e) => setLitros(e.target.value)}
      />
      <input placeholder="Posto" value={posto} onChange={(e) => setPosto(e.target.value)} />
      <VeiculoFilePicker
        accept="image/*,application/pdf"
        buttonText="Anexar nota"
        emptyText="Nenhuma nota"
        onFile={async (f) => {
          if (!f) return;
          try {
            setNota(await uploadVeiculoAnexo(usuarioId, 'nota', f));
          } catch (err) {
            onToast(err instanceof Error ? err.message : 'Upload falhou.', 'error');
          }
        }}
      />
      <button
        type="button"
        className="gv-btn"
        onClick={() => {
          if (!valor) return;
          onAdd({
            data,
            valor: Number(valor),
            preco_litro: preco ? Number(preco) : null,
            litros: litros ? Number(litros) : null,
            posto,
            nota_url: nota || null,
          });
          setValor('');
          setPosto('');
          setNota('');
        }}
      >
        + Abastecimento
      </button>
    </div>
  );
}

function AprovacaoPanel({
  actor,
  onToast,
}: {
  actor: { id: number; cargo: string };
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [rows, setRows] = useState<VeiculoEntrega[]>([]);
  const [filtro, setFiltro] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [just, setJust] = useState('');
  const [valorNovo, setValorNovo] = useState('');

  const load = async () => {
    setRows(
      await fetchEntregas({
        status: [
          'aguardando_aprovacao',
          'correcao_solicitada',
          'rejeitado',
          'aprovado',
          'finalizado',
        ],
      }),
    );
  };
  useEffect(() => {
    void load().catch((e) => onToast(e instanceof Error ? e.message : 'Erro.', 'error'));
  }, []);

  const filtered = rows.filter((r) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.veiculos?.placa ?? '').toLowerCase().includes(q) ||
      String(r.usuario_id).includes(q) ||
      r.status.includes(q) ||
      labelStatusEntrega(r.status).toLowerCase().includes(q)
    );
  });

  return (
    <div className="gv-stack">
      <div className="gv-card">
        <h2>Fila de prestações</h2>
        <input
          className="gv-filter"
          placeholder="Filtrar placa, status…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <ul className="gv-list">
          {filtered.map((e) => (
            <li key={e.id}>
              <div>
                <strong>
                  {e.veiculos?.placa} · {formatMoneyBR(e.total_estimado)}
                </strong>
                <div className="gv-list-meta">
                  <StatusEntregaBadge status={e.status} />
                  <span className="gv-muted">
                    {formatDateBR(e.entrega_em)} · user #{e.usuario_id}
                  </span>
                </div>
              </div>
              <button type="button" className="gv-btn" onClick={() => setDetailId(e.id)}>
                Abrir
              </button>
            </li>
          ))}
        </ul>
      </div>
      {detailId && (
        <AprovacaoDetalhe
          id={detailId}
          refreshKey={detailVersion}
          just={just}
          setJust={setJust}
          valorNovo={valorNovo}
          setValorNovo={setValorNovo}
          onClose={() => setDetailId(null)}
          onAction={async (acao) => {
            try {
              await acaoAprovacao(
                {
                  entrega_id: detailId,
                  acao,
                  justificativa: just,
                  valor_novo: valorNovo ? Number(valorNovo) : undefined,
                },
                actor,
              );
              const msg =
                acao === 'aprovar'
                  ? 'Prestação aprovada. Veículo liberado na frota.'
                  : 'Ação registrada.';
              onToast(msg, 'success');
              setJust('');
              await load();
              setDetailVersion((n) => n + 1);
            } catch (err) {
              onToast(err instanceof Error ? err.message : 'Erro.', 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function AprovacaoDetalhe({
  id,
  refreshKey,
  just,
  setJust,
  valorNovo,
  setValorNovo,
  onClose,
  onAction,
}: {
  id: string;
  refreshKey: number;
  just: string;
  setJust: (s: string) => void;
  valorNovo: string;
  setValorNovo: (s: string) => void;
  onClose: () => void;
  onAction: (a: 'aprovar' | 'rejeitar' | 'solicitar_correcao' | 'ajustar_valor' | 'confirmar_debito') => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEntregaDetalhe>> | null>(null);
  useEffect(() => {
    setData(null);
    void fetchEntregaDetalhe(id).then(setData);
  }, [id, refreshKey]);

  if (!data) return <div className="gv-card">Carregando…</div>;
  const { entrega, retirada } = data;
  const encerrada = entrega.status === 'aprovado' || entrega.status === 'finalizado';
  const podeDecidir =
    entrega.status === 'aguardando_aprovacao' ||
    entrega.status === 'correcao_solicitada' ||
    entrega.status === 'rejeitado';

  return (
    <div className="gv-card">
      <div className="gv-aprov-head">
        <h2>Prestação — {entrega.veiculos?.placa}</h2>
        <StatusEntregaBadge status={entrega.status} />
      </div>
      {encerrada && (
        <p className="gv-ok">
          Prestação {labelStatusEntrega(entrega.status).toLowerCase()}. O veículo já foi liberado e
          aparece como disponível na frota.
        </p>
      )}
      <ul className="gv-resumo">
        <li>
          Status: <StatusEntregaBadge status={entrega.status} />
        </li>
        <li>
          Km ini: {formatNumberBr(retirada?.km_confirmado)} → fim:{' '}
          {formatNumberBr(entrega.km_confirmado)}
        </li>
        <li>Rodados: {formatNumberBr(entrega.km_rodados)}</li>
        <li>Combustível calc.: {formatMoneyBR(entrega.valor_combustivel_calculado)}</li>
        <li>Lavagem: {formatMoneyBR(entrega.valor_lavagem)}</li>
        <li>Total: {formatMoneyBR(entrega.total_estimado)}</li>
      </ul>
      <div className="gv-thumbs">
        {retirada?.foto_hodometro_url && <img src={retirada.foto_hodometro_url} alt="Ini" />}
        <img src={entrega.foto_hodometro_url} alt="Fim" />
      </div>
      {podeDecidir && (
        <>
          <label>
            Justificativa (obrigatória para rejeitar/corrigir/ajustar)
            <textarea value={just} onChange={(e) => setJust(e.target.value)} rows={2} />
          </label>
          <label>
            Novo total (ajuste)
            <input value={valorNovo} onChange={(e) => setValorNovo(e.target.value)} type="number" />
          </label>
        </>
      )}
      <div className="gv-actions wrap">
        {podeDecidir && (
          <>
            <button type="button" className="gv-btn primary" onClick={() => onAction('aprovar')}>
              Aprovar
            </button>
            <button type="button" className="gv-btn danger" onClick={() => onAction('rejeitar')}>
              Rejeitar
            </button>
            <button type="button" className="gv-btn" onClick={() => onAction('solicitar_correcao')}>
              Solicitar correção
            </button>
            <button type="button" className="gv-btn" onClick={() => onAction('ajustar_valor')}>
              Ajustar valor
            </button>
          </>
        )}
        {entrega.status === 'aprovado' && (
          <button type="button" className="gv-btn" onClick={() => onAction('confirmar_debito')}>
            Confirmar débito
          </button>
        )}
        <button type="button" className="gv-btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function ManutencaoPanel({
  actor,
  onToast,
  canEdit,
}: {
  actor: { id: number; cargo: string };
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<VeiculoManutencao[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [veiculoId, setVeiculoId] = useState('');
  const [desc, setDesc] = useState('');
  const [oficina, setOficina] = useState('');
  const [valor, setValor] = useState('');

  const load = async () => {
    setRows(await fetchManutencoes());
    setVeiculos(await fetchVeiculos());
  };
  useEffect(() => {
    void load().catch((e) => onToast(e instanceof Error ? e.message : 'Erro.', 'error'));
  }, []);

  return (
    <div className="gv-grid-2">
      {canEdit && (
        <form
          className="gv-card"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await abrirManutencao(
                {
                  veiculo_id: veiculoId,
                  descricao: desc,
                  oficina,
                  valor: valor ? Number(valor) : null,
                },
                actor,
              );
              onToast('Manutenção aberta.', 'success');
              await load();
            } catch (err) {
              onToast(err instanceof Error ? err.message : 'Erro.', 'error');
            }
          }}
        >
          <h2>Registrar manutenção</h2>
          <label>
            Veículo
            <select required value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
              <option value="">Selecione</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} [{v.situacao}]
                </option>
              ))}
            </select>
          </label>
          <label>
            Descrição
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </label>
          <label>
            Oficina
            <input value={oficina} onChange={(e) => setOficina(e.target.value)} />
          </label>
          <label>
            Valor
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
          <button type="submit" className="gv-btn primary">
            Abrir manutenção
          </button>
        </form>
      )}
      <div className="gv-card">
        <h2>Histórico de manutenção</h2>
        <ul className="gv-list">
          {rows.map((m) => (
            <li key={m.id}>
              <div>
                <strong>
                  {m.veiculos?.placa} · {m.status}
                </strong>
                <span className="gv-muted">
                  {formatDateBR(m.data_inicio)} · {m.descricao || '—'}
                </span>
              </div>
              {canEdit && m.status === 'aberta' && (
                <button
                  type="button"
                  className="gv-btn"
                  onClick={async () => {
                    try {
                      await concluirManutencao(m.id, actor);
                      onToast('Manutenção concluída.', 'success');
                      await load();
                    } catch (err) {
                      onToast(err instanceof Error ? err.message : 'Erro.', 'error');
                    }
                  }}
                >
                  Concluir
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuemPanel() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof fetchQuemEstaComVeiculo>>
  >([]);
  useEffect(() => {
    void fetchQuemEstaComVeiculo().then(setRows);
  }, []);
  return (
    <div className="gv-card">
      <h2>Quem está com o veículo</h2>
      <ul className="gv-list">
        {rows.map((r) => (
          <li key={r.veiculo.id}>
            <div>
              <strong>
                {r.veiculo.placa} — {r.veiculo.marca} {r.veiculo.modelo}
              </strong>
              <span className="gv-muted">
                {r.responsavel ? `Responsável: ${r.responsavel}` : 'Disponível'} · {r.status}
                {r.inicio_em ? ` · desde ${formatDateBR(r.inicio_em)}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardPanel() {
  const [d, setD] = useState<Awaited<ReturnType<typeof fetchDashboardVeiculos>> | null>(null);
  useEffect(() => {
    void fetchDashboardVeiculos().then(setD);
  }, []);
  if (!d) return <p>Carregando…</p>;
  return (
    <div className="gv-stack">
      <div className="gv-kpis">
        <div className="gv-kpi">
          <span>Disponíveis</span>
          <strong>{d.disponiveis}</strong>
        </div>
        <div className="gv-kpi">
          <span>Em uso</span>
          <strong>{d.emUso}</strong>
        </div>
        <div className="gv-kpi">
          <span>Manutenção</span>
          <strong>{d.manutencao}</strong>
        </div>
        <div className="gv-kpi">
          <span>Aguardando</span>
          <strong>{d.aguardando}</strong>
        </div>
        <div className="gv-kpi">
          <span>Rejeitadas</span>
          <strong>{d.rejeitadas}</strong>
        </div>
        <div className="gv-kpi">
          <span>Km rodados</span>
          <strong>{d.kmTotal.toLocaleString('pt-BR')}</strong>
        </div>
        <div className="gv-kpi">
          <span>Combustível</span>
          <strong>{formatMoneyBR(d.gastoCombustivel)}</strong>
        </div>
        <div className="gv-kpi">
          <span>Lavagem</span>
          <strong>{formatMoneyBR(d.gastoLavagem)}</strong>
        </div>
        <div className="gv-kpi">
          <span>Total a debitar</span>
          <strong>{formatMoneyBR(d.totalDebito)}</strong>
        </div>
      </div>
      <div className="gv-grid-2">
        <div className="gv-card">
          <h3>Por funcionário</h3>
          <ul className="gv-list">
            {d.porFuncionario.map((p) => (
              <li key={p.usuario_id}>
                <span>{p.nome}</span>
                <strong>{formatMoneyBR(p.total)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="gv-card">
          <h3>Por veículo</h3>
          <ul className="gv-list">
            {d.porVeiculo.map((p) => (
              <li key={p.veiculo_id}>
                <span>{p.placa}</span>
                <strong>{formatMoneyBR(p.total)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({
  actor,
  onToast,
}: {
  actor: { id: number; cargo: string };
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [formula, setFormula] = useState<'km_x_preco' | 'km_div_consumo_x_litro'>('km_x_preco');
  const [preco, setPreco] = useState('');
  useEffect(() => {
    void fetchConfigVeiculo().then((c) => {
      setFormula(c.formula_combustivel);
      setPreco(c.preco_padrao != null ? String(c.preco_padrao) : '');
    });
  }, []);
  return (
    <form
      className="gv-card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await updateConfigVeiculo(
            {
              formula_combustivel: formula,
              preco_padrao: preco ? Number(preco) : null,
            },
            actor,
          );
          onToast('Configuração salva.', 'success');
        } catch (err) {
          onToast(err instanceof Error ? err.message : 'Erro.', 'error');
        }
      }}
    >
      <h2>Fórmula de combustível</h2>
      <label>
        Método
        <select
          value={formula}
          onChange={(e) =>
            setFormula(e.target.value as 'km_x_preco' | 'km_div_consumo_x_litro')
          }
        >
          <option value="km_x_preco">Km rodados × preço informado (padrão)</option>
          <option value="km_div_consumo_x_litro">
            Km ÷ consumo médio × preço por litro
          </option>
        </select>
      </label>
      <label>
        Preço padrão sugerido
        <input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </label>
      <button type="submit" className="gv-btn primary">
        Salvar
      </button>
    </form>
  );
}

function HistoricoPanel() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchAuditoria>>>([]);
  useEffect(() => {
    void fetchAuditoria().then(setRows);
  }, []);
  return (
    <div className="gv-card">
      <h2>Auditoria</h2>
      <ul className="gv-list">
        {rows.map((r) => (
          <li key={String(r.id)}>
            <div>
              <strong>
                {r.entidade} · {r.acao}
              </strong>
              <span className="gv-muted">
                {formatDateBR(String(r.created_at))} · user #{String(r.usuario_id ?? '—')} ·{' '}
                {String(r.entidade_id)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelatoriosPanel() {
  return <DashboardPanel />;
}
