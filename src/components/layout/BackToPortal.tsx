import { Link } from 'react-router-dom';
import './BackToPortal.css';

type BackToPortalProps = {
  to?: string;
  label?: string;
};

export default function BackToPortal({
  to = '/',
  label = 'Voltar ao início',
}: BackToPortalProps) {
  return (
    <Link to={to} className="back-to-portal">
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
