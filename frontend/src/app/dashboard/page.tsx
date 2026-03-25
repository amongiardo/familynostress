'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Row, Col, Card, Button, Badge, ListGroup, Spinner, Form, Modal } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, addWeeks, subWeeks, differenceInCalendarDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaPlus, FaLightbulb } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, suggestionsApi, dishesApi, familyApi, weatherApi, shoppingApi } from '@/lib/api';
import { DishCategory, MealPlan, MealType, MealOut } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();
  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: familyApi.get,
    enabled: Boolean(user?.activeFamilyId),
  });
  const city = family?.cityDisplayName || family?.city || 'Roma';
  const { data: weather } = useQuery({
    queryKey: [
      'weather',
      family?.id,
      family?.city,
      family?.cityDisplayName,
      family?.cityLatitude,
      family?.cityLongitude,
      family?.cityTimezone,
    ],
    queryFn: () => weatherApi.get(),
    enabled: Boolean(user?.activeFamilyId),
  });
  const initialWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const initialDayIndex = Math.min(
    Math.max(differenceInCalendarDays(today, initialWeekStart), 0),
    6
  );
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [selectedDayIndex, setSelectedDayIndex] = useState(initialDayIndex);
  const rangeStart = format(weekStart, 'yyyy-MM-dd');
  const rangeEnd = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const touchStart = useRef<number | null>(null);

  const [error, setError] = useState('');
  const [showDishModal, setShowDishModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategory, setNewDishCategory] = useState<DishCategory>('primo');
  const [newDishIngredients, setNewDishIngredients] = useState('');
  const [shoppingItem, setShoppingItem] = useState('');
  const [shoppingQty, setShoppingQty] = useState('');
  const [pendingMealDelete, setPendingMealDelete] = useState<{ id: string; message: string } | null>(null);

  const { data: meals, isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', 'range', rangeStart, rangeEnd],
    queryFn: () => mealsApi.getRange(rangeStart, rangeEnd),
    enabled: Boolean(user?.activeFamilyId),
  });

  const { data: mealOuts } = useQuery({
    queryKey: ['mealOuts', rangeStart, rangeEnd],
    queryFn: () => mealsApi.getOutRange(rangeStart, rangeEnd),
    enabled: Boolean(user?.activeFamilyId),
  });


  const suggestionDate = format(today, 'yyyy-MM-dd');
  const suggestionQueries = {
    pranzo: {
      primo: useQuery({
        queryKey: ['suggestions', suggestionDate, 'pranzo', 'primo'],
        queryFn: () => suggestionsApi.get(suggestionDate, 'pranzo', 'primo'),
        enabled: Boolean(user?.activeFamilyId),
      }),
      secondo: useQuery({
        queryKey: ['suggestions', suggestionDate, 'pranzo', 'secondo'],
        queryFn: () => suggestionsApi.get(suggestionDate, 'pranzo', 'secondo'),
        enabled: Boolean(user?.activeFamilyId),
      }),
      contorno: useQuery({
        queryKey: ['suggestions', suggestionDate, 'pranzo', 'contorno'],
        queryFn: () => suggestionsApi.get(suggestionDate, 'pranzo', 'contorno'),
        enabled: Boolean(user?.activeFamilyId),
      }),
    },
    cena: {
      primo: useQuery({
        queryKey: ['suggestions', suggestionDate, 'cena', 'primo'],
        queryFn: () => suggestionsApi.get(suggestionDate, 'cena', 'primo'),
        enabled: Boolean(user?.activeFamilyId),
      }),
      secondo: useQuery({
        queryKey: ['suggestions', suggestionDate, 'cena', 'secondo'],
        queryFn: () => suggestionsApi.get(suggestionDate, 'cena', 'secondo'),
        enabled: Boolean(user?.activeFamilyId),
      }),
      contorno: useQuery({
        queryKey: ['suggestions', suggestionDate, 'cena', 'contorno'],
        queryFn: () => suggestionsApi.get(suggestionDate, 'cena', 'contorno'),
        enabled: Boolean(user?.activeFamilyId),
      }),
    },
  };

  const days = useMemo(
    () =>
      [...Array(7)].map((_, i) => {
        const day = addDays(weekStart, i);
        return {
          date: day,
          short: format(day, 'EE', { locale: it }).toUpperCase(),
          number: format(day, 'd'),
        };
      }),
    [weekStart]
  );

  const getMealsByDayAndType = (dayOffset: number, mealType: MealType) => {
    const day = addDays(weekStart, dayOffset);
    return meals?.filter(
      (meal) =>
        format(new Date(meal.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
        meal.mealType === mealType
    );
  };

  const getMealBySlot = (dayOffset: number, mealType: MealType, slotCategory: DishCategory) => {
    const day = addDays(weekStart, dayOffset);
    return meals?.find(
      (meal) =>
        format(new Date(meal.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
        meal.mealType === mealType &&
        meal.slotCategory === slotCategory
    );
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

  const { data: dishes } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => dishesApi.list(),
    enabled: Boolean(user?.activeFamilyId),
  });

  useEffect(() => {
    if (!authLoading && user && !user.activeFamilyId) {
      router.replace('/impostazioni');
    }
  }, [authLoading, user, router]);

  const dishesByCategory = useMemo(() => {
    return {
      primo: dishes?.filter((dish) => dish.category === 'primo') ?? [],
      secondo: dishes?.filter((dish) => dish.category === 'secondo') ?? [],
      contorno: dishes?.filter((dish) => dish.category === 'contorno') ?? [],
    };
  }, [dishes]);

  const createMutation = useMutation({
    mutationFn: mealsApi.create,
    onSuccess: (meal) => {
      const cachedMeals = queryClient.getQueryData<MealPlan[]>([
        'meals',
        'range',
        rangeStart,
        rangeEnd,
      ]);
      const alreadyPlanned = cachedMeals?.some((existing) => existing.id === meal.id);

      if (alreadyPlanned) {
        setError('Piatto già pianificato per questa data e pasto');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const createDishMutation = useMutation({
    mutationFn: dishesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      setShowDishModal(false);
      setNewDishName('');
      setNewDishIngredients('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const addShoppingMutation = useMutation({
    mutationFn: () =>
      shoppingApi.addItem({
        week: rangeStart,
        ingredient: shoppingItem,
        quantity: shoppingQty || undefined,
      }),
    onSuccess: () => {
      setShowShoppingModal(false);
      setShoppingItem('');
      setShoppingQty('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof mealsApi.update>[1] }) =>
      mealsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: ({ id, authCode }: { id: string; authCode: string }) => mealsApi.delete(id, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });

  const setOutMutation = useMutation({
    mutationFn: ({ date, mealType }: { date: string; mealType: MealType }) =>
      mealsApi.setOut({ date, mealType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const removeOutMutation = useMutation({
    mutationFn: ({ date, mealType }: { date: string; mealType: MealType }) =>
      mealsApi.removeOut({ date, mealType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const getMealOut = (dateStr: string, mealType: MealType) =>
    mealOuts?.find(
      (out) => format(new Date(out.date), 'yyyy-MM-dd') === dateStr && out.mealType === mealType
    );

  const handleSlotChange = (
    mealType: MealType,
    slotCategory: DishCategory,
    dishId: string
  ) => {
    const dateStr = format(addDays(weekStart, selectedDayIndex), 'yyyy-MM-dd');
    const existing = getMealBySlot(selectedDayIndex, mealType, slotCategory);

    if (!dishId) {
      if (existing) {
        setPendingMealDelete({
          id: existing.id,
          message: `Rimuovere ${mealType} · ${slotCategory} dalla pianificazione?`,
        });
      }
      return;
    }

    if (existing) {
      if (existing.dishId !== dishId) {
        updateMutation.mutate({ id: existing.id, data: { dishId } });
      }
      return;
    }

    createMutation.mutate({
      date: dateStr,
      mealType,
      slotCategory,
      dishId,
    });
  };

  const handlePrevWeek = () => {
    setWeekStart((prev) => subWeeks(prev, 1));
    setSelectedDayIndex(0);
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => addWeeks(prev, 1));
    setSelectedDayIndex(0);
  };

  const handleThisWeek = () => {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const index = Math.min(Math.max(differenceInCalendarDays(today, start), 0), 6);
    setWeekStart(start);
    setSelectedDayIndex(index);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNextWeek();
      if (diff < 0) handlePrevWeek();
    }
    touchStart.current = null;
  };

  if (authLoading || (user && !user.activeFamilyId)) {
    return (
      <DashboardLayout>
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">👋 Benvenuto!</p>
          <h1 className="dashboard-title">Family Planner 🍽️</h1>
          <p className="dashboard-date">
            {format(today, 'EEEE d MMMM yyyy', { locale: it })} · {city}
            {weather?.temperature !== undefined && weather?.description
              ? ` · ${Math.round(weather.temperature)}°C ${weather.description}`
              : weather?.temperature !== undefined
                ? ` · ${Math.round(weather.temperature)}°C`
                : ''}
          </p>
        </div>
        <div className="dashboard-avatar">👨‍👩‍👧</div>
      </div>

      <div className="week-strip mb-3">
        <Button variant="outline-primary" size="sm" className="week-nav-btn" onClick={handleThisWeek}>
          Oggi
        </Button>
        {[-1, 0, 1].map((offset) => {
          const base = addWeeks(weekStart, offset);
          const label = `${format(base, 'd MMM', { locale: it })}–${format(
            addDays(base, 6),
            'd MMM',
            { locale: it }
          )}`;
          const isActive = offset === 0;
          return (
            <button
              key={label}
              className={`week-pill ${isActive ? 'active' : ''}`}
              onClick={() => {
                setWeekStart(base);
                setSelectedDayIndex(0);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Row className="g-4 align-items-start mb-3">
        <Col lg={8}>
          <div className="day-strip" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {days.map((day, i) => {
              const pranzo = getMealsByDayAndType(i, 'pranzo')?.length;
              const cena = getMealsByDayAndType(i, 'cena')?.length;
              const isActive = i === selectedDayIndex;
              const isToday = format(day.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
              return (
                <button
                  key={day.number}
                  className={`day-pill ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelectedDayIndex(i)}
                >
                  <span className="day-pill-short">{day.short}</span>
                  <span className="day-pill-number">{day.number}</span>
                  <div className="day-pill-dots">
                    <span className={`day-pill-dot ${pranzo ? 'filled lunch' : ''}`} />
                    <span className={`day-pill-dot ${cena ? 'filled dinner' : ''}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </Col>
        <Col lg={4}>
          <Card className="quick-actions-card">
            <Card.Header>Azioni rapide</Card.Header>
            <Card.Body>
              <Button
                variant="outline-primary"
                className="btn-primary-soft"
                onClick={() => setShowDishModal(true)}
              >
                <FaPlus className="me-1" /> Aggiungi Piatto
              </Button>
              <Button
                variant="outline-primary"
                className="btn-primary-soft"
                onClick={() => setShowShoppingModal(true)}
              >
                <FaPlus className="me-1" /> Aggiungi a Lista Spesa
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {mealsLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      ) : (
        <Row className="g-4">
          <Col lg={8}>
            <div className="meal-section">
              {(['pranzo', 'cena'] as MealType[]).map((mealType) => {
                const selectedDateStr = format(addDays(weekStart, selectedDayIndex), 'yyyy-MM-dd');
                const isOut = Boolean(getMealOut(selectedDateStr, mealType));
                return (
                  <Card
                    key={mealType}
                    className={`meal-bubble-card ${mealType === 'pranzo' ? 'meal-bubble-lunch' : 'meal-bubble-dinner'} mb-3`}
                  >
                    <Card.Body>
                      <div className="meal-bubble-header">
                        <div className="d-flex align-items-center gap-2">
                          <span className="meal-bubble-label">
                            {mealType === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'} di{' '}
                            {format(days[selectedDayIndex]?.date ?? today, 'EEEE d MMMM yyyy', { locale: it })}
                          </span>
                        </div>
                      </div>
                      <div className="d-flex flex-column gap-3">
                        {isOut && (
                          <div className="text-muted small">
                            {mealType === 'pranzo' ? 'Pranzo fuori impostato.' : 'Cena fuori impostata.'}
                          </div>
                        )}
                        {slotCategories.map((slot) => {
                          const meal = getMealBySlot(selectedDayIndex, mealType, slot);
                          return (
                            <div key={`${mealType}-${slot}`} className="d-flex align-items-center gap-3">
                              <span className="meal-slot-label">
                                <Badge className={getCategoryBadgeClass(slot)}>{slot}</Badge>
                              </span>
                              <Form.Select
                                value={meal?.dishId || ''}
                                onChange={(e) => handleSlotChange(mealType, slot, e.target.value)}
                                disabled={isOut}
                              >
                                <option value="">Seleziona {slot}...</option>
                                {dishesByCategory[slot].map((dish) => (
                                  <option key={dish.id} value={dish.id}>
                                    {dish.name}
                                  </option>
                                ))}
                              </Form.Select>
                            </div>
                          );
                        })}
                        <div className="d-flex justify-content-end">
                          {isOut ? (
                            <Button
                              size="sm"
                              variant="danger"
                              className="btn-danger-soft"
                              onClick={() => removeOutMutation.mutate({ date: selectedDateStr, mealType })}
                              disabled={removeOutMutation.isPending || setOutMutation.isPending}
                            >
                              Annulla {mealType === 'pranzo' ? 'Pranzo fuori' : 'Cena fuori'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="info"
                              className="btn-info-soft"
                              onClick={() => setOutMutation.mutate({ date: selectedDateStr, mealType })}
                              disabled={removeOutMutation.isPending || setOutMutation.isPending}
                            >
                              {mealType === 'pranzo' ? 'Pranzo fuori' : 'Cena fuori'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          </Col>

          <Col lg={4}>
            <Card className="mb-4">
              <Card.Header className="d-flex align-items-center gap-2">
                <FaLightbulb /> Suggerimenti per Oggi
              </Card.Header>
              <Card.Body>
                {(['pranzo', 'cena'] as MealType[]).map((mealType) => (
                  <div key={mealType} className="mb-3">
                    <h6 className="text-muted">{mealType === 'pranzo' ? 'Pranzo' : 'Cena'}</h6>
                    <ListGroup variant="flush">
                      {slotCategories.map((slot) => {
                        const data = suggestionQueries[mealType][slot].data;
                        return (
                          <ListGroup.Item
                            key={`${mealType}-${slot}`}
                            className="d-flex justify-content-between align-items-center px-0"
                          >
                            <div>
                              <Badge className={`${getCategoryBadgeClass(slot)} me-2`}>
                                {slot}
                              </Badge>
                              {data && data.length > 0 ? data[0].dish.name : '—'}
                            </div>
                          </ListGroup.Item>
                        );
                      })}
                    </ListGroup>
                  </div>
                ))}
              </Card.Body>
            </Card>

            <div />
          </Col>
        </Row>
      )}

      <Modal show={showDishModal} onHide={() => setShowDishModal(false)} centered dialogClassName="app-modal">
        <Modal.Header closeButton>
          <Modal.Title>Nuovo Piatto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control value={newDishName} onChange={(e) => setNewDishName(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Categoria</Form.Label>
              <Form.Select
                value={newDishCategory}
                onChange={(e) => setNewDishCategory(e.target.value as DishCategory)}
              >
                <option value="primo">Primo</option>
                <option value="secondo">Secondo</option>
                <option value="contorno">Contorno</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Ingredienti (separati da ;)</Form.Label>
              <Form.Control
                value={newDishIngredients}
                onChange={(e) => setNewDishIngredients(e.target.value)}
                className="placeholder-soft"
                placeholder="es: pasta;pomodoro;olio"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => setShowDishModal(false)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={!newDishName.trim() || createDishMutation.isPending}
            onClick={() => {
              const ingredients = newDishIngredients
                .split(';')
                .map((i) => i.trim())
                .filter(Boolean);
              createDishMutation.mutate({
                name: newDishName.trim(),
                category: newDishCategory,
                ingredients,
              });
            }}
          >
            {createDishMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Salva'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showShoppingModal} onHide={() => setShowShoppingModal(false)} centered dialogClassName="app-modal">
        <Modal.Header closeButton>
          <Modal.Title>Aggiungi a Lista Spesa</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Ingrediente</Form.Label>
              <Form.Control value={shoppingItem} onChange={(e) => setShoppingItem(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Quantità (opzionale)</Form.Label>
              <Form.Control value={shoppingQty} onChange={(e) => setShoppingQty(e.target.value)} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => setShowShoppingModal(false)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={!shoppingItem.trim() || addShoppingMutation.isPending}
            onClick={() => addShoppingMutation.mutate()}
          >
            {addShoppingMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Aggiungi'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingMealDelete)}
        message={pendingMealDelete?.message || 'Rimuovere questo pasto?'}
        onCancel={() => setPendingMealDelete(null)}
        requireAuthCode
        onConfirm={(authCode) => {
          if (pendingMealDelete) {
            deleteMealMutation.mutate({ id: pendingMealDelete.id, authCode: authCode || '' });
          }
          setPendingMealDelete(null);
        }}
      />

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />
    </DashboardLayout>
  );
}
