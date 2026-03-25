'use client';

import { Modal, Button } from 'react-bootstrap';

interface StatusModalProps {
  show: boolean;
  title?: string;
  message: string;
  variant?: 'danger' | 'success' | 'info';
  onClose: () => void;
}

const variantTitle: Record<NonNullable<StatusModalProps['variant']>, string> = {
  danger: 'Attenzione',
  success: 'Operazione completata',
  info: 'Informazione',
};

export default function StatusModal({
  show,
  title,
  message,
  variant = 'info',
  onClose,
}: StatusModalProps) {
  return (
    <Modal show={show} onHide={onClose} centered dialogClassName="app-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title || variantTitle[variant]}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onClose}>
          Ok
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
