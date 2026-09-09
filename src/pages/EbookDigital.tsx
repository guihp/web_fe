import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Navigate } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import AppIcon from '../components/icons/AppIcon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canViewEbook } from '../data/portalModules';
import {
  ebookTipoLabel,
  fetchEbookPhotos,
  filterEbookPhotos,
  formatEbookDateBr,
  uniqueSorted,
  type EbookPhoto,
} from '../services/ebookService';
import './EbookDigital.css';

type FilterState = {
  search: string;
  industria: string;
  uf: string;
  tipo: string;
  loja: string;
  promotor: string;
  data: string;
};

const EMPTY_FILTERS: FilterState = {
  search: '',
  industria: '',
  uf: '',
  tipo: '',
  loja: '',
  promotor: '',
  data: '',
};

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EbookDigital() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const allowed = canViewEbook(user?.cargo);

  const [photos, setPhotos] = useState<EbookPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchEbookPhotos();
      setPhotos(rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar fotos.', 'error');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const filtered = useMemo(
    () => filterEbookPhotos(photos, filters),
    [photos, filters],
  );

  useEffect(() => {
    setIndex(0);
  }, [filters]);

  useEffect(() => {
    if (index >= filtered.length) {
      setIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, index]);

  const current = filtered[index] ?? null;

  const optionLists = useMemo(() => {
    const source = photos;
    return {
      industrias: uniqueSorted(source.map((p) => p.industria)),
      ufs: uniqueSorted(source.map((p) => p.uf)),
      tipos: uniqueSorted(source.map((p) => ebookTipoLabel(p))),
      lojas: uniqueSorted(source.map((p) => p.loja)),
      promotores: uniqueSorted(source.map((p) => p.promotor)),
    };
  }, [photos]);

  const selectedPhotos = useMemo(
    () => filtered.filter((p) => selected.has(p.id)),
    [filtered, selected],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((p) => p.id)));
  };

  const clearSelected = () => setSelected(new Set());

  const openPdfPreview = () => {
    if (selectedPhotos.length === 0) {
      showToast('Selecione ao menos uma miniatura para gerar o PDF.', 'error');
      return;
    }
    setPdfOpen(true);
  };

  const downloadPdf = async () => {
    if (selectedPhotos.length === 0) {
      showToast('Selecione ao menos uma miniatura para gerar o PDF.', 'error');
      return;
    }
    const root = printRootRef.current;
    if (!root) return;

    setPdfBusy(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const sheets = Array.from(root.querySelectorAll<HTMLElement>('.ebook-print-sheet'));

      for (let i = 0; i < sheets.length; i += 1) {
        const el = sheets[i];
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) pdf.addPage();
        const margin = 6;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
        const imgW = canvas.width * ratio;
        const imgH = canvas.height * ratio;
        const x = (pageW - imgW) / 2;
        const y = (pageH - imgH) / 2;
        pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
      }

      pdf.save(`ebook-promotores-${todayStamp()}.pdf`);
      showToast('PDF baixado.', 'success');
      setPdfOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao gerar PDF.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  if (!allowed) {
    return <Navigate to="/merchandising" replace />;
  }

  return (
    <div className="ebook-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />

      <header className="ebook-header">
        <div className="ebook-header-titles">
          <p className="ebook-kicker">Ebook digital</p>
          <h1>Galeria de promotores</h1>
        </div>
      </header>

      <div className="ebook-toolbar">
        <div>
          <h2>Galeria de Fotos</h2>
          <p className="ebook-count">
            {loading
              ? 'Carregando…'
              : `${filtered.length} registro${filtered.length === 1 ? '' : 's'} (de ${photos.length})`}
          </p>
        </div>
        <div className="ebook-actions">
          <button type="button" className="ebook-btn ebook-btn-primary" onClick={load} disabled={loading}>
            <AppIcon name="search" size={16} />
            Atualizar fotos
          </button>
          <button type="button" className="ebook-btn" onClick={openPdfPreview}>
            <AppIcon name="file" size={16} />
            Gerar PDF do ebook
          </button>
        </div>
      </div>

      <div className="ebook-layout">
        <section className="ebook-main">
          <div className="ebook-viewer">
            {current ? (
              <>
                <div className="ebook-viewer-media">
                  <img src={current.url} alt={current.loja || 'Foto da atividade'} />
                  <span className="ebook-badge">
                    {index + 1} / {filtered.length}
                  </span>
                </div>
                <div className="ebook-viewer-meta">
                  <div className="ebook-tags">
                    {current.industria ? (
                      <span className="ebook-tag">{current.industria}</span>
                    ) : null}
                    <span className="ebook-tag ebook-tag-kind">{ebookTipoLabel(current)}</span>
                  </div>
                  <h3 className="ebook-loja">{current.loja || 'Loja não informada'}</h3>
                  <div className="ebook-meta-grid">
                    <div className="ebook-meta-item">
                      <span>UF</span>
                      <strong>{current.uf || '—'}</strong>
                    </div>
                    <div className="ebook-meta-item">
                      <span>Data</span>
                      <strong>{formatEbookDateBr(current.data)}</strong>
                    </div>
                    <div className="ebook-meta-item">
                      <span>Indústria</span>
                      <strong>{current.industria || '—'}</strong>
                    </div>
                    <div className="ebook-meta-item">
                      <span>Promotor</span>
                      <strong>{current.promotor || '—'}</strong>
                    </div>
                    <div className="ebook-meta-item">
                      <span>Tipo</span>
                      <strong>{ebookTipoLabel(current)}</strong>
                    </div>
                  </div>
                  <div className="ebook-viewer-footer">
                    <span className="ebook-id">#{current.id}</span>
                    <button
                      type="button"
                      className="ebook-btn ebook-btn-primary"
                      onClick={() => window.open(current.url, '_blank', 'noopener,noreferrer')}
                    >
                      Abrir original
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="ebook-viewer-empty">
                {loading ? 'Carregando fotos…' : 'Nenhuma foto encontrada com os filtros atuais.'}
              </div>
            )}
          </div>

          <div className="ebook-pager">
            <button
              type="button"
              className="ebook-btn"
              disabled={!current || index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              ← Anterior
            </button>
            <span className="ebook-pager-label">
              {filtered.length === 0
                ? 'Sem páginas'
                : `Página ${index + 1} de ${filtered.length}`}
            </span>
            <button
              type="button"
              className="ebook-btn ebook-btn-primary"
              disabled={!current || index >= filtered.length - 1}
              onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
            >
              Próximo →
            </button>
          </div>
        </section>

        <aside className="ebook-side">
          <div className="ebook-panel">
            <h3>Filtros</h3>
            <input
              className="ebook-search"
              type="search"
              placeholder="Buscar por loja ou promotor…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <div className="ebook-filters">
              <div className="ebook-field">
                <label htmlFor="ebook-industria">Indústria</label>
                <select
                  id="ebook-industria"
                  value={filters.industria}
                  onChange={(e) => setFilters((f) => ({ ...f, industria: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {optionLists.industrias.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ebook-field">
                <label htmlFor="ebook-uf">UF</label>
                <select
                  id="ebook-uf"
                  value={filters.uf}
                  onChange={(e) => setFilters((f) => ({ ...f, uf: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {optionLists.ufs.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ebook-field">
                <label htmlFor="ebook-tipo">Tipo</label>
                <select
                  id="ebook-tipo"
                  value={filters.tipo}
                  onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {optionLists.tipos.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ebook-field">
                <label htmlFor="ebook-loja">Loja</label>
                <select
                  id="ebook-loja"
                  value={filters.loja}
                  onChange={(e) => setFilters((f) => ({ ...f, loja: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {optionLists.lojas.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ebook-field">
                <label htmlFor="ebook-promotor">Promotor</label>
                <select
                  id="ebook-promotor"
                  value={filters.promotor}
                  onChange={(e) => setFilters((f) => ({ ...f, promotor: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {optionLists.promotores.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ebook-field">
                <label htmlFor="ebook-data">Data</label>
                <input
                  id="ebook-data"
                  type="date"
                  value={filters.data}
                  onChange={(e) => setFilters((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="button"
              className="ebook-clear-filters"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Limpar filtros
            </button>
          </div>

          <div className="ebook-panel">
            <div className="ebook-thumbs-head">
              <h3>Miniaturas</h3>
              <span className="ebook-selec">{selected.size} selec.</span>
            </div>
            <div className="ebook-thumbs-actions">
              <button type="button" onClick={selectAllFiltered}>
                Selecionar todas
              </button>
              <button type="button" onClick={clearSelected}>
                Limpar
              </button>
            </div>
            <div className="ebook-thumbs">
              {filtered.map((photo, i) => {
                const isSelected = selected.has(photo.id);
                const isActive = i === index;
                return (
                  <div
                    key={photo.id}
                    className={`ebook-thumb${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                    title={photo.loja}
                  >
                    <button
                      type="button"
                      className="ebook-thumb-open"
                      onClick={() => setIndex(i)}
                      aria-label={`Ver foto ${i + 1}`}
                    >
                      <img src={photo.url} alt="" loading="lazy" />
                    </button>
                    <button
                      type="button"
                      className="ebook-thumb-check"
                      aria-pressed={isSelected}
                      aria-label={isSelected ? 'Desmarcar' : 'Selecionar'}
                      onClick={() => toggleSelect(photo.id)}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {pdfOpen ? (
        <div className="ebook-modal-backdrop" role="presentation" onClick={() => !pdfBusy && setPdfOpen(false)}>
          <div
            className="ebook-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ebook-pdf-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ebook-modal-head">
              <h2 id="ebook-pdf-title">Pré-visualização do PDF</h2>
              <button type="button" className="ebook-btn" onClick={() => setPdfOpen(false)} disabled={pdfBusy}>
                Fechar
              </button>
            </div>
            <div className="ebook-modal-body">
              {selectedPhotos.map((photo, i) => (
                <div key={photo.id} className="ebook-pdf-page">
                  <div className="ebook-pdf-page-label">
                    Galeria de fotos · Página {i + 1}/{selectedPhotos.length}
                  </div>
                  <img src={photo.url} alt="" />
                  <div className="ebook-pdf-meta">
                    <p>
                      <strong>Loja:</strong> {photo.loja || '—'}
                    </p>
                    <p>
                      <strong>UF:</strong> {photo.uf || '—'}
                    </p>
                    <p>
                      <strong>Indústria:</strong> {photo.industria || '—'}
                    </p>
                    <p>
                      <strong>Promotor:</strong> {photo.promotor || '—'}
                    </p>
                    <p>
                      <strong>Tipo:</strong> {ebookTipoLabel(photo)}
                    </p>
                    <p>
                      <strong>Data:</strong> {formatEbookDateBr(photo.data)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="ebook-modal-actions">
              <button type="button" className="ebook-btn" onClick={() => setPdfOpen(false)} disabled={pdfBusy}>
                Cancelar
              </button>
              <button
                type="button"
                className="ebook-btn ebook-btn-primary"
                onClick={downloadPdf}
                disabled={pdfBusy}
              >
                {pdfBusy ? 'Gerando…' : 'Baixar PDF'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ebook-print-root" ref={printRootRef} aria-hidden>
        {selectedPhotos.map((photo, i) => (
          <div key={photo.id} className="ebook-print-sheet">
            <div className="ebook-print-sheet-label">
              Galeria de fotos · Página {i + 1}/{selectedPhotos.length}
            </div>
            <img src={photo.url} alt="" crossOrigin="anonymous" />
            <div className="ebook-print-meta">
              <h3>{photo.loja || 'Loja não informada'}</h3>
              <dl>
                <div>
                  <dt>UF</dt>
                  <dd>{photo.uf || '—'}</dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>{formatEbookDateBr(photo.data)}</dd>
                </div>
                <div>
                  <dt>Indústria</dt>
                  <dd>{photo.industria || '—'}</dd>
                </div>
                <div>
                  <dt>Promotor</dt>
                  <dd>{photo.promotor || '—'}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{ebookTipoLabel(photo)}</dd>
                </div>
              </dl>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

