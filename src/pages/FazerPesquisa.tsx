import {
  FormEvent,
  PointerEvent,
  TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canLancarVencimentos, isCampoMerchCargo } from '../data/portalModules';
import { fetchIndustriasAtivas } from '../services/industriaService';
import {
  fetchLojas,
  formatLojaNome,
  type Loja,
} from '../services/lojasService';
import {
  createPesquisaInicio,
  savePesquisaCapturaMedia,
  updatePesquisaCaptura,
  type TipoPesquisa,
} from '../services/priceService';
import {
  postPesquisaOcr,
  type PesquisaOcrCandidate,
} from '../services/pesquisaOcrService';
import {
  fetchUsuarioLojas,
  formatUsuarioLojaLabel,
} from '../services/usuarioLojasService';
import './FazerPesquisa.css';

/** UFs das regionais operacionais (MA/PI e PA). */
const UFS = ['MA', 'PI', 'PA'] as const;

type Step = 'contexto' | 'camera' | 'frame' | 'confirm';

/** Fração do menor lado do frame — moldura quadrada central (alinhada ao overlay CSS). */
const CAPTURE_SQUARE_RATIO = 0.82;
/** 1 = cover do stage; abaixo de 1 afasta (letterbox) para caber a etiqueta. */
const FRAME_ZOOM_MIN = 0.25;
/** Contain-ish default (~4:3 no stage quadrado) — mais da foto visível ao entrar no ajuste. */
const FRAME_ZOOM_DEFAULT = 0.75;
const FRAME_ZOOM_MAX = 5;
const FRAME_ZOOM_STEP = 0.25;

type FramePan = { x: number; y: number };

function coverFitSize(imgW: number, imgH: number, stageW: number, stageH: number) {
  const scale = Math.max(stageW / imgW, stageH / imgH);
  return { w: imgW * scale, h: imgH * scale, scale };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShutter() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    </svg>
  );
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

async function canvasToJpeg(full: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    full.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar JPEG.'))),
      'image/jpeg',
      quality,
    );
  });
}

async function captureFullFromCanvas(full: HTMLCanvasElement) {
  const previewBlob = await canvasToJpeg(full, 0.88);
  return { previewBlob, width: full.width, height: full.height };
}

/** Recorta a moldura quadrada após pan/zoom do usuário. */
async function cropAdjustedFrame(
  sourceBlob: Blob,
  imgW: number,
  imgH: number,
  stageW: number,
  stageH: number,
  zoom: number,
  pan: FramePan,
): Promise<{ crop: Blob; cropW: number; cropH: number; sx: number; sy: number }> {
  const bitmap = await createImageBitmap(sourceBlob);
  try {
    const fit = coverFitSize(imgW, imgH, stageW, stageH);
    const drawW = fit.w * zoom;
    const drawH = fit.h * zoom;
    const drawX = stageW / 2 + pan.x - drawW / 2;
    const drawY = stageH / 2 + pan.y - drawH / 2;
    const side = Math.min(stageW, stageH) * CAPTURE_SQUARE_RATIO;
    const fx = (stageW - side) / 2;
    const fy = (stageH - side) / 2;

    let sx = ((fx - drawX) / drawW) * imgW;
    let sy = ((fy - drawY) / drawH) * imgH;
    let sw = (side / drawW) * imgW;
    let sh = (side / drawH) * imgH;

    sx = clamp(sx, 0, Math.max(0, imgW - 1));
    sy = clamp(sy, 0, Math.max(0, imgH - 1));
    sw = clamp(sw, 1, imgW - sx);
    sh = clamp(sh, 1, imgH - sy);

    const cropW = Math.max(1, Math.round(sw));
    const cropH = Math.max(1, Math.round(sh));
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, cropW, cropH);
    const crop = await canvasToJpeg(canvas, 0.92);
    return { crop, cropW, cropH, sx, sy };
  } finally {
    bitmap.close();
  }
}

/** Retângulo do vídeo visível com object-fit: cover. */
function coverSourceRect(
  videoW: number,
  videoH: number,
  viewW: number,
  viewH: number,
) {
  const videoRatio = videoW / videoH;
  const viewRatio = viewW / viewH;
  if (videoRatio > viewRatio) {
    const sw = videoH * viewRatio;
    return { sx: (videoW - sw) / 2, sy: 0, sw, sh: videoH };
  }
  const sh = videoW / viewRatio;
  return { sx: 0, sy: (videoH - sh) / 2, sw: videoW, sh };
}

async function captureFromVideo(video: HTMLVideoElement) {
  const videoW = video.videoWidth;
  const videoH = video.videoHeight;
  if (!videoW || !videoH) throw new Error('Câmera ainda não está pronta.');
  const viewW = video.clientWidth || videoW;
  const viewH = video.clientHeight || videoH;
  const { sx, sy, sw, sh } = coverSourceRect(videoW, videoH, viewW, viewH);

  const full = document.createElement('canvas');
  full.width = Math.max(1, Math.round(sw));
  full.height = Math.max(1, Math.round(sh));
  const ctx = full.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, full.width, full.height);
  return captureFullFromCanvas(full);
}

async function captureFromImageFile(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const full = document.createElement('canvas');
    full.width = bitmap.width;
    full.height = bitmap.height;
    const ctx = full.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.drawImage(bitmap, 0, 0);
    return captureFullFromCanvas(full);
  } finally {
    bitmap.close();
  }
}

export default function FazerPesquisa() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const allowed = canLancarVencimentos(user?.tipo_usuario);
  const campoMerch = isCampoMerchCargo(user?.cargo);

  const [tipo, setTipo] = useState<TipoPesquisa>('interna');
  const [uf, setUf] = useState('');
  const [lojaId, setLojaId] = useState('');
  const [industria, setIndustria] = useState('');
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [sending, setSending] = useState(false);

  const [step, setStep] = useState<Step>('contexto');
  const [pesquisaId, setPesquisaId] = useState<number | null>(null);
  const [industriaCtx, setIndustriaCtx] = useState('');
  const [tipoCtx, setTipoCtx] = useState<TipoPesquisa>('interna');

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFallback, setCameraFallback] = useState(false);
  /** Live getUserMedia; false while frozen still is shown / OCR runs. */
  const [liveCamera, setLiveCamera] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const [frameZoom, setFrameZoom] = useState(FRAME_ZOOM_DEFAULT);
  const [framePan, setFramePan] = useState<FramePan>({ x: 0, y: 0 });
  const [captureNatural, setCaptureNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [descricao, setDescricao] = useState('');
  const [precoVarejo, setPrecoVarejo] = useState('');
  const [precoAtacado, setPrecoAtacado] = useState('');
  const [, setCandidates] = useState<PesquisaOcrCandidate[]>([]);
  const [confirming, setConfirming] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** JPEG completo da captura (antes do ajuste de moldura). */
  const fullCaptureBlobRef = useRef<Blob | null>(null);
  /** JPEG da região ajustada (enviada ao OCR e salva). */
  const lastPreviewBlobRef = useRef<Blob | null>(null);
  /** Snapshot OCR bruto (antes de edição manual no formulário). */
  const lastOcrRef = useRef<{
    product_text: string;
    preco_varejo: string | null;
    preco_atacado: string | null;
  } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const frameZoomRef = useRef(FRAME_ZOOM_DEFAULT);
  const framePanRef = useRef<FramePan>({ x: 0, y: 0 });

  const clearCaptureMediaRefs = () => {
    fullCaptureBlobRef.current = null;
    lastPreviewBlobRef.current = null;
    lastOcrRef.current = null;
    setCaptureNatural(null);
    setFrameZoom(FRAME_ZOOM_DEFAULT);
    setFramePan({ x: 0, y: 0 });
    frameZoomRef.current = FRAME_ZOOM_DEFAULT;
    framePanRef.current = { x: 0, y: 0 };
  };

  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  };

  const showFrozenPreview = (blob: Blob) => {
    revokePreview();
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOpts(true);
      try {
        const [lojasData, indData] = await Promise.all([
          campoMerch && user?.id
            ? fetchUsuarioLojas(user.id).then((rows) => rows as Loja[])
            : fetchLojas(),
          fetchIndustriasAtivas(),
        ]);
        if (cancelled) return;
        setLojas(lojasData.filter((l) => (l.status ?? 'Ativo') !== 'Inativo'));
        setIndustrias(indData.map((i) => i.Nome).filter(Boolean));
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Erro ao carregar lojas.', 'error');
        }
      } finally {
        if (!cancelled) setLoadingOpts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campoMerch, user?.id, showToast]);

  const lojasFiltradas = useMemo(() => {
    if (!uf) return lojas;
    return lojas.filter((l) => (l.estado ?? '').toUpperCase() === uf);
  }, [lojas, uf]);

  useEffect(() => {
    if (!lojaId) return;
    const still = lojasFiltradas.some((l) => String(l.id) === lojaId);
    if (!still) setLojaId('');
  }, [lojasFiltradas, lojaId]);

  useEffect(() => {
    if (step !== 'camera' || !liveCamera) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setCameraReady(false);
      return;
    }

    let cancelled = false;
    setCameraFallback(false);
    setCameraReady(false);

    (async () => {
      // getUserMedia requires a secure context; on HTTP LAN (iPhone) go straight to file/capture.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setCameraFallback(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        if (!cancelled) setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraFallback(true);
          showToast(
            'Não foi possível abrir a câmera. Use a captura pela galeria.',
            'error',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [step, liveCamera, showToast]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (step === 'contexto') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [step]);

  useEffect(() => {
    frameZoomRef.current = frameZoom;
  }, [frameZoom]);

  useEffect(() => {
    framePanRef.current = framePan;
  }, [framePan]);

  useEffect(() => {
    if (step !== 'frame') return;
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, previewUrl]);

  if (!allowed) {
    return <Navigate to="/merchandising" replace />;
  }

  const resetToContexto = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    revokePreview();
    clearCaptureMediaRefs();
    setStep('contexto');
    setPesquisaId(null);
    setDescricao('');
    setPrecoVarejo('');
    setPrecoAtacado('');
    setCandidates([]);
    setOcrBusy(false);
    setCaptureError(false);
    setConfirming(false);
    setCameraReady(false);
    setCameraFallback(false);
    setLiveCamera(true);
  };

  const applyOcrResult = (
    productText: string,
    varejo: string | null,
    atacado: string | null,
    _list: PesquisaOcrCandidate[],
  ) => {
    // Catálogo desligado: só texto/preços do OCR da etiqueta.
    setCandidates([]);
    const descricaoFinal = (productText || '').trim();
    const varejoFinal = varejo?.trim() ? varejo : '';
    const atacadoFinal = atacado?.trim() ? atacado : '';
    setDescricao(descricaoFinal);
    setPrecoVarejo(varejoFinal);
    setPrecoAtacado(atacadoFinal);
    revokePreview();
    setCaptureError(false);
    setLiveCamera(true);
    setStep('confirm');
  };

  const enterFrameAdjust = (previewBlob: Blob, width: number, height: number) => {
    fullCaptureBlobRef.current = previewBlob;
    lastPreviewBlobRef.current = null;
    lastOcrRef.current = null;
    setCaptureNatural({ w: width, h: height });
    setFrameZoom(FRAME_ZOOM_DEFAULT);
    setFramePan({ x: 0, y: 0 });
    frameZoomRef.current = FRAME_ZOOM_DEFAULT;
    framePanRef.current = { x: 0, y: 0 };
    showFrozenPreview(previewBlob);
    stopStream(streamRef.current);
    streamRef.current = null;
    setLiveCamera(false);
    setCameraReady(false);
    setCaptureError(false);
    setOcrBusy(false);
    setStep('frame');
  };

  const runOcrOnCrop = async (cropBlob: Blob) => {
    lastPreviewBlobRef.current = cropBlob;
    lastOcrRef.current = null;
    setCaptureError(false);
    setOcrBusy(true);
    try {
      const result = await postPesquisaOcr({
        produtoCrop: cropBlob,
        precoCrop: cropBlob,
        tipo: tipoCtx,
        industria: industriaCtx,
      });
      const productText = (result.product_text || '').trim();
      lastOcrRef.current = {
        product_text: productText,
        preco_varejo: result.preco_varejo,
        preco_atacado: result.preco_atacado,
      };
      applyOcrResult(
        result.product_text,
        result.preco_varejo,
        result.preco_atacado,
        result.candidates,
      );
    } catch (err) {
      lastOcrRef.current = null;
      setCaptureError(true);
      if (fullCaptureBlobRef.current) {
        showFrozenPreview(fullCaptureBlobRef.current);
      }
      showToast(err instanceof Error ? err.message : 'Erro no OCR.', 'error');
    } finally {
      setOcrBusy(false);
    }
  };

  const handleAnalyzeFrame = async () => {
    if (ocrBusy) return;
    const source = fullCaptureBlobRef.current;
    const natural = captureNatural;
    const stage = stageRef.current;
    if (!source || !natural || !stage) {
      showToast('Foto indisponível para ajuste.', 'error');
      return;
    }
    const stageW = stage.clientWidth || stageSize.w;
    const stageH = stage.clientHeight || stageSize.h;
    if (!stageW || !stageH) {
      showToast('Aguarde a moldura carregar.', 'error');
      return;
    }
    // Show busy immediately — iPhone gallery captures can take seconds to crop
    // before postPesquisaOcr runs (runOcrOnCrop also toggles ocrBusy).
    setOcrBusy(true);
    try {
      const zoom = frameZoomRef.current;
      const pan = framePanRef.current;
      const { crop } = await cropAdjustedFrame(
        source,
        natural.w,
        natural.h,
        stageW,
        stageH,
        zoom,
        pan,
      );
      await runOcrOnCrop(crop);
    } catch (err) {
      setOcrBusy(false);
      showToast(err instanceof Error ? err.message : 'Falha ao recortar a foto.', 'error');
    }
  };

  const restartLiveCamera = () => {
    revokePreview();
    clearCaptureMediaRefs();
    setCaptureError(false);
    setOcrBusy(false);
    setLiveCamera(true);
    setStep('camera');
  };

  const bumpZoom = (delta: number) => {
    setFrameZoom((z) => {
      const next = clamp(
        Math.round((z + delta) / FRAME_ZOOM_STEP) * FRAME_ZOOM_STEP,
        FRAME_ZOOM_MIN,
        FRAME_ZOOM_MAX,
      );
      frameZoomRef.current = next;
      return next;
    });
  };

  const onFramePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (ocrBusy || pinchRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: framePanRef.current.x,
      origY: framePanRef.current.y,
    };
  };

  const onFramePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || pinchRef.current) return;
    const next = {
      x: drag.origX + (e.clientX - drag.startX),
      y: drag.origY + (e.clientY - drag.startY),
    };
    framePanRef.current = next;
    setFramePan(next);
  };

  const onFramePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const onFrameTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (ocrBusy) return;
    if (e.touches.length === 2) {
      dragRef.current = null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        dist: Math.hypot(dx, dy) || 1,
        zoom: frameZoomRef.current,
      };
    }
  };

  const onFrameTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const pinch = pinchRef.current;
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy) || 1;
    const next = clamp(pinch.zoom * (dist / pinch.dist), FRAME_ZOOM_MIN, FRAME_ZOOM_MAX);
    frameZoomRef.current = next;
    setFrameZoom(next);
  };

  const onFrameTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const loja = lojasFiltradas.find((l) => String(l.id) === lojaId);
    if (!uf) {
      showToast('Selecione o estado.', 'error');
      return;
    }
    if (!loja) {
      showToast('Selecione a loja.', 'error');
      return;
    }
    if (!industria.trim()) {
      showToast(
        tipo === 'interna' ? 'Selecione a indústria.' : 'Informe o fornecedor.',
        'error',
      );
      return;
    }

    setSending(true);
    try {
      const industriaTrim = industria.trim();
      const created = await createPesquisaInicio({
        tipo,
        loja: formatLojaNome(loja),
        uf,
        industria: industriaTrim,
        promotor: user?.nome ?? null,
      });
      setPesquisaId(created.id);
      setTipoCtx(tipo);
      setIndustriaCtx(industriaTrim);
      revokePreview();
      setCaptureError(false);
      setLiveCamera(true);
      setStep('camera');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar pesquisa.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCapture = async () => {
    if (ocrBusy || step === 'frame') return;
    const video = videoRef.current;
    if (!video || !cameraReady) {
      showToast('Aguarde a câmera carregar.', 'error');
      return;
    }
    try {
      const { previewBlob, width, height } = await captureFromVideo(video);
      enterFrameAdjust(previewBlob, width, height);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha na captura.', 'error');
    }
  };

  const handleFileCapture = async (file: File | null) => {
    if (!file || ocrBusy) return;
    try {
      const { previewBlob, width, height } = await captureFromImageFile(file);
      enterFrameAdjust(previewBlob, width, height);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao ler a foto.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (confirming || pesquisaId == null) return;
    const desc = descricao.trim();
    if (!desc) {
      showToast('Informe a descrição do produto.', 'error');
      return;
    }
    setConfirming(true);
    try {
      await updatePesquisaCaptura(pesquisaId, {
        descricao: desc,
        preco_varejo: precoVarejo.trim() || null,
        preco_atacado: precoAtacado.trim() || null,
      });

      const blob = lastPreviewBlobRef.current;
      const ocr = lastOcrRef.current;

      if (blob) {
        try {
          await savePesquisaCapturaMedia(pesquisaId, {
            foto: blob,
            ocr_texto_raw: ocr?.product_text ?? null,
            ocr_preco_varejo: ocr?.preco_varejo ?? null,
            ocr_preco_atacado: ocr?.preco_atacado ?? null,
          });
        } catch (mediaErr) {
          const mediaMsg =
            mediaErr instanceof Error ? mediaErr.message : 'Falha ao salvar foto.';
          showToast(
            `Pesquisa confirmada, mas a foto não foi salva: ${mediaMsg}`,
            'error',
          );
        }
      } else {
        showToast(
          'Pesquisa confirmada, mas a foto da captura não estava disponível.',
          'error',
        );
      }

      showToast(`Pesquisa #${pesquisaId} confirmada.`, 'success');
      setLojaId('');
      if (tipoCtx === 'externa') setIndustria('');
      resetToContexto();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao confirmar captura.', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const handleRetake = () => {
    setDescricao('');
    setPrecoVarejo('');
    setPrecoAtacado('');
    setCandidates([]);
    revokePreview();
    clearCaptureMediaRefs();
    setCaptureError(false);
    setOcrBusy(false);
    setLiveCamera(true);
    setStep('camera');
  };

  const blockLojaWithoutUf = () => {
    if (uf) return;
    showToast('Selecione o estado primeiro', 'error');
  };

  const frameFit =
    captureNatural && stageSize.w > 0 && stageSize.h > 0
      ? coverFitSize(captureNatural.w, captureNatural.h, stageSize.w, stageSize.h)
      : null;
  const frameDrawW = frameFit ? frameFit.w * frameZoom : 0;
  const frameDrawH = frameFit ? frameFit.h * frameZoom : 0;

  if (step === 'frame') {
    return (
      <div className="fp-camera" role="dialog" aria-label="Ajustar etiqueta">
        <header className="fp-camera-bar">
          <button
            type="button"
            className="fp-camera-icon-btn"
            aria-label="Voltar"
            onClick={resetToContexto}
            disabled={ocrBusy}
          >
            <IconBack />
          </button>
          <div className="fp-camera-title">
            <strong>{ocrBusy ? 'Analisando…' : 'Ajuste a etiqueta na moldura'}</strong>
            <span>
              {ocrBusy
                ? 'Pode abaixar o celular'
                : captureError
                  ? 'Toque em Tirar de novo'
                  : 'Arraste e use zoom na moldura'}
            </span>
          </div>
          <span className="fp-camera-spacer" aria-hidden />
        </header>

        <div
          ref={stageRef}
          className="fp-camera-stage fp-frame-stage"
          onPointerDown={onFramePointerDown}
          onPointerMove={onFramePointerMove}
          onPointerUp={onFramePointerUp}
          onPointerCancel={onFramePointerUp}
          onTouchStart={onFrameTouchStart}
          onTouchMove={onFrameTouchMove}
          onTouchEnd={onFrameTouchEnd}
          onTouchCancel={onFrameTouchEnd}
        >
          {previewUrl && frameFit && (
            <img
              src={previewUrl}
              alt="Foto capturada"
              className="fp-frame-img"
              draggable={false}
              style={{
                width: frameDrawW,
                height: frameDrawH,
                transform: `translate(-50%, -50%) translate(${framePan.x}px, ${framePan.y}px)`,
              }}
            />
          )}
          {previewUrl && !frameFit && (
            <img
              src={previewUrl}
              alt="Foto capturada"
              className="fp-camera-preview"
              draggable={false}
            />
          )}

          <div className="fp-camera-overlay" aria-hidden>
            <div className="fp-camera-frame" />
          </div>

          {ocrBusy && (
            <div className="fp-camera-busy" role="status">
              Analisando…
            </div>
          )}
        </div>

        <footer className="fp-camera-footer fp-frame-footer">
          {!ocrBusy && (
            <div className="fp-frame-zoom" role="group" aria-label="Zoom">
              <button
                type="button"
                className="fp-frame-zoom-btn"
                aria-label="Diminuir zoom"
                onClick={() => bumpZoom(-FRAME_ZOOM_STEP)}
                disabled={frameZoom <= FRAME_ZOOM_MIN}
              >
                −
              </button>
              <span className="fp-frame-zoom-label">{Math.round(frameZoom * 100)}%</span>
              <button
                type="button"
                className="fp-frame-zoom-btn"
                aria-label="Aumentar zoom"
                onClick={() => bumpZoom(FRAME_ZOOM_STEP)}
                disabled={frameZoom >= FRAME_ZOOM_MAX}
              >
                +
              </button>
            </div>
          )}
          {captureError ? (
            <div className="fp-frame-actions">
              <button
                type="button"
                className="fp-frame-secondary"
                onClick={restartLiveCamera}
              >
                Tirar de novo
              </button>
              <button
                type="button"
                className="fp-frame-primary"
                onClick={() => void handleAnalyzeFrame()}
              >
                Analisar
              </button>
            </div>
          ) : ocrBusy ? (
            <p className="fp-camera-analyzing-hint">Processando a região ajustada…</p>
          ) : (
            <div className="fp-frame-actions">
              <button
                type="button"
                className="fp-frame-secondary"
                onClick={restartLiveCamera}
              >
                Tirar de novo
              </button>
              <button
                type="button"
                className="fp-frame-primary"
                onClick={() => void handleAnalyzeFrame()}
              >
                Analisar
              </button>
            </div>
          )}
        </footer>
      </div>
    );
  }

  if (step === 'camera') {
    return (
      <div className="fp-camera" role="dialog" aria-label="Câmera da pesquisa">
        <header className="fp-camera-bar">
          <button
            type="button"
            className="fp-camera-icon-btn"
            aria-label="Voltar"
            onClick={resetToContexto}
          >
            <IconBack />
          </button>
          <div className="fp-camera-title">
            <strong>Capturar produto</strong>
            <span>Encaixe produto e preço no quadrado</span>
          </div>
          <span className="fp-camera-spacer" aria-hidden />
        </header>

        <div className="fp-camera-stage">
          {!cameraFallback ? (
            <video
              ref={videoRef}
              className="fp-camera-video"
              playsInline
              muted
              autoPlay
            />
          ) : (
            <div className="fp-camera-fallback">
              <p>Use a câmera do aparelho para enquadrar produto e preço no quadrado.</p>
            </div>
          )}

          <div className="fp-camera-overlay" aria-hidden>
            <div className="fp-camera-frame" />
          </div>
        </div>

        <footer className="fp-camera-footer">
          {!cameraFallback && (
            <button
              type="button"
              className="fp-camera-shutter"
              aria-label="Capturar"
              onClick={() => void handleCapture()}
              disabled={!cameraReady}
            >
              <IconShutter />
            </button>
          )}
          <button
            type="button"
            className={cameraFallback ? 'fp-camera-fallback-btn' : 'fp-camera-alt'}
            onClick={() => fileInputRef.current?.click()}
          >
            Galeria / captura
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="fp-camera-file"
            onChange={(e) => void handleFileCapture(e.target.files?.[0] ?? null)}
          />
        </footer>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="fp-confirm" role="dialog" aria-label="Confirmar captura">
        <header className="fazer-pesquisa-topbar">
          <button
            type="button"
            className="fazer-pesquisa-back-compact"
            aria-label="Voltar e refazer foto"
            onClick={handleRetake}
            disabled={confirming}
          >
            <IconBack />
          </button>
          <h1>Revisar captura</h1>
        </header>

        <div className="fp-confirm-card">
          <label className="fazer-pesquisa-field">
            <span className="fazer-pesquisa-label">Descrição do produto</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              disabled={confirming}
              autoComplete="off"
            />
          </label>

          <div className="fp-confirm-prices">
            <label className="fazer-pesquisa-field">
              <span className="fazer-pesquisa-label">Preço de varejo</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={precoVarejo}
                onChange={(e) => setPrecoVarejo(e.target.value)}
                disabled={confirming}
                autoComplete="off"
              />
            </label>
            <label className="fazer-pesquisa-field">
              <span className="fazer-pesquisa-label">Preço de atacado</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={precoAtacado}
                onChange={(e) => setPrecoAtacado(e.target.value)}
                disabled={confirming}
                autoComplete="off"
              />
            </label>
          </div>
          {!precoAtacado.trim() && (
            <p className="fazer-pesquisa-hint fp-confirm-atacado-hint">
              Se o OCR não achou o atacado, preencha manualmente.
            </p>
          )}

          <div className="fp-confirm-actions">
            <button
              type="button"
              className="fp-confirm-secondary"
              onClick={handleRetake}
              disabled={confirming}
            >
              Refazer foto
            </button>
            <button
              type="button"
              className="fazer-pesquisa-camera"
              onClick={() => void handleConfirm()}
              disabled={confirming}
            >
              {confirming ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fazer-pesquisa-page">
      <header className="fazer-pesquisa-topbar">
        <Link
          to="/merchandising"
          className="fazer-pesquisa-back-compact"
          aria-label="Voltar ao Merchandising"
        >
          <IconBack />
        </Link>
        <h1>Fazer Pesquisa</h1>
      </header>

      <form className="fazer-pesquisa-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="fazer-pesquisa-fields">
          <div className="fazer-pesquisa-tipo" role="tablist" aria-label="Tipo de pesquisa">
            <button
              type="button"
              role="tab"
              aria-selected={tipo === 'interna'}
              className={tipo === 'interna' ? 'active' : undefined}
              onClick={() => {
                setTipo('interna');
                setIndustria('');
              }}
            >
              Interna
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tipo === 'externa'}
              className={tipo === 'externa' ? 'active' : undefined}
              onClick={() => {
                setTipo('externa');
                setIndustria('');
              }}
            >
              Externa
            </button>
          </div>

          <p className="fazer-pesquisa-hint">
            {tipo === 'interna'
              ? 'Interna: apenas produtos das nossas indústrias.'
              : 'Externa: nosso produto ou concorrência.'}
          </p>

          <fieldset className="fazer-pesquisa-uf" disabled={loadingOpts}>
            <legend className="fazer-pesquisa-label">Estado</legend>
            <div className="fazer-pesquisa-uf-row" role="group" aria-label="Selecione o estado">
              {UFS.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={uf === u ? 'active' : undefined}
                  aria-pressed={uf === u}
                  onClick={() => setUf(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="fazer-pesquisa-field">
            <span className="fazer-pesquisa-label">Nome da Loja</span>
            <span
              className={`fazer-pesquisa-select${!uf ? ' is-blocked' : ''}`}
              onPointerDown={(e) => {
                if (uf) return;
                e.preventDefault();
                blockLojaWithoutUf();
              }}
            >
              <select
                value={lojaId}
                onChange={(e) => setLojaId(e.target.value)}
                onFocus={blockLojaWithoutUf}
                required
                disabled={loadingOpts || !uf}
                aria-disabled={!uf}
              >
                <option value="">
                  {!uf
                    ? 'Selecione o estado primeiro'
                    : lojasFiltradas.length === 0
                      ? campoMerch
                        ? 'Nenhuma loja sua neste estado'
                        : 'Nenhuma loja neste estado'
                      : 'Nome da Loja'}
                </option>
                {lojasFiltradas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {campoMerch ? formatUsuarioLojaLabel(l) : formatLojaNome(l)}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="fazer-pesquisa-field">
            <span className="fazer-pesquisa-label">
              {tipo === 'interna' ? 'Indústria' : 'Nome do Fornecedor'}
            </span>
            {tipo === 'interna' ? (
              <span className="fazer-pesquisa-select">
                <select
                  value={industria}
                  onChange={(e) => setIndustria(e.target.value)}
                  required
                  disabled={loadingOpts}
                >
                  <option value="">Nome do Fornecedor</option>
                  {industrias.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <input
                type="text"
                placeholder="Nome do Fornecedor"
                value={industria}
                onChange={(e) => setIndustria(e.target.value)}
                required
                autoComplete="off"
                enterKeyHint="done"
              />
            )}
          </label>
        </div>

        <div className="fazer-pesquisa-actions">
          <button type="submit" className="fazer-pesquisa-camera" disabled={sending || loadingOpts}>
            {sending ? 'Abrindo…' : 'Abrir Câmera'}
          </button>
          <p className="fazer-pesquisa-foot">
            Tire a foto, ajuste a etiqueta na moldura e confirme descrição e preço antes de gravar.
          </p>
        </div>
      </form>
    </div>
  );
}
