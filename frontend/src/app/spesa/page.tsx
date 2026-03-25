'use client';

import { useMemo, useState } from 'react';
import { Card, Button, Form, ListGroup, Spinner, Row, Col, Accordion, Badge } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addWeeks, subWeeks, addDays, endOfMonth, startOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaChevronLeft, FaChevronRight, FaCheck, FaShoppingCart, FaPlus, FaTrash } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { mealsApi, shoppingApi } from '@/lib/api';
import { ShoppingListItem } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';

export default function SpesaPage() {
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dismissError, setDismissError] = useState(false);
  const [ingredient, setIngredient] = useState('');
  const [quantity, setQuantity] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientSort, setIngredientSort] = useState<'az' | 'za' | 'day'>('az');
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showClearPurchasedModal, setShowClearPurchasedModal] = useState(false);
  const [showClearPendingModal, setShowClearPendingModal] = useState(false);
  const [pendingRemoveItemId, setPendingRemoveItemId] = useState<string | null>(null);
  const weekString = format(currentWeek, 'yyyy-MM-dd');

  const { data: shoppingList, isLoading, error } = useQuery({
    queryKey: ['shopping', weekString],
    queryFn: () => shoppingApi.get(weekString),
  });

  const [ingredientRange, setIngredientRange] = useState<'today' | 'week' | 'month'>('week');
  const rangeDates = useMemo(() => {
    const today = new Date();
    if (ingredientRange === 'today') {
      return { start: today, end: today };
    }
    if (ingredientRange === 'month') {
      return { start: today, end: endOfMonth(today) };
    }
    return { start: today, end: addDays(today, 6) };
  }, [ingredientRange]);

  const { data: rangeMeals } = useQuery({
    queryKey: ['meals', 'range', format(rangeDates.start, 'yyyy-MM-dd'), format(rangeDates.end, 'yyyy-MM-dd')],
    queryFn: () =>
      mealsApi.getRange(format(rangeDates.start, 'yyyy-MM-dd'), format(rangeDates.end, 'yyyy-MM-dd')),
  });

  const addItemMutation = useMutation({
    mutationFn: () =>
      shoppingApi.addItem({
        week: weekString,
        ingredient,
        quantity: quantity || undefined,
      }),
    onSuccess: () => {
      setIngredient('');
      setQuantity('');
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const addQuickItemMutation = useMutation({
    mutationFn: (ingredientName: string) =>
      shoppingApi.addItem({
        week: weekString,
        ingredient: ingredientName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const checkItemMutation = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      shoppingApi.checkItem(itemId, weekString, checked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: ({ itemId, authCode }: { itemId: string; authCode: string }) =>
      shoppingApi.removeItem(itemId, weekString, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const clearListMutation = useMutation({
    mutationFn: ({ authCode }: { authCode: string }) => shoppingApi.clear(weekString, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping', weekString] });
    },
  });

  const clearAllListsMutation = useMutation({
    mutationFn: ({ authCode }: { authCode: string }) => shoppingApi.clearAll(authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });


  const clearPurchasedMutation = useMutation({
    mutationFn: ({ authCode }: { authCode: string }) => shoppingApi.clearPurchased(authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });

  const clearPendingMutation = useMutation({
    mutationFn: ({ authCode }: { authCode: string }) => shoppingApi.clearPending(authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });

  const handlePrevWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleThisWeek = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const handleToggleItem = (item: ShoppingListItem) => {
    checkItemMutation.mutate({ itemId: item.id, checked: !item.checked });
  };

  const handleAddItem = () => {
    if (!ingredient.trim()) return;
    addItemMutation.mutate();
  };

  const items = shoppingList?.items || [];
  const pendingItems = items.filter((item) => !item.checked);
  const purchasedItems = items.filter((item) => item.checked);
  const shoppingLookup = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>();
    items.forEach((item) => {
      const key = item.ingredient.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [items]);

  const ingredientsByRange = (() => {
    const holder = {
      items: [] as {
        name: string;
        uses: { dishName: string; mealType: string; slotCategory: string; date: string }[];
      }[],
    };
    (rangeMeals || []).forEach((meal) => {
      meal.dish?.ingredients?.forEach((ingredientName) => {
        const key = ingredientName.trim();
        if (!key) return;
        let item = holder.items.find((entry) => entry.name === key);
        if (!item) {
          item = { name: key, uses: [] };
          holder.items.push(item);
        }
        item.uses.push({
          dishName: meal.dish?.name ?? '',
          mealType: meal.mealType,
          slotCategory: meal.slotCategory,
          date: meal.date,
        });
      });
    });

    const query = ingredientSearch.trim().toLowerCase();
    let items = holder.items.filter((item) =>
      !query ? true : item.name.toLowerCase().includes(query)
    );

    if (ingredientSort === 'az') {
      items = items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (ingredientSort === 'za') {
      items = items.sort((a, b) => b.name.localeCompare(a.name));
    } else if (ingredientSort === 'day') {
      const getMinDate = (entry: (typeof items)[number]) => {
        const dates = entry.uses.map((use) => new Date(use.date).getTime());
        return dates.length ? Math.min(...dates) : Number.MAX_SAFE_INTEGER;
      };
      items = items.sort((a, b) => {
        const aDate = getMinDate(a);
        const bDate = getMinDate(b);
        if (aDate !== bDate) return aDate - bDate;
        return a.name.localeCompare(b.name);
      });
    }
    return items;
  })();

  const formatMealType = (value: string) => (value === 'pranzo' ? 'Pranzo' : 'Cena');

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title">Lista della Spesa</h2>
        <div className="d-flex gap-2">
          <Button
            variant="primary"
            className="btn-primary"
            onClick={() => {
              const today = new Date();
              const monthStart = startOfMonth(today);
              const monthEnd = endOfMonth(today);
              queryClient.invalidateQueries({
                queryKey: [
                  'meals',
                  'range',
                  format(monthStart, 'yyyy-MM-dd'),
                  format(monthEnd, 'yyyy-MM-dd'),
                ],
              });
            }}
          >
            Aggiorna Ingredienti Mese
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Ingrediente</Form.Label>
                <Form.Control
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  className="placeholder-soft"
                  placeholder="es: Latte, pane, pomodori..."
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Quantità (opzionale)</Form.Label>
                <Form.Control
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="placeholder-soft"
                  placeholder="es: 2 kg, 3 pz"
                />
              </Form.Group>
            </Col>
            <Col md={2} className="d-grid">
              <Button variant="primary" onClick={handleAddItem} disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <>
                    <FaPlus className="me-1" /> Aggiungi
                  </>
                )}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col lg={6}>
          <Card>
            <Card.Header>Ingredienti</Card.Header>
            <Card.Body>
              <Form.Control
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                className="placeholder-soft mb-3"
                placeholder="es: cerca ingrediente..."
              />
              <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
                <Button
                  size="sm"
                  variant="outline-primary"
                  className={`btn-primary-soft ${ingredientRange === 'today' ? 'active' : ''}`}
                  onClick={() => setIngredientRange('today')}
                >
                  Oggi
                </Button>
                <Button
                  size="sm"
                  variant="outline-primary"
                  className={`btn-primary-soft ${ingredientRange === 'week' ? 'active' : ''}`}
                  onClick={() => setIngredientRange('week')}
                >
                  Questa settimana
                </Button>
                <Button
                  size="sm"
                  variant="outline-primary"
                  className={`btn-primary-soft ${ingredientRange === 'month' ? 'active' : ''}`}
                  onClick={() => setIngredientRange('month')}
                >
                  Questo mese
                </Button>
                <span className="ms-2">
                  <strong>
                    {ingredientRange === 'today'
                      ? format(new Date(), 'EEEE d MMMM yyyy', { locale: it })
                      : ingredientRange === 'week'
                        ? `${format(rangeDates.start, 'd MMM yyyy', { locale: it })} – ${format(
                            rangeDates.end,
                            'd MMM yyyy',
                            { locale: it }
                          )}`
                        : format(rangeDates.start, 'MMMM yyyy', { locale: it })}
                  </strong>
                </span>
                {ingredientRange !== 'today' && ingredientSort !== 'day' && (
                  <Form.Select
                    value={ingredientSort}
                    onChange={(e) =>
                      setIngredientSort(e.target.value as 'az' | 'za' | 'day')
                    }
                    size="sm"
                    className="ms-2 mt-2"
                  >
                    <option value="az">A-Z</option>
                    <option value="za">Z-A</option>
                    <option value="day">Giorno</option>
                  </Form.Select>
                )}
                {ingredientRange !== 'today' && ingredientSort === 'day' && (
                  <span className="ms-2 text-muted small">Ordine: Giorno</span>
                )}
              </div>

              {ingredientsByRange.length ? (
                <ListGroup variant="flush">
                  {ingredientsByRange.map((ingredientItem) => {
                    const related = shoppingLookup.get(ingredientItem.name.trim().toLowerCase()) || [];
                    const existingPending = related.find((item) => !item.checked);
                    return (
                    <ListGroup.Item
                      key={`${ingredientItem.name}`}
                      className="d-flex align-items-start justify-content-between gap-3"
                    >
                      <Accordion className="ingredient-accordion">
                        <Accordion.Item eventKey={`${ingredientItem.name}`}>
                          <Accordion.Header>{ingredientItem.name}</Accordion.Header>
                          <Accordion.Body>
                            <ul className="text-muted small mb-0 ps-3">
                              {ingredientItem.uses.map((use, idx) => (
                                <li key={`${ingredientItem.name}-${idx}`}>
                                  {format(new Date(use.date), 'd MMM', { locale: it })} · {formatMealType(
                                    use.mealType
                                  )} · {use.slotCategory} · {use.dishName}
                                </li>
                              ))}
                            </ul>
                          </Accordion.Body>
                        </Accordion.Item>
                      </Accordion>
                      {existingPending ? (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="btn-danger-soft"
                          onClick={() => setPendingRemoveItemId(existingPending.id)}
                          disabled={removeItemMutation.isPending}
                        >
                          Rimuovi
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          className="btn-primary"
                          onClick={() => addQuickItemMutation.mutate(ingredientItem.name)}
                          disabled={addQuickItemMutation.isPending}
                        >
                          Compra
                        </Button>
                      )}
                    </ListGroup.Item>
                  )})}
                </ListGroup>
              ) : (
                <p className="text-muted mb-0">Nessun ingrediente nel periodo selezionato.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          {isLoading ? (
            <Card>
              <Card.Body className="text-center py-5">
                <Spinner animation="border" variant="success" />
              </Card.Body>
            </Card>
          ) : error ? (
            <>
              <StatusModal
                show={!dismissError}
                variant="danger"
                message="Errore nel caricamento della lista"
                onClose={() => setDismissError(true)}
              />
              <Card>
                <Card.Body className="text-center py-5">
                  <p className="text-muted mb-0">Errore nel caricamento della lista</p>
                </Card.Body>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <Card.Header className="d-flex align-items-center justify-content-between">
                  <span>Ingredienti da comprare</span>
                  <Button
                    size="sm"
                    variant="primary"
                    className="btn-danger-soft"
                    onClick={() => setShowClearPendingModal(true)}
                    disabled={clearPendingMutation.isPending || pendingItems.length === 0}
                  >
                    Svuota
                  </Button>
                </Card.Header>
                {pendingItems.length > 0 ? (
                  <ListGroup variant="flush">
                    {pendingItems
                      .sort((a, b) => a.ingredient.localeCompare(b.ingredient))
                      .map((item) => (
                        <ListGroup.Item
                          key={item.id}
                          className={`shopping-item d-flex align-items-center gap-3 ${
                            item.checked ? 'checked' : ''
                          }`}
                        >
                          <Form.Check
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleItem(item)}
                            id={`item-${item.id}`}
                          />
                          <div className="flex-grow-1">
                            <div className={item.checked ? 'text-muted' : ''}>
                              {item.ingredient}
                              {item.quantity && (
                                <span className="text-muted ms-2">({item.quantity})</span>
                              )}
                            </div>
                            {item.dishNames.length > 0 && (
                              <small className="text-muted">
                                Per: {item.dishNames.join(', ')}
                              </small>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="primary"
                            className="btn-info-soft"
                            onClick={() => handleToggleItem(item)}
                          >
                            Comprato
                          </Button>
                        </ListGroup.Item>
                      ))}
                  </ListGroup>
                ) : (
                  <Card.Body className="text-center py-4">
                    <p className="text-muted mb-0">Nessun ingrediente da comprare.</p>
                  </Card.Body>
                )}
              </Card>
              <Card className="mt-4">
                <Card.Header className="d-flex align-items-center justify-content-between">
                  <span>Ingredienti comprati</span>
                  <Button
                    size="sm"
                    variant="primary"
                    className="btn-danger-soft"
                    onClick={() => setShowClearPurchasedModal(true)}
                    disabled={clearPurchasedMutation.isPending || purchasedItems.length === 0}
                  >
                    Svuota
                  </Button>
                </Card.Header>
                {purchasedItems.length > 0 ? (
                  <ListGroup variant="flush">
                    {purchasedItems.map((item) => (
                      <ListGroup.Item
                        key={item.id}
                        className="shopping-item d-flex align-items-center justify-content-between gap-3"
                      >
                        <div className="flex-grow-1">
                          <div>
                            {item.ingredient}
                            {item.quantity && (
                              <span className="text-muted ms-2">({item.quantity})</span>
                            )}
                          </div>
                          {item.purchasedAt && (
                            <small className="text-muted">
                              Comprato il {format(new Date(item.purchasedAt), 'd MMM yyyy HH:mm:ss', { locale: it })}
                            </small>
                          )}
                        </div>
                        <Badge className="btn-success-soft">Comprato</Badge>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <Card.Body className="text-center py-4">
                    <p className="text-muted mb-0">Nessun ingrediente comprato.</p>
                  </Card.Body>
                )}
              </Card>
            </>
          )}
        </Col>
      </Row>
      <ConfirmModal
        show={showClearAllModal}
        message="Svuotare tutte le liste della spesa?"
        onCancel={() => setShowClearAllModal(false)}
        requireAuthCode
        onConfirm={(authCode) => {
          clearAllListsMutation.mutate({ authCode: authCode || '' });
          setShowClearAllModal(false);
        }}
      />
      <ConfirmModal
        show={showClearPendingModal}
        message="Svuotare gli ingredienti da comprare?"
        onCancel={() => setShowClearPendingModal(false)}
        requireAuthCode
        onConfirm={(authCode) => {
          clearPendingMutation.mutate({ authCode: authCode || '' });
          setShowClearPendingModal(false);
        }}
      />
      <ConfirmModal
        show={showClearPurchasedModal}
        message="Svuotare gli ingredienti comprati?"
        onCancel={() => setShowClearPurchasedModal(false)}
        requireAuthCode
        onConfirm={(authCode) => {
          clearPurchasedMutation.mutate({ authCode: authCode || '' });
          setShowClearPurchasedModal(false);
        }}
      />

      <ConfirmModal
        show={Boolean(pendingRemoveItemId)}
        message="Rimuovere questo ingrediente dalla lista?"
        onCancel={() => setPendingRemoveItemId(null)}
        requireAuthCode
        onConfirm={(authCode) => {
          if (pendingRemoveItemId) {
            removeItemMutation.mutate({ itemId: pendingRemoveItemId, authCode: authCode || '' });
          }
          setPendingRemoveItemId(null);
        }}
      />
    </DashboardLayout>
  );
}
