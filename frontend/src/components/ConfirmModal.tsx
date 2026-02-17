'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Form, InputGroup } from 'react-bootstrap';
import { FaPaste } from 'react-icons/fa';

interface ConfirmModalProps {
  show: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireAuthCode?: boolean;
  onConfirm: (authCode?: string) => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  show,
  title = 'Conferma',
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  requireAuthCode = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [authCode, setAuthCode] = useState('');

  useEffect(() => {
    if (!show) {
      setAuthCode('');
    }
  }, [show]);

  const normalizedCode = authCode.trim().toUpperCase();
  const codeValid = /^[A-Z0-9]{5}$/.test(normalizedCode);

  const handlePasteAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAuthCode((text || '').trim().toUpperCase().slice(0, 5));
    } catch (error) {
      console.error('Failed to paste auth code:', error);
    }
  };

  return (
    <Modal show={show} onHide={onCancel} centered dialogClassName="app-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div>{message}</div>
        {requireAuthCode && (
          <Form.Group className="mt-3" controlId="familyAuthCode">
            <Form.Label>Codice di autenticazione</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                inputMode="text"
                autoComplete="off"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="es: A1B2C"
                maxLength={5}
              />
              <Button
                type="button"
                variant="outline-primary"
                className="btn-primary-soft"
                onClick={handlePasteAuthCode}
                title="Incolla codice"
              >
                <FaPaste />
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              Inserisci il codice a 5 caratteri per confermare.
            </Form.Text>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-danger" className="btn-danger-soft" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(requireAuthCode ? normalizedCode : undefined)}
          disabled={requireAuthCode ? !codeValid : false}
        >
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
