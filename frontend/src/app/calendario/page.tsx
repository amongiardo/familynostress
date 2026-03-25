'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, Modal, Form, Badge, Spinner, Row, Col, Button, InputGroup } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaTrash, FaFilePdf, FaPaste } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, dishesApi } from '@/lib/api';
import { MealType, DishCategory, MealOut, MealPlan } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';

export default function CalendarioPage() {
  const queryClient = useQueryClient();
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string }>(() => {
    const today = new Date();
    const start = format(today, 'yyyy-MM-dd');
    return { start, end: start };
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingOutDelete, setPendingOutDelete] = useState<{ date: string; mealType: MealType } | null>(null);
  const [pendingDraftSave, setPendingDraftSave] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showClearRangeModal, setShowClearRangeModal] = useState(false);
  const [clearAuthCode, setClearAuthCode] = useState('');
  const [clearRangeAuthCode, setClearRangeAuthCode] = useState('');
  const [clearRange, setClearRange] = useState('this_week');
  const [currentMonthAnchor, setCurrentMonthAnchor] = useState<Date>(new Date());
  const [exportMeals, setExportMeals] = useState<MealPlan[] | null>(null);
  const [exportRange, setExportRange] = useState<{ start: Date; end: Date } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);
  const [draftSlots, setDraftSlots] = useState<{
    pranzo: Record<DishCategory, string>;
    cena: Record<DishCategory, string>;
  }>({
    pranzo: { primo: '', secondo: '', contorno: '' },
    cena: { primo: '', secondo: '', contorno: '' },
  });
  const [draftOut, setDraftOut] = useState<{ pranzo: boolean; cena: boolean }>({
    pranzo: false,
    cena: false,
  });
  const [draftBackup, setDraftBackup] = useState<{
    pranzo: Record<DishCategory, string> | null;
    cena: Record<DishCategory, string> | null;
  }>({ pranzo: null, cena: null });
  const [savingDraft, setSavingDraft] = useState(false);

  const toDateOnly = useCallback((value: string) => value.split('T')[0], []);
  const toLocalDate = useCallback((value: string) => new Date(`${toDateOnly(value)}T00:00:00`), [
    toDateOnly,
  ]);
  const toLocalDateFromDateOnly = useCallback((value: string) => new Date(`${value}T00:00:00`), []);

  const { data: meals, isLoading: mealsLoading, isFetching: mealsFetching } = useQuery({
    queryKey: ['meals', 'range', visibleRange.start, visibleRange.end],
    queryFn: () => mealsApi.getRange(visibleRange.start, visibleRange.end),
    enabled: Boolean(visibleRange.start && visibleRange.end),
    placeholderData: (previous) => previous,
    staleTime: 30000,
  });

  const { data: mealOuts } = useQuery({
    queryKey: ['mealOuts', visibleRange.start, visibleRange.end],
    queryFn: () => mealsApi.getOutRange(visibleRange.start, visibleRange.end),
    enabled: Boolean(visibleRange.start && visibleRange.end),
  });

  const { data: dishes } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: mealsApi.create,
    onSuccess: (meal) => {
      const cachedMeals = queryClient.getQueryData<MealPlan[]>([
        'meals',
        'range',
        visibleRange.start,
        visibleRange.end,
      ]);
      const alreadyPlanned = cachedMeals?.some((existing) => existing.id === meal.id);

      if (alreadyPlanned) {
        setError('Piatto già pianificato per questa data e pasto');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['meals'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, authCode }: { id: string; authCode: string }) => mealsApi.delete(id, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });

  const setOutMutation = useMutation({
    mutationFn: ({ date, mealType, authCode }: { date: string; mealType: MealType; authCode: string }) =>
      mealsApi.setOut({ date, mealType }, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
    },
  });

  const removeOutMutation = useMutation({
    mutationFn: ({ date, mealType, authCode }: { date: string; mealType: MealType; authCode: string }) =>
      mealsApi.removeOut({ date, mealType }, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: ({ authCode }: { authCode: string }) => mealsApi.clearAll(authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });

  const clearRangeMutation = useMutation({
    mutationFn: ({ rangeType, authCode }: { rangeType: string; authCode: string }) =>
      mealsApi.clearRange({ rangeType }, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });

  const clearRanges = [
    { value: 'this_week', label: 'Questa settimana (lun-dom)' },
    { value: 'last_week', label: 'Settimana scorsa (lun-dom)' },
    { value: 'next_week', label: 'Settimana prossima (lun-dom)' },
    { value: 'this_month', label: 'Questo mese' },
    { value: 'last_month', label: 'Mese scorso' },
    { value: 'next_month', label: 'Mese prossimo' },
    { value: 'last_7_days', label: 'Ultimi 7 giorni' },
    { value: 'next_7_days', label: 'Prossimi 7 giorni' },
    { value: 'workweek', label: 'Settimana lavorativa (lun-ven)' },
  ];

  const calendarEvents = useMemo(() => {
    if (!meals) return [];

    const slotOrder = { primo: 0, secondo: 1, contorno: 2 } as const;
    const mealOrder = { pranzo: 0, cena: 1 } as const;

    const sorted = [...meals].sort((a, b) => {
      const dateA = toDateOnly(a.date);
      const dateB = toDateOnly(b.date);
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      if (mealOrder[a.mealType] !== mealOrder[b.mealType]) {
        return mealOrder[a.mealType] - mealOrder[b.mealType];
      }
      return slotOrder[a.slotCategory] - slotOrder[b.slotCategory];
    });

    const mealEvents = sorted.map((meal) => ({
      id: meal.id,
      title: `${meal.mealType === 'pranzo' ? 'Pranzo' : 'Cena'} · ${meal.slotCategory}: ${meal.dish.name}`,
      start: toDateOnly(meal.date),
      startTime: `${mealOrder[meal.mealType]}${slotOrder[meal.slotCategory]}`,
      allDay: true,
      extendedProps: {
        mealType: meal.mealType,
        category: meal.dish.category,
        slotCategory: meal.slotCategory,
        dish: meal.dish,
      },
      backgroundColor: meal.mealType === 'pranzo' ? '#f39c12' : '#9b59b6',
      borderColor: meal.mealType === 'pranzo' ? '#f39c12' : '#9b59b6',
    }));

    const outEvents =
      mealOuts?.map((out) => ({
        id: `out-${out.id}`,
        title: out.mealType === 'pranzo' ? 'Pranzo fuori' : 'Cena fuori',
        start: format(new Date(out.date), 'yyyy-MM-dd'),
        startTime: out.mealType === 'pranzo' ? '0' : '1',
        allDay: true,
        extendedProps: {
          isOut: true,
          mealType: out.mealType,
          outId: out.id,
        },
        backgroundColor: '#64748b',
        borderColor: '#64748b',
      })) ?? [];

    return [...mealEvents, ...outEvents];
  }, [meals, mealOuts]);

  const handleDateClick = (arg: { date: Date; dateStr: string }) => {
    setSelectedDateStr(arg.dateStr);
    setSelectedDate(toLocalDateFromDateOnly(arg.dateStr));
    setError('');
    initDraft(arg.dateStr);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setSelectedDateStr(null);
    setError('');
    setDraftBackup({ pranzo: null, cena: null });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof mealsApi.update>[1] }) =>
      mealsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleDeleteMeal = (mealId: string) => {
    setPendingDeleteId(mealId);
  };

  const getMealOut = (dateStr: string, mealType: MealType) =>
    mealOuts?.find(
      (out) => format(new Date(out.date), 'yyyy-MM-dd') === dateStr && out.mealType === mealType
    );

  const initDraft = (dateStr: string) => {
    const baseSlots = {
      pranzo: { primo: '', secondo: '', contorno: '' } as Record<DishCategory, string>,
      cena: { primo: '', secondo: '', contorno: '' } as Record<DishCategory, string>,
    };
    (['pranzo', 'cena'] as MealType[]).forEach((mealType) => {
      (['primo', 'secondo', 'contorno'] as DishCategory[]).forEach((slot) => {
        const meal = getMealBySlot(dateStr, mealType, slot);
        if (meal) {
          baseSlots[mealType][slot] = meal.dishId;
        }
      });
    });
    setDraftSlots(baseSlots);
    setDraftOut({
      pranzo: Boolean(getMealOut(dateStr, 'pranzo')),
      cena: Boolean(getMealOut(dateStr, 'cena')),
    });
    setDraftBackup({ pranzo: null, cena: null });
  };

  const handleDraftSlotChange = (
    mealType: MealType,
    slotCategory: DishCategory,
    dishId: string
  ) => {
    setDraftSlots((prev) => ({
      ...prev,
      [mealType]: { ...prev[mealType], [slotCategory]: dishId },
    }));
  };

  const handleToggleOutDraft = (mealType: MealType, enabled: boolean) => {
    if (enabled) {
      setDraftBackup((prev) => ({
        ...prev,
        [mealType]: { ...draftSlots[mealType] },
      }));
      setDraftSlots((prev) => ({
        ...prev,
        [mealType]: { primo: '', secondo: '', contorno: '' },
      }));
      setDraftOut((prev) => ({ ...prev, [mealType]: true }));
      return;
    }
    setDraftOut((prev) => ({ ...prev, [mealType]: false }));
    if (draftBackup[mealType]) {
      setDraftSlots((prev) => ({
        ...prev,
        [mealType]: { ...(draftBackup[mealType] as Record<DishCategory, string>) },
      }));
    }
  };

  const draftSaveNeedsAuthCode = () => {
    if (!selectedDateStr) return false;
    for (const mealType of ['pranzo', 'cena'] as MealType[]) {
      const hasOut = Boolean(getMealOut(selectedDateStr, mealType));
      if (draftOut[mealType] !== hasOut) return true;
      if (draftOut[mealType]) continue;
      for (const slotCategory of slotCategories) {
        const existing = getMealBySlot(selectedDateStr, mealType, slotCategory);
        const draftDishId = draftSlots[mealType][slotCategory];
        if (!draftDishId && existing) return true;
      }
    }
    return false;
  };

  const saveDraftWithAuthCode = async (authCode?: string) => {
    if (!selectedDateStr) return;
    setSavingDraft(true);
    setError('');
    try {
      for (const mealType of ['pranzo', 'cena'] as MealType[]) {
        const hasOut = Boolean(getMealOut(selectedDateStr, mealType));
        if (draftOut[mealType] && !hasOut) {
          if (!authCode) throw new Error('Codice di autenticazione richiesto');
          await mealsApi.setOut({ date: selectedDateStr, mealType }, authCode);
        } else if (!draftOut[mealType] && hasOut) {
          if (!authCode) throw new Error('Codice di autenticazione richiesto');
          await mealsApi.removeOut({ date: selectedDateStr, mealType }, authCode);
        }

        if (draftOut[mealType]) continue;

        for (const slotCategory of slotCategories) {
          const existing = getMealBySlot(selectedDateStr, mealType, slotCategory);
          const draftDishId = draftSlots[mealType][slotCategory];
          if (!draftDishId && existing) {
            if (!authCode) throw new Error('Codice di autenticazione richiesto');
            await mealsApi.delete(existing.id, authCode);
            continue;
          }
          if (draftDishId && !existing) {
            await mealsApi.create({
              date: selectedDateStr,
              mealType,
              slotCategory,
              dishId: draftDishId,
            });
            continue;
          }
          if (draftDishId && existing && existing.dishId !== draftDishId) {
            await mealsApi.update(existing.id, { dishId: draftDishId });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'Impossibile salvare le modifiche');
    } finally {
      setSavingDraft(false);
    }
  };

  const pasteClearAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClearAuthCode((text || '').trim().toUpperCase().slice(0, 5));
    } catch (error) {
      console.error('Failed to paste auth code:', error);
    }
  };

  const pasteClearRangeAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClearRangeAuthCode((text || '').trim().toUpperCase().slice(0, 5));
    } catch (error) {
      console.error('Failed to paste auth code:', error);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedDateStr) return;
    if (draftSaveNeedsAuthCode()) {
      setPendingDraftSave(true);
      return;
    }
    await saveDraftWithAuthCode();
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'primo':
        return 'badge-primo';
      case 'secondo':
        return 'badge-secondo';
      case 'contorno':
        return 'badge-contorno';
      default:
        return 'bg-secondary';
    }
  };

  const slotCategories: DishCategory[] = ['primo', 'secondo', 'contorno'];
  const dishesByCategory = useMemo(() => {
    return {
      primo: dishes?.filter((dish) => dish.category === 'primo') ?? [],
      secondo: dishes?.filter((dish) => dish.category === 'secondo') ?? [],
      contorno: dishes?.filter((dish) => dish.category === 'contorno') ?? [],
    };
  }, [dishes]);

  const getMealBySlot = (dateStr: string, mealType: MealType, slotCategory: DishCategory) => {
    return meals?.find(
      (meal) =>
        toDateOnly(meal.date) === dateStr &&
        meal.mealType === mealType &&
        meal.slotCategory === slotCategory
    );
  };

  const eventContent = (eventInfo: any) => {
    const { mealType, slotCategory, dish, isOut } = eventInfo.event.extendedProps;
    return (
      <div className="p-1 d-flex align-items-center justify-content-between gap-2">
        <small className="d-block text-truncate">
          {isOut
            ? `${mealType === 'pranzo' ? '🌞' : '🌙'} ${eventInfo.event.title}`
            : `${mealType === 'pranzo' ? '🌞' : '🌙'} ${slotCategory}: ${dish?.name || eventInfo.event.title}`}
        </small>
        <button
          type="button"
          className="calendar-event-delete"
          onClick={(e) => {
            e.stopPropagation();
            if (isOut) {
              const dateStr = eventInfo.event.start
                ? format(eventInfo.event.start, 'yyyy-MM-dd')
                : String(eventInfo.event.startStr || '');
              setPendingOutDelete({
                date: dateStr,
                mealType,
              });
            } else {
              handleDeleteMeal(eventInfo.event.id);
            }
          }}
          aria-label="Rimuovi"
        >
          ×
        </button>
      </div>
    );
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const exportMealsByDate = useMemo(() => {
    const map = new Map<string, MealPlan[]>();
    (exportMeals ?? []).forEach((meal) => {
      const key = toDateOnly(meal.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(meal);
    });
    return map;
  }, [exportMeals, toDateOnly]);

  const exportDays = useMemo(() => {
    if (!exportRange) return [];
    const start = startOfWeek(exportRange.start, { weekStartsOn: 1 });
    const end = endOfWeek(exportRange.end, { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      days.push(d);
    }
    return days;
  }, [exportRange]);

  const renderExportMealLine = (dateKey: string, mealType: MealType) => {
    const slotOrder: DishCategory[] = ['primo', 'secondo', 'contorno'];
    const dailyMeals = exportMealsByDate.get(dateKey) ?? [];
    const parts = slotOrder.map((slot) => {
      const found = dailyMeals.find(
        (meal) => meal.mealType === mealType && meal.slotCategory === slot
      );
      return found?.dish?.name ?? '—';
    });
    return parts.map(escapeHtml).join(' · ');
  };

  const waitForNextPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const handleExportPdf = async () => {
    try {
      setExportError(null);
      const anchor = calendarRef.current?.getApi().getDate() ?? currentMonthAnchor;
      const monthStart = startOfMonth(anchor);
      const monthEnd = endOfMonth(anchor);
      const monthMeals = await mealsApi.getRange(
        format(monthStart, 'yyyy-MM-dd'),
        format(monthEnd, 'yyyy-MM-dd')
      );

      setExportRange({ start: monthStart, end: monthEnd });
      setExportMeals(monthMeals);

      await waitForNextPaint();
      await waitForNextPaint();

      if (!exportRef.current) return;

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      const imgWidth = imgProps.width * ratio;
      const imgHeight = imgProps.height * ratio;
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`family_planner_calendario_${format(monthStart, 'yyyyMM')}.pdf`);
    } catch (err: any) {
      setExportError(err?.message || 'Impossibile esportare il PDF');
    }
  };

  return (
    <DashboardLayout>
      <StatusModal
        show={Boolean(exportError)}
        variant="danger"
        message={exportError || ''}
        onClose={() => setExportError(null)}
      />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h2 className="page-title mb-0">Calendario Pasti</h2>
          {mealsFetching && !mealsLoading && (
            <Spinner animation="border" size="sm" className="text-light" />
          )}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-primary" className="btn-primary-soft" onClick={handleExportPdf}>
            <FaFilePdf className="me-2" /> Esporta PDF
          </Button>
          <Button variant="primary" className="btn-danger-soft" onClick={() => setShowClearRangeModal(true)}>
            Svuota Intervallo
          </Button>
          <Button variant="primary" className="btn-danger-soft" onClick={() => setShowClearModal(true)}>
            Svuota Calendario
          </Button>
        </div>
      </div>

      <Card className="calendar-card">
        <Card.Body>
          <div className="calendar-shell position-relative">
            {mealsLoading && !meals && (
              <div className="calendar-loading">
                <Spinner animation="border" variant="success" />
              </div>
            )}
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="it"
              firstDay={1}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek',
              }}
              buttonText={{ today: 'Oggi' }}
              events={calendarEvents}
              eventOrder="startTime"
              dateClick={handleDateClick}
              eventContent={eventContent}
              height="auto"
              datesSet={(dateInfo) => {
                const start = format(dateInfo.start, 'yyyy-MM-dd');
                const end = format(subDays(dateInfo.end, 1), 'yyyy-MM-dd');
                setVisibleRange({ start, end });
                setCurrentMonthAnchor(dateInfo.view?.currentStart ?? dateInfo.start);
              }}
              eventClick={(info) => {
                if (info.event.extendedProps?.isOut) {
                  const dateStr = info.event.start
                    ? format(info.event.start, 'yyyy-MM-dd')
                    : String(info.event.startStr || '');
                  setSelectedDateStr(dateStr);
                  setSelectedDate(toLocalDateFromDateOnly(dateStr));
                  setError('');
                  initDraft(dateStr);
                  setShowModal(true);
                  return;
                }
                const meal = meals?.find((m) => m.id === info.event.id);
                if (meal) {
                  const dateStr = toDateOnly(meal.date);
                  setSelectedDateStr(dateStr);
                  setSelectedDate(toLocalDateFromDateOnly(dateStr));
                  setError('');
                  initDraft(dateStr);
                  setShowModal(true);
                }
              }}
            />
          </div>
        </Card.Body>
      </Card>

      <div className="calendar-export-wrapper" aria-hidden="true">
        <div ref={exportRef} className="calendar-export">
          {exportRange && (
            <>
              <div className="calendar-export-header">
                <div className="calendar-export-title">Calendario Pasti</div>
                <div className="calendar-export-subtitle">
                  {format(exportRange.start, 'MMMM yyyy', { locale: it })}
                </div>
              </div>
              <div className="calendar-export-grid">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
                  <div key={day} className="calendar-export-head">
                    {day}
                  </div>
                ))}
                {exportDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const outside =
                    format(day, 'yyyy-MM') !== format(exportRange.start, 'yyyy-MM');
                  return (
                    <div
                      key={dateKey}
                      className={`calendar-export-cell ${outside ? 'is-outside' : ''}`}
                    >
                      <div className="calendar-export-date">
                        {format(day, 'd', { locale: it })}
                      </div>
                      <div className="calendar-export-line">
                        <span className="calendar-export-label">Pranzo:</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: renderExportMealLine(dateKey, 'pranzo'),
                          }}
                        />
                      </div>
                      <div className="calendar-export-line">
                        <span className="calendar-export-label">Cena:</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: renderExportMealLine(dateKey, 'cena'),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
        <Row>
          <Col md={12}>
            <StatusModal
              show={Boolean(error)}
              variant="danger"
              message={error}
              onClose={() => setError('')}
            />
            {selectedDateStr && (
              <div className="d-flex flex-column gap-3">
                {(['pranzo', 'cena'] as MealType[]).map((mealType) => (
                  <Card key={mealType} className="meal-plan-card">
                    <Card.Body>
                      <Card.Title className="mb-3">
                        {mealType === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'}
                      </Card.Title>
                      <div className="d-flex flex-column gap-3">
                        {selectedDateStr && draftOut[mealType] && (
                          <div className="text-muted small">
                            {mealType === 'pranzo' ? 'Pranzo fuori impostato.' : 'Cena fuori impostata.'}
                          </div>
                        )}
                        {slotCategories.map((slot) => {
                          const isOut = draftOut[mealType];
                          return (
                            <div
                              key={`${mealType}-${slot}`}
                              className="d-flex align-items-center gap-3"
                            >
                              <span className="meal-slot-label">
                                <Badge className={getCategoryBadgeClass(slot)}>{slot}</Badge>
                              </span>
                              <Form.Select
                                value={draftSlots[mealType][slot]}
                                onChange={(e) =>
                                  handleDraftSlotChange(mealType, slot, e.target.value)
                                }
                                disabled={isOut}
                              >
                                <option value="">Seleziona {slot}...</option>
                                {dishesByCategory[slot].map((dish) => (
                                  <option key={dish.id} value={dish.id}>
                                    {dish.name}
                                  </option>
                                ))}
                              </Form.Select>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                className="btn-danger-soft"
                                onClick={() => handleDraftSlotChange(mealType, slot, '')}
                                disabled={!draftSlots[mealType][slot] || isOut}
                              >
                                Rimuovi
                              </Button>
                            </div>
                          );
                        })}
                        <div className="d-flex justify-content-end">
                          {selectedDateStr && draftOut[mealType] ? (
                            <Button
                              size="sm"
                              variant="danger"
                              className="btn-danger-soft"
                              onClick={() => handleToggleOutDraft(mealType, false)}
                            >
                              Annulla {mealType === 'pranzo' ? 'Pranzo fuori' : 'Cena fuori'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="info"
                              className="btn-info-soft"
                              onClick={() => handleToggleOutDraft(mealType, true)}
                            >
                              {mealType === 'pranzo' ? 'Pranzo fuori' : 'Cena fuori'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline-danger"
          className="btn-danger-soft"
          onClick={handleCloseModal}
          disabled={savingDraft}
        >
          Annulla
        </Button>
        <Button variant="primary" onClick={handleSaveDraft} disabled={savingDraft}>
          {savingDraft ? <Spinner size="sm" animation="border" /> : 'Ok'}
        </Button>
      </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingDeleteId)}
        message="Rimuovere questo piatto dalla pianificazione?"
        onCancel={() => setPendingDeleteId(null)}
        requireAuthCode
        onConfirm={(authCode) => {
          if (pendingDeleteId) {
            deleteMutation.mutate({ id: pendingDeleteId, authCode: authCode || '' });
          }
          setPendingDeleteId(null);
        }}
      />

      <ConfirmModal
        show={Boolean(pendingOutDelete)}
        message="Annullare il pasto fuori?"
        onCancel={() => setPendingOutDelete(null)}
        requireAuthCode
        onConfirm={(authCode) => {
          if (pendingOutDelete) {
            removeOutMutation.mutate({
              ...pendingOutDelete,
              authCode: authCode || '',
            });
          }
          setPendingOutDelete(null);
        }}
      />

      <ConfirmModal
        show={pendingDraftSave}
        message="Confermare le modifiche? (Sono presenti cancellazioni/svuotamenti)"
        onCancel={() => setPendingDraftSave(false)}
        requireAuthCode
        onConfirm={(authCode) => {
          setPendingDraftSave(false);
          saveDraftWithAuthCode(authCode || '');
        }}
      />

      <Modal
        show={showClearModal}
        onHide={() => setShowClearModal(false)}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Svuota Calendario</Modal.Title>
        </Modal.Header>
      <Modal.Body>
        Questa azione rimuove tutti i pasti dal calendario. Vuoi continuare?
        <Form.Group className="mt-3" controlId="clearCalendarAuthCode">
          <Form.Label>Codice di autenticazione</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              value={clearAuthCode}
              onChange={(e) => setClearAuthCode(e.target.value)}
              placeholder="es: A1B2C"
              maxLength={5}
            />
            <Button
              type="button"
              variant="outline-primary"
              className="btn-primary-soft"
              onClick={pasteClearAuthCode}
              title="Incolla codice"
            >
              <FaPaste />
            </Button>
          </InputGroup>
          <Form.Text className="text-muted">
            Inserisci il codice a 5 caratteri per confermare.
          </Form.Text>
        </Form.Group>
      </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => setShowClearModal(false)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            className="btn-danger-soft"
            disabled={clearAllMutation.isPending || !/^[A-Z0-9]{5}$/.test(clearAuthCode.trim().toUpperCase())}
            onClick={() => {
              clearAllMutation.mutate({ authCode: clearAuthCode.trim().toUpperCase() });
              setShowClearModal(false);
              setClearAuthCode('');
            }}
          >
            {clearAllMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Svuota'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showClearRangeModal}
        onHide={() => setShowClearRangeModal(false)}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Svuota Intervallo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">
            Seleziona un intervallo per rimuovere i pasti pianificati.
          </p>
          <Form>
            {clearRanges.map((range) => (
              <Form.Check
                key={range.value}
                type="radio"
                id={`clear-${range.value}`}
                name="clearRange"
                label={range.label}
                value={range.value}
                checked={clearRange === range.value}
                onChange={(e) => setClearRange(e.target.value)}
                className="mb-2"
              />
            ))}
          </Form>
          <Form.Group className="mt-3" controlId="clearRangeAuthCode">
            <Form.Label>Codice di autenticazione</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                value={clearRangeAuthCode}
                onChange={(e) => setClearRangeAuthCode(e.target.value)}
                placeholder="es: A1B2C"
                maxLength={5}
              />
              <Button
                type="button"
                variant="outline-primary"
                className="btn-primary-soft"
                onClick={pasteClearRangeAuthCode}
                title="Incolla codice"
              >
                <FaPaste />
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              Inserisci il codice a 5 caratteri per confermare.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => setShowClearRangeModal(false)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            className="btn-danger-soft"
            disabled={clearRangeMutation.isPending || !/^[A-Z0-9]{5}$/.test(clearRangeAuthCode.trim().toUpperCase())}
            onClick={() => {
              clearRangeMutation.mutate({
                rangeType: clearRange,
                authCode: clearRangeAuthCode.trim().toUpperCase(),
              });
              setShowClearRangeModal(false);
              setClearRangeAuthCode('');
            }}
          >
            {clearRangeMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Svuota'}
          </Button>
        </Modal.Footer>
      </Modal>
    </DashboardLayout>
  );
}
