'use client';

import { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Modal,
  Badge,
  ListGroup,
  InputGroup,
  Spinner,
} from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { dishesApi, mealsApi } from '@/lib/api';
import { Dish, DishCategory } from '@/types';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';

const categoryLabels: Record<DishCategory, string> = {
  primo: 'Primo',
  secondo: 'Secondo',
  contorno: 'Contorno',
};

export default function PiattiPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'primo' as DishCategory,
    ingredients: [] as string[],
  });
  const [newIngredient, setNewIngredient] = useState('');
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string | null>(null);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoRange, setAutoRange] = useState('this_week');
  const [autoSlots, setAutoSlots] = useState({
    pranzo: { primo: true, secondo: true, contorno: true },
    cena: { primo: true, secondo: true, contorno: true },
  });
  const [autoInsufficient, setAutoInsufficient] = useState<{
    missing: number;
    neededByCategory: { primo: number; secondo: number; contorno: number };
  } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const { data: dishes, isLoading } = useQuery({
    queryKey: ['dishes', categoryFilter, search],
    queryFn: () =>
      dishesApi.list({
        category: categoryFilter || undefined,
        search: search || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: dishesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof dishesApi.update>[1] }) =>
      dishesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, authCode }: { id: string; authCode: string }) =>
      dishesApi.delete(id, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: ({ authCode }: { authCode: string }) => dishesApi.deleteAll(authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      setImportStatus('Tutti i piatti e le pianificazioni correlate sono stati rimossi.');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const autoScheduleMutation = useMutation({
    mutationFn: mealsApi.autoSchedule,
    onSuccess: (data) => {
      if (!data.success) {
        setAutoInsufficient({
          missing: data.missing ?? 0,
          neededByCategory: data.neededByCategory ?? { primo: 0, secondo: 0, contorno: 0 },
        });
        return;
      }
      setAutoStatus(`Auto-programmazione completata: ${data.created} pasti inseriti.`);
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const autoRanges = [
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

  const applyAutoPreset = (preset: 'full' | 'light' | 'custom') => {
    if (preset === 'full') {
      setAutoSlots({
        pranzo: { primo: true, secondo: true, contorno: true },
        cena: { primo: true, secondo: true, contorno: true },
      });
    }
    if (preset === 'light') {
      setAutoSlots({
        pranzo: { primo: true, secondo: false, contorno: false },
        cena: { primo: false, secondo: true, contorno: true },
      });
    }
  };

  const handleOpenModal = (dish?: Dish) => {
    if (dish) {
      setEditingDish(dish);
      setFormData({
        name: dish.name,
        category: dish.category,
        ingredients: [...dish.ingredients],
      });
    } else {
      setEditingDish(null);
      setFormData({
        name: '',
        category: 'primo',
        ingredients: [],
      });
    }
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDish(null);
    setNewIngredient('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Il nome del piatto è obbligatorio');
      return;
    }

    if (editingDish) {
      updateMutation.mutate({ id: editingDish.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setFormData({
        ...formData,
        ingredients: [...formData.ingredients, newIngredient.trim()],
      });
      setNewIngredient('');
    }
  };

  const handleRemoveIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleDeleteAll = () => {
    setConfirmDeleteAll(true);
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

  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const nameIndex = headers.indexOf('name');
    const categoryIndex = headers.indexOf('category');
    const ingredientsIndex = headers.indexOf('ingredients');

    if (nameIndex === -1 || categoryIndex === -1 || ingredientsIndex === -1) {
      throw new Error('CSV non valido. Usa intestazioni: name, category, ingredients');
    }

    return lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const name = cols[nameIndex]?.trim();
      const categoryRaw = cols[categoryIndex]?.trim().toLowerCase();
      const ingredientsRaw = cols[ingredientsIndex] ?? '';
      const ingredients = ingredientsRaw
        .split(';')
        .map((ing) => ing.trim())
        .filter(Boolean);

      if (!name) {
        throw new Error('CSV non valido: riga con nome mancante');
      }

      if (!['primo', 'secondo', 'contorno'].includes(categoryRaw)) {
        throw new Error(`Categoria non valida: ${categoryRaw}`);
      }

      return { name, category: categoryRaw as DishCategory, ingredients };
    });
  };

  const handleImportCsv = async (file: File) => {
    setError('');
    setImportStatus(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      let created = 0;
      let failed = 0;
      for (const dish of parsed) {
        try {
          await dishesApi.create(dish);
          created += 1;
        } catch (err) {
          failed += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      setImportStatus(`Import completato: ${created} creati, ${failed} falliti.`);
    } catch (err: any) {
      setError(err?.message || 'Errore durante l’import CSV');
    } finally {
      setImporting(false);
      setSelectedCsvFile(null);
    }
  };

  const handleExportCsv = async () => {
    setError('');
    setImportStatus(null);
    setExporting(true);
    try {
      const { csv } = await dishesApi.exportCsv();
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `familyPlanner_piatti_${stamp}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setExportFilename(filename);
    } catch (err: any) {
      setError(err?.message || 'Errore durante l’export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title">Gestione Piatti</h2>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="primary"
            className="btn-primary-soft"
            onClick={() => {
              setShowExportModal(true);
              handleExportCsv();
            }}
            disabled={exporting}
          >
            {exporting ? <Spinner size="sm" animation="border" /> : 'Esporta CSV'}
          </Button>
          <Button
            variant="primary"
            className="btn-primary-soft"
            onClick={() => setShowImportModal(true)}
            disabled={importing}
          >
            {importing ? <Spinner size="sm" animation="border" /> : 'Importa CSV'}
          </Button>
          <Button
            variant="primary"
            className="btn-primary-soft"
            onClick={() => setShowAutoModal(true)}
          >
            Auto-programma
          </Button>
          <Button variant="primary" className="btn-danger-soft" onClick={handleDeleteAll} disabled={deleteAllMutation.isPending}>
            {deleteAllMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Cancella Tutti'}
          </Button>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <FaPlus className="me-2" /> Nuovo Piatto
          </Button>
        </div>
      </div>


      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  className="placeholder-soft"
                  placeholder="es: Cerca piatti..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={4}>
              <Form.Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Tutte le categorie</option>
                <option value="primo">Primi</option>
                <option value="secondo">Secondi</option>
                <option value="contorno">Contorni</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <StatusModal
        show={Boolean(importStatus)}
        variant="success"
        message={importStatus || ''}
        onClose={() => setImportStatus(null)}
      />

      <StatusModal
        show={Boolean(autoStatus)}
        variant="success"
        message={autoStatus || ''}
        onClose={() => setAutoStatus(null)}
      />

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      ) : dishes && dishes.length > 0 ? (
        <Row>
          {dishes.map((dish) => (
            <Col md={6} lg={4} key={dish.id} className="mb-4">
              <Card className="h-100 dish-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <Badge className={getCategoryBadgeClass(dish.category)}>
                        {categoryLabels[dish.category]}
                      </Badge>
                    </div>
                    <div>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 me-2"
                        onClick={() => handleOpenModal(dish)}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-danger"
                        onClick={() => handleDelete(dish.id)}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </div>
                  <Card.Title>{dish.name}</Card.Title>
                  {dish.ingredients.length > 0 && (
                    <div className="mt-2">
                      {dish.ingredients.map((ing, i) => (
                        <span key={i} className="ingredient-tag">
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-3">Nessun piatto trovato</p>
            <Button variant="primary" onClick={() => handleOpenModal()}>
              <FaPlus className="me-2" /> Aggiungi il tuo primo piatto
            </Button>
          </Card.Body>
        </Card>
      )}

      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>{editingDish ? 'Modifica Piatto' : 'Nuovo Piatto'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <StatusModal
              show={Boolean(error)}
              variant="danger"
              message={error}
              onClose={() => setError('')}
            />

            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                type="text"
                className="placeholder-soft"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es: Pasta al pomodoro"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Categoria</Form.Label>
              <Form.Select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as DishCategory })
                }
              >
                <option value="primo">Primo</option>
                <option value="secondo">Secondo</option>
                <option value="contorno">Contorno</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Ingredienti</Form.Label>
              <InputGroup className="mb-2">
                <Form.Control
                  type="text"
                  className="placeholder-soft"
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  placeholder="es: Aggiungi ingrediente"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                />
                <Button variant="outline-secondary" onClick={handleAddIngredient}>
                  <FaPlus />
                </Button>
              </InputGroup>
              <div>
                {formData.ingredients.map((ing, i) => (
                  <span key={i} className="ingredient-tag d-inline-flex align-items-center">
                    {ing}
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 ms-1 text-danger"
                      onClick={() => handleRemoveIngredient(i)}
                    >
                      <FaTimes size={12} />
                    </Button>
                  </span>
                ))}
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-danger"
              className="btn-danger-soft"
              onClick={handleCloseModal}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Spinner size="sm" animation="border" />
              ) : editingDish ? (
                'Salva Modifiche'
              ) : (
                'Crea Piatto'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showImportModal}
        onHide={() => {
          setShowImportModal(false);
          setSelectedCsvFile(null);
        }}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Importa CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">
            Formato CSV: <strong>name,category,ingredients</strong> — ingredienti separati da “;”
            (categorie: primo, secondo, contorno).
          </p>
          <Form.Control
            type="file"
            accept=".csv"
            onChange={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              const file = input.files?.[0] ?? null;
              setSelectedCsvFile(file);
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => setShowImportModal(false)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={!selectedCsvFile || importing}
            onClick={() => {
              if (selectedCsvFile) {
                handleImportCsv(selectedCsvFile);
                setShowImportModal(false);
              }
            }}
          >
            {importing ? <Spinner size="sm" animation="border" /> : 'Carica'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showExportModal}
        onHide={() => {
          setShowExportModal(false);
          if (exportUrl) {
            URL.revokeObjectURL(exportUrl);
            setExportUrl(null);
          }
          setExportFilename(null);
        }}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header className="border-0 export-modal-header">
          <Modal.Title>Esporta CSV</Modal.Title>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setShowExportModal(false)}
            aria-label="Chiudi"
          >
            <FaTimes />
          </button>
        </Modal.Header>
        <Modal.Body>
          {exporting && (
            <div className="d-flex align-items-center gap-2">
              <Spinner size="sm" animation="border" />
              <span>Generazione file in corso...</span>
            </div>
          )}
          {!exporting && exportUrl && (
            <div className="d-flex flex-column align-items-center gap-2">
              <a
                className="btn btn-primary btn-primary-soft export-download-button"
                href={exportUrl}
                download={exportFilename || 'familyPlanner_piatti.csv'}
              >
                Download
              </a>
            </div>
          )}
          {!exporting && !exportUrl && (
            <span>Nessun file disponibile.</span>
          )}
        </Modal.Body>
      </Modal>

      <Modal
        show={showAutoModal}
        onHide={() => setShowAutoModal(false)}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Auto-programmazione</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">
            Seleziona un intervallo: verranno riempiti solo gli slot vuoti con alternanza automatica.
          </p>
          <div className="mb-3 d-flex gap-2 flex-wrap">
            <Button variant="outline-primary" className="btn-primary-soft" onClick={() => applyAutoPreset('full')}>
              Pasto completo
            </Button>
            <Button variant="outline-primary" className="btn-primary-soft" onClick={() => applyAutoPreset('light')}>
              Primo a pranzo / Secondo+Contorno a cena
            </Button>
          </div>
          <div className="mb-3">
            <h6 className="mb-2">Pranzo</h6>
            <div className="d-flex gap-3 flex-wrap">
              {(['primo', 'secondo', 'contorno'] as const).map((slot) => (
                <Form.Check
                  key={`pranzo-${slot}`}
                  type="checkbox"
                  id={`pranzo-${slot}`}
                  label={slot}
                  checked={autoSlots.pranzo[slot]}
                  onChange={(e) =>
                    setAutoSlots((prev) => ({
                      ...prev,
                      pranzo: { ...prev.pranzo, [slot]: e.target.checked },
                    }))
                  }
                />
              ))}
            </div>
          </div>
          <div className="mb-3">
            <h6 className="mb-2">Cena</h6>
            <div className="d-flex gap-3 flex-wrap">
              {(['primo', 'secondo', 'contorno'] as const).map((slot) => (
                <Form.Check
                  key={`cena-${slot}`}
                  type="checkbox"
                  id={`cena-${slot}`}
                  label={slot}
                  checked={autoSlots.cena[slot]}
                  onChange={(e) =>
                    setAutoSlots((prev) => ({
                      ...prev,
                      cena: { ...prev.cena, [slot]: e.target.checked },
                    }))
                  }
                />
              ))}
            </div>
          </div>
          <Form>
            {autoRanges.map((range) => (
              <Form.Check
                key={range.value}
                type="radio"
                id={`auto-${range.value}`}
                name="autoRange"
                label={range.label}
                value={range.value}
                checked={autoRange === range.value}
                onChange={(e) => setAutoRange(e.target.value)}
                className="mb-2"
              />
            ))}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => setShowAutoModal(false)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={autoScheduleMutation.isPending}
            onClick={() => {
              const slots = {
                pranzo: (Object.entries(autoSlots.pranzo)
                  .filter(([, v]) => v)
                  .map(([k]) => k) as string[]),
                cena: (Object.entries(autoSlots.cena)
                  .filter(([, v]) => v)
                  .map(([k]) => k) as string[]),
              };
              autoScheduleMutation.mutate({ rangeType: autoRange, slots });
              setShowAutoModal(false);
            }}
          >
            {autoScheduleMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Programma'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingDeleteId)}
        message="Sei sicuro di voler eliminare questo piatto?"
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
        show={confirmDeleteAll}
        message="Eliminare tutti i piatti e le pianificazioni collegate?"
        onCancel={() => setConfirmDeleteAll(false)}
        requireAuthCode
        onConfirm={(authCode) => {
          setConfirmDeleteAll(false);
          deleteAllMutation.mutate({ authCode: authCode || '' });
        }}
      />

      <ConfirmModal
        show={Boolean(autoInsufficient)}
        message={
          autoInsufficient
            ? `Non ci sono abbastanza combinazioni per rispettare 7 giorni di distanza. Servono almeno ${autoInsufficient.missing} nuovi piatti (primo: ${autoInsufficient.neededByCategory.primo}, secondo: ${autoInsufficient.neededByCategory.secondo}, contorno: ${autoInsufficient.neededByCategory.contorno}). Vuoi aggiungere nuovi piatti?`
            : ''
        }
        onCancel={() => setAutoInsufficient(null)}
        onConfirm={() => {
          setAutoInsufficient(null);
          handleOpenModal();
        }}
      />
    </DashboardLayout>
  );
}
