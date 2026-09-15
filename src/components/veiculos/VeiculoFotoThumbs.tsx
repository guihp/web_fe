import { useState } from 'react';

export type VeiculoFotoItem = {
  url: string;
  label: string;
};

type Props = {
  items: VeiculoFotoItem[];
  emptyText?: string;
};

/** Galeria de anexos do veículo — legível no mobile (largura total, object-fit contain). */
export default function VeiculoFotoThumbs({
  items,
  emptyText = 'Nenhuma foto anexada.',
}: Props) {
  const valid = items.filter((i) => Boolean(i.url?.trim()));
  if (valid.length === 0) {
    return <p className="gv-muted">{emptyText}</p>;
  }

  return (
    <div className="gv-thumbs" role="list">
      {valid.map((item) => (
        <FotoCard key={`${item.label}-${item.url}`} url={item.url} label={item.label} />
      ))}
    </div>
  );
}

function FotoCard({ url, label }: VeiculoFotoItem) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="gv-thumb-card" role="listitem">
      <figcaption>{label}</figcaption>
      {failed ? (
        <div className="gv-thumb-fallback">
          <p>Não foi possível carregar a imagem neste aparelho.</p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Abrir foto
          </a>
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="gv-thumb-link">
          <img
            src={url}
            alt={label}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        </a>
      )}
    </figure>
  );
}
