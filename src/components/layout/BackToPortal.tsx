import { Link } from 'react-router-dom';
import './BackToPortal.css';

export default function BackToPortal() {
  return (
    <Link to="/" className="back-to-portal">
      <span aria-hidden>←</span>
      Voltar ao início
    </Link>
  );
}
