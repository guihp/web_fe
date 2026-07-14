import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtividadeModal } from '../../context/AtividadeModalContext';
import {
  atividadeCoversDate,
  fetchAllAtividades,
  type AtividadeRow,
} from '../../services/atividadesService';
import { statusColor, statusLabel } from '../../utils/atividadesDomain';
import './CalendarPanel.css';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toISO(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export default function CalendarPanel() {
  const { openAddAtividade, registerOnCreated } = useAtividadeModal();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [atividades, setAtividades] = useState<AtividadeRow[]>([]);

  const loadAtividades = useCallback(async () => {
    try {
      const rows = await fetchAllAtividades();
      setAtividades(rows);
    } catch {
      setAtividades([]);
    }
  }, []);

  useEffect(() => {
    loadAtividades();
  }, [loadAtividades]);

  useEffect(() => {
    const unregister = registerOnCreated(loadAtividades);
    return unregister;
  }, [registerOnCreated, loadAtividades]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const isCurrentMonth =
    viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
  const todayDay = today.getDate();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysWithActivities = useMemo(() => {
    const set = new Set<number>();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISO(year, month, d);
      if (atividades.some((a) => atividadeCoversDate(a, iso))) set.add(d);
    }
    return set;
  }, [atividades, year, month, daysInMonth]);

  const selectedISO = toISO(year, month, selectedDay);
  const atividadesDoDia = useMemo(
    () => atividades.filter((a) => atividadeCoversDate(a, selectedISO)),
    [atividades, selectedISO]
  );

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  const selectedLabel = new Date(year, month, selectedDay).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });

  return (
    <aside className="calendar-panel card">
      <div className="calendar-header">
        <h2 className="calendar-title">Calendário</h2>
      </div>

      <div className="calendar-month-row">
        <button type="button" className="calendar-nav" onClick={prevMonth} aria-label="Mês anterior">
          ‹
        </button>
        <span className="calendar-month">{monthLabel}</span>
        <button type="button" className="calendar-nav" onClick={nextMonth} aria-label="Próximo mês">
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((day, index) => {
          const isToday = isCurrentMonth && day === todayDay;
          const isSelected = day === selectedDay;
          const hasActivity = day !== null && daysWithActivities.has(day);

          return (
            <button
              key={`${day ?? 'e'}-${index}`}
              type="button"
              disabled={day === null}
              className={`calendar-day ${day ? '' : 'empty'} ${isToday ? 'today' : ''} ${isSelected && !isToday ? 'selected' : ''}`}
              onClick={() => day && setSelectedDay(day)}
            >
              {day ?? ''}
              {hasActivity && <span className="calendar-day-dot" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="calendar-tasks">
        <p className="calendar-tasks-title">Atividades em {selectedLabel}</p>

        {atividadesDoDia.length === 0 ? (
          <>
            <p className="empty-desc">Nenhuma atividade neste dia.</p>
          </>
        ) : (
          <ul className="calendar-task-list">
            {atividadesDoDia.map((a) => {
              const color = statusColor(a.status);
              return (
                <li key={a.id} className="calendar-task-item">
                  <span className="calendar-task-type">{a.tipo}</span>
                  <span className="calendar-task-meta">{a.responsavelNome}</span>
                  <span
                    className="calendar-task-status"
                    style={{ background: `${color}22`, color }}
                  >
                    {statusLabel(a.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" className="add-task-btn" onClick={openAddAtividade}>
          <span>＋</span> Nova atividade
        </button>
      </div>
    </aside>
  );
}
