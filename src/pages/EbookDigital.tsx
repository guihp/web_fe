import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  buildEbookPdf,
  EBOOK_PDF_HARD_LIMIT,
  EBOOK_PDF_SOFT_LIMIT,
} from '../utils/ebookPdf';
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

const PREVIEW_MAX = 12;

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
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

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

  const previewPhotos = useMemo(
    () => selectedPhotos.slice(0, PREVIEW_MAX),
    [selectedPhotos],
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
    if (selectedPhotos.length > EBOOK_PDF_SOFT_LIMIT) {
      showToast(
        `Você selecionou ${selectedPhotos.length} fotos. Use filtros (indústria, UF e tipo DEPOIS) para gerar ebooks menores e mais estáveis.`,
        'error',
      );
    }
    setPdfOpen(true);
  };

  const downloadPdf = async () => {
    if (selectedPhotos.length === 0) {
      showToast('Selecione ao menos uma miniatura para gerar o PDF.', 'error');
      return;
    }
    if (selectedPhotos.length > EBOOK_PDF_HARD_LIMIT) {
      const ok = window.confirm(
        `São ${selectedPhotos.length} fotos. O ideal é filtrar por indústria, UF e tipo DEPOIS (limite recomendado: ${EBOOK_PDF_SOFT_LIMIT}). Continuar mesmo assim?`,
      );
      if (!ok) return;
    }

    setPdfBusy(true);
    setPdfProgress({ done: 0, total: selectedPhotos.length });
    try {
      const pdf = await buildEbookPdf(selectedPhotos, (done, total) => {
        setPdfProgress({ done, total });
      });
      pdf.save(`ebook-promotores-${todayStamp()}.pdf`);
      showToast('PDF baixado.', 'success');
      setPdfOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao gerar PDF.', 'error');
    } finally {
      setPdfBusy(false);
      setPdfProgress(null);
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

      <aside className="ebook-tip" role="note">
        <strong>Dica para gerar o ebook:</strong> use os filtros para reduzir a quantidade de
        fotos, por exemplo <em>uma indústria</em>, <em>um estado (UF)</em> e, de preferência,
        só o tipo <em>DEPOIS</em>. Assim o PDF fica bem menor e mais estável (ideal até cerca de{' '}
        {EBOOK_PDF_SOFT_LIMIT} fotos por arquivo).
      </aside>

      <div className="ebook-toolbar">
        <div>
          <h2>Galeria de Fotos</h2>
          <p className="ebook-count">
            {loading
              ? 'Carregando…'
              : `${filtered.length} registro${filtered.length === 1 ? '' : 's'} (de ${photos.length}) · ${selected.size} selecionada${selected.size === 1 ? '' : 's'}`}
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
                    <div className="ebook-meta-item ebook-meta-senha">
                      <span>Senha do dia</span>
                      <strong>{current.senhaDoDia || '—'}</strong>
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
            {selected.size > EBOOK_PDF_SOFT_LIMIT ? (
              <p className="ebook-selec-warn">
                Muitas fotos selecionadas ({selected.size}). Filtre antes de gerar o PDF.
              </p>
            ) : null}
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
              {selectedPhotos.length > EBOOK_PDF_SOFT_LIMIT ? (
                <p className="ebook-pdf-warn">
                  {selectedPhotos.length} fotos selecionadas. O recomendado é filtrar por
                  indústria + UF + tipo <strong>DEPOIS</strong> (cerca de {EBOOK_PDF_SOFT_LIMIT} por
                  ebook) para evitar travamentos.
                </p>
              ) : null}
              {selectedPhotos.length > PREVIEW_MAX ? (
                <p className="ebook-pdf-note">
                  Prévia das primeiras {PREVIEW_MAX} de {selectedPhotos.length}. O download inclui
                  todas as selecionadas.
                </p>
              ) : null}
              {previewPhotos.map((photo, i) => (
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
                    <p>
                      <strong>Senha do dia:</strong> {photo.senhaDoDia || '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="ebook-modal-actions">
              {pdfProgress ? (
                <span className="ebook-pdf-progress">
                  Gerando {pdfProgress.done}/{pdfProgress.total}…
                </span>
              ) : null}
              <button type="button" className="ebook-btn" onClick={() => setPdfOpen(false)} disabled={pdfBusy}>
                Cancelar
              </button>
              <button
                type="button"
                className="ebook-btn ebook-btn-primary"
                onClick={downloadPdf}
                disabled={pdfBusy}
              >
                {pdfBusy ? 'Gerando…' : `Baixar PDF (${selectedPhotos.length})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}