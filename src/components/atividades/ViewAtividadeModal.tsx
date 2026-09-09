import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import { fetchAtividadeDias, type AtividadeRow } from '../../services/atividadesService';
import {
  buildDiaTimeline,
  diaStatusColor,
  diaStatusLabel,
  formatDateLongBR,
  formatPeriodo,
  statusColor,
  statusLabel,
  type DiaTimelineItem,
} from '../../utils/atividadesDomain';
import './AtividadeModals.css';

type ViewAtividadeModalProps = {
  atividade: AtividadeRow;
  onClose: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  canCancel: boolean;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="atividade-detail-row">
      <span className="atividade-detail-label">{label}</span>
      <span className="atividade-detail-value">{value}</span>
    </div>
  );
}

function DiaDetailPanel({ item, tipo }: { item: DiaTimelineItem; tipo: string }) {
  const { record, status } = item;
  const color = diaStatusColor(status);
  const isAntesDepois = tipo === 'Antes e Depois';
  const hasPhotos = Boolean(record?.foto_antes_url || record?.foto_depois_url);
  const hasJustificativa = Boolean(record?.justificativa_motivo);

  return (
    <div className="atividade-dia-panel">
      <div className="atividade-dia-panel-head">
        <div>
          <h3>{formatDateLongBR(item.data)}</h3>
          <p className="atividade-dia-weekday">{item.weekday}</p>
        </div>
        <span className="atividade-status-badge" style={{ background: `${color}22`, color }}>
          {diaStatusLabel(status)}
        </span>
      </div>

      {status === 'atrasada' && !record && (
        <p className="atividade-dia-empty">
          O promotor ainda não registrou execução nem justificativa para este dia.
        </p>
      )}

      {status === 'em_andamento' && !record && (
        <p className="atividade-dia-empty">Atividade prevista para hoje, aguardando o promotor.</p>
      )}

      {hasJustificativa && (
        <div className="atividade-dia-block">
          <h4>Justificativa</h4>
          <p className="atividade-dia-motivo">
            <strong>Motivo:</strong> {record?.justificativa_motivo}
          </p>
          {record?.justificativa_observacao && (
            <p className="atividade-dia-obs">{record.justificativa_observacao}</p>
          )}
          {record?.foto_justificativa_url && (
            <div className="atividade-dia-photos single">
              <figure>
                <img src={record.foto_justificativa_url} alt="Foto da justificativa" />
                <figcaption>Foto anexada</figcaption>
              </figure>
            </div>
          )}
        </div>
      )}

      {hasPhotos && (
        <div className="atividade-dia-block">
          <h4>{isAntesDepois ? 'Fotos Antes e Depois' : 'Fotos do dia'}</h4>
          <div className={`atividade-dia-photos ${isAntesDepois ? 'double' : 'single'}`}>
            {record?.foto_antes_url && (
              <figure>
                <img src={record.foto_antes_url} alt="Foto antes" />
                <figcaption>{isAntesDepois ? 'Antes' : 'Foto'}</figcaption>
              </figure>
            )}
            {record?.foto_depois_url && (
              <figure>
                <img src={record.foto_depois_url} alt="Foto depois" />
                <figcaption>Depois</figcaption>
              </figure>
            )}
          </div>
          {record?.senha_do_dia && (
            <p className="atividade-dia-senha">
              <strong>Senha do dia:</strong> {record.senha_do_dia}
            </p>
          )}
        </div>
      )}

      {record && status === 'concluida' && !hasPhotos && (
        <p className="atividade-dia-empty">Dia marcado como concluído sem fotos anexadas.</p>
      )}
    </div>
  );
}

export default function ViewAtividadeModal({
  atividade,
  onClose,
  onEdit,
  onCancel,
  onDelete,
  canEdit,
  canCancel,
}: ViewAtividadeModalProps) {
  const color = statusColor(atividade.status);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchAtividadeDias>>>([]);
  const [loadingDias, setLoadingDias] = useState(true);
  const [selectedData, setSelectedData] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingDias(true);
    setSelectedData(null);
    fetchAtividadeDias(atividade.id)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDias(false);
      });
    return () => {
      cancelled = true;
    };
  }, [atividade.id]);

  const timeline = useMemo(
    () => buildDiaTimeline(atividade, records),
    [atividade, records]
  );

  useEffect(() => {
    if (timeline.length === 0) {
      setSelectedData(null);
      return;
    }
    setSelectedData((prev) =>
      prev && timeline.some((item) => item.data === prev) ? prev : timeline[0].data
    );
  }, [timeline]);

  const selectedItem = timeline.find((item) => item.data === selectedData) ?? timeline[0];

  return (
    <ModalShell onClose={onClose} className="atividade-modal atividade-view-modal">
      <div className="atividade-modal-header">
        <h2>{atividade.tipo}</h2>
        <p>Acompanhamento diário da atividade</p>
      </div>

      <div className="atividade-view-summary">
        <DetailRow label="Promotor" value={atividade.responsavelNome} />
        <DetailRow label="Loja" value={atividade.loja} />
        <DetailRow label="Indústria" value={atividade.industria} />
        <DetailRow label="Período" value={formatPeriodo(atividade.data_inicio, atividade.data_fim)} />
        <div className="atividade-detail-row">
          <span className="atividade-detail-label">Status geral</span>
          <span className="atividade-status-badge" style={{ background: `${color}22`, color }}>
            {statusLabel(atividade.status)}
          </span>
        </div>
      </div>

      <section className="atividade-dia-section">
        <div className="atividade-dia-section-head">
          <h3>Dias da rota</h3>
          <span>{timeline.length} dia(s) decorrido(s)</span>
        </div>

        {loadingDias ? (
          <p className="atividade-dia-loading">Carregando histórico diário...</p>
        ) : timeline.length === 0 ? (
          <p className="atividade-dia-empty">
            A rota ainda não começou. Os dias aparecerão aqui conforme o período avançar.
          </p>
        ) : (
          <div className="atividade-dia-layout">
            <div className="atividade-dia-list" role="listbox" aria-label="Dias da atividade">
              {timeline.map((item) => {
                const itemColor = diaStatusColor(item.status);
                const isActive = item.data === selectedItem?.data;
                return (
                  <button
                    key={item.data}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`atividade-dia-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedData(item.data)}
                  >
                    <span className="atividade-dia-item-date">
                      <strong>{item.label}</strong>
                      <em>{item.weekday}</em>
                    </span>
                    <span
                      className="atividade-dia-item-status"
                      style={{ background: `${itemColor}22`, color: itemColor }}
                    >
                      {diaStatusLabel(item.status)}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedItem && <DiaDetailPanel item={selectedItem} tipo={atividade.tipo} />}
          </div>
        )}
      </section>

      <div className="atividade-detail-actions">
        {canEdit && onEdit && (
          <button type="button" className="atividade-btn-outline" onClick={onEdit}>
            Editar
          </button>
        )}
        {canCancel && onCancel && (
          <button type="button" className="atividade-btn-outline warn" onClick={onCancel}>
            Cancelar atividade
          </button>
        )}
        {onDelete && (
          <button type="button" className="atividade-btn-outline danger" onClick={onDelete}>
            Excluir
          </button>
        )}
        <button type="button" className="atividade-btn-submit secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </ModalShell>
  );
}
