# 6. Contratos de Integración y API (API Spec)

## 6.1. Especificación de Endpoints Principales

### 6.1.1. Autenticación Administrativa

* **Ruta:** `POST /api/v1/auth/google-login`
* **Payload Entrada:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```
* **Salida Exitosa (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "7f1d2c4e-5a6b-4e3f-9c8d-1a2b3c4d5e6f",
    "email": "admin@xionpay.internal",
    "full_name": "Administrador Principal",
    "role": "superadmin"
  }
}
```

---

### 6.1.2. Recepción de Pago Reportado (Invocado desde Xion-Manager)

* **Ruta:** `POST /api/v1/payments/report`
* **Encabezados:** `Authorization: Bearer <tenant_api_key>`
* **Payload Entrada:**
```json
{
  "tenant_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "origin_bank": "Banesco",
  "reference_number": "98745612",
  "amount": 50.00,
  "currency": "USD",
  "proof_attachment_url": "https://storage.xionpay.internal/proofs/proof-98745612.jpg",
  "metadata": {
    "client_ip": "190.202.10.5",
    "reported_by_user": "gerencia@comercio.com"
  }
}
```
* **Salida Exitosa (201 Created):**
```json
{
  "status": "success",
  "message": "Pago reportado exitosamente. En revisión por administración.",
  "payment_id": "a0f3d621-39e2-45e6-bb5e-7a95267e8899",
  "tolerance_granted": true,
  "tolerance_expires_at": "2026-10-07T16:34:56Z"
}
```
* **Error por Referencia Duplicada (409 Conflict):**
```json
{
  "error_code": "DUPLICATE_PAYMENT_REFERENCE",
  "message": "La referencia bancaria ya ha sido registrada previamente en el sistema.",
  "details": {
    "origin_bank": "Banesco",
    "reference_number": "98745612",
    "amount": 50.00
  }
}
```

---

### 6.1.3. Aprobación de Pago en 1 Clic (Acción Administrativa)

* **Ruta:** `POST /api/v1/payments/{payment_id}/approve`
* **Encabezados:** `Authorization: Bearer <admin_jwt>`
* **Salida Exitosa (200 OK):**
```json
{
  "status": "success",
  "message": "Pago aprobado. Licencia emitida y webhook despachado.",
  "subscription": {
    "status": "active",
    "new_period_end": "2026-11-06T23:59:59Z"
  },
  "license_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.ey..."
}
```

---

### 6.1.4. Rechazo de Pago (Acción Administrativa)

* **Ruta:** `POST /api/v1/payments/{payment_id}/reject`
* **Payload Entrada:**
```json
{
  "rejection_reason": "El número de referencia no coincide con ningún abono en los extractos bancarios de la fecha."
}
```
* **Salida Exitosa (200 OK):**
```json
{
  "status": "success",
  "message": "Pago rechazado exitosamente. Notificación transmitida a la instancia cliente."
}
```

---

### 6.1.5. Contrato de Webhook Saliente hacia Xion-Manager

* **Método:** `POST` a la `webhook_url` del cliente
* **Encabezados:**
  * `Content-Type: application/json`
  * `X-Xion-Signature: sha256=d5b3a...` (Firma HMAC calculada con el secreto del cliente)
* **Payload:**
```json
{
  "event": "payment.approved",
  "timestamp": "2026-10-06T16:35:00Z",
  "tenant_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "data": {
    "license_token": "eyJhbGciOiJSUzI1NiIsIn...",
    "expires_at": "2026-11-06T23:59:59Z",
    "limits": {
      "max_branches": 2,
      "max_pos_registers": 4,
      "modules": ["inventory_transfers"]
    }
  }
}
```
