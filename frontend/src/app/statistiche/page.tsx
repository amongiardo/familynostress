'use client';

import { Card, Col, Row, Spinner, Badge } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { statsApi } from '@/lib/api';

function getCategoryBadge(category: string) {
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
}

function StatBlock({ range }: { range: 'week' | 'month' }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['meal-stats', range],
    queryFn: () => statsApi.meals(range),
  });

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-center py-4 text-muted">Errore nel caricamento.</div>;
  }

  const maxCount = Math.max(...data.frequent.map((item) => item.count), 1);

  return (
    <Row className="g-4">
      <Col lg={7}>
        <Card className="h-100">
          <Card.Body>
            <Card.Title className="mb-3">
              Piatti più frequenti ({range === 'week' ? 'Settimana' : 'Mese'})
            </Card.Title>
            {data.frequent.length === 0 ? (
              <div className="text-muted">Nessun pasto registrato.</div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {data.frequent.slice(0, 8).map((item) => (
                  <div key={item.dishId} className="stat-row">
                    <div className="d-flex align-items-center gap-2">
                      <Badge className={getCategoryBadge(item.category)}>{item.category}</Badge>
                      <span className="fw-bold">{item.name}</span>
                    </div>
                    <div className="stat-bar">
                      <div
                        className="stat-bar-fill"
                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                      />
                      <span className="stat-bar-count">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
      <Col lg={5}>
        <Card className="h-100">
          <Card.Body>
            <Card.Title className="mb-3">
              Piatti non mangiati ({range === 'week' ? 'Settimana' : 'Mese'})
            </Card.Title>
            {data.notEaten.length === 0 ? (
              <div className="text-muted">Tutti i piatti sono stati mangiati.</div>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                {data.notEaten.slice(0, 20).map((dish) => (
                  <Badge key={dish.dishId} className={getCategoryBadge(dish.category)}>
                    {dish.name}
                  </Badge>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default function MenuStatsPage() {
  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title">Statistiche</h2>
      </div>

      <div className="d-flex flex-column gap-4">
        <StatBlock range="week" />
        <StatBlock range="month" />
      </div>
    </DashboardLayout>
  );
}
