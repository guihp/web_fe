import { supabase } from '../lib/supabase';
import { fetchGerenteId } from './atividadesService';

export type Treinamento = {
  id: number;
  titulo: string;
  tipo: string;
  link_material: string | null;
  criado_por: number | null;
  created_at?: string;
};

export function isVideoType(tipo: string) {
  const t = (tipo || '').toLowerCase();
  if (t === 'pdf' || t === 'arquivo') return false;
  return t === 'video' || t === 'vídeo' || t === 'link' || t.includes('youtube');
}

const isYoutubeUrl = (url: string) =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(url.trim());

export async function fetchTreinamentos(): Promise<Treinamento[]> {
  const { data, error } = await supabase.from('treinamento').select('*').order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Treinamento[];
}

async function uploadPdf(file: File): Promise<string> {
  const path = `treinamentos/${Date.now()}_${file.name.replace(/\s/g, '_')}`;

  const { data, error } = await supabase.storage
    .from('pdf_treinamento')
    .upload(path, file, { contentType: 'application/pdf', upsert: false });

  if (error) throw new Error(error.message);

  return supabase.storage.from('pdf_treinamento').getPublicUrl(data.path).data.publicUrl;
}

export async function addTreinamento(data: {
  titulo: string;
  tipo: 'PDF' | 'Video';
  file?: File | null;
  youtubeLink?: string;
}) {
  if (!data.titulo.trim()) {
    throw new Error('Informe o título do treinamento.');
  }

  let linkMaterial = data.youtubeLink?.trim() || '';

  if (data.tipo === 'PDF') {
    if (!data.file) throw new Error('Selecione um arquivo PDF.');
    linkMaterial = await uploadPdf(data.file);
  } else if (!isYoutubeUrl(linkMaterial)) {
    throw new Error('Informe um link válido do YouTube.');
  }

  const gerenteId = await fetchGerenteId();

  const { error } = await supabase.from('treinamento').insert({
    titulo: data.titulo.trim(),
    tipo: data.tipo,
    link_material: linkMaterial,
    criado_por: gerenteId,
  });

  if (error) throw new Error(error.message);
}

export function downloadPdf(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function openVideo(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
