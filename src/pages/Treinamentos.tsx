import { useCallback, useEffect, useState } from 'react';
import AddTreinamentoModal from '../components/treinamentos/AddTreinamentoModal';
import DownloadTreinamentoModal from '../components/treinamentos/DownloadTreinamentoModal';
import BackToPortal from '../components/layout/BackToPortal';
import {
  downloadPdf,
  fetchTreinamentos,
  isVideoType,
  openVideo,
  type Treinamento,
} from '../services/treinamentoService';
import './Treinamentos.css';

export default function Treinamentos() {
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<Treinamento | null>(null);

  const loadTreinamentos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchTreinamentos();
      setTreinamentos(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar treinamentos.';
      setError(message);
      setTreinamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTreinamentos();
  }, [loadTreinamentos]);

  const handleAction = (item: Treinamento) => {
    if (!item.link_material) return;

    if (isVideoType(item.tipo)) {
      openVideo(item.link_material);
      return;
    }

    setDownloadItem(item);
  };

  const confirmDownload = () => {
    if (!downloadItem?.link_material) return;
    downloadPdf(downloadItem.link_material, downloadItem.titulo);
    setDownloadItem(null);
  };

  return (
    <div className="treinamentos-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />
      <div className="treinamentos-header">
        <h1 className="page-title">Lista de treinamentos</h1>
        <button type="button" className="btn-primary" onClick={() => setShowAddModal(true)}>
          <span>+</span> Adicionar Treinamento
        </button>
      </div>

      {error && (
        <div className="treinamentos-alert error">
          {error}
          <button type="button" onClick={loadTreinamentos}>
            Tentar novamente
          </button>
        </div>
      )}

      <div className="treinamentos-list card">
        {loading && <p className="treinamentos-message">Carregando treinamentos...</p>}

        {!loading && treinamentos.length === 0 && (
          <p className="treinamentos-message">Nenhum treinamento disponível no momento.</p>
        )}

        {!loading &&
          treinamentos.map((item) => {
            const isVideo = isVideoType(item.tipo);
            return (
              <article key={item.id} className="treinamento-item">
                <div className="treinamento-info">
                  <h2>{item.titulo}</h2>
                  <p>
                    {isVideo
                      ? 'Material em vídeo disponível para seus colaboradores.'
                      : 'Material em PDF disponível para download.'}
                  </p>
                </div>
                <button
                  type="button"
                  className={`treinamento-action ${isVideo ? 'video' : 'pdf'}`}
                  onClick={() => handleAction(item)}
                  disabled={!item.link_material}
                >
                  <span aria-hidden>{isVideo ? '▶' : '📄'}</span>
                  {isVideo ? 'Abrir vídeo' : 'Baixar PDF'}
                </button>
              </article>
            );
          })}
      </div>

      {showAddModal && (
        <AddTreinamentoModal onClose={() => setShowAddModal(false)} onSuccess={loadTreinamentos} />
      )}

      {downloadItem && (
        <DownloadTreinamentoModal
          titulo={downloadItem.titulo}
          onClose={() => setDownloadItem(null)}
          onConfirm={confirmDownload}
        />
      )}
    </div>
  );
}
