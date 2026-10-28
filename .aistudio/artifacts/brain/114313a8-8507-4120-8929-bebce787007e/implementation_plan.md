# Implementation Plan: Unified Staff & Admin Gateway and Isolated Sales CRM

Implement a unified role-selection portal for platform administrators and sales representatives, relocate staff key generation into **Admin Settings**, and provide a standalone CRM workspace powered by real Firestore user data.

---

## 1. Unified Management Gateway (`/staff`)

- **Role Selection Interface**:
  - Two clear role options: **Platform Administrator** and **Sales & Outreach Staff**.
- **Role-Based Authentication**:
  - **Administrator Mode**:
    - Input: Admin Email & Password (`Raffilamarketplace@gmail.com`).
    - Validates Firebase Admin credentials and routes strictly to `/admin`.
  - **Sales Staff Mode**:
    - Input: Generated Sales Access Key (`RAF-SALES-XXXX-XXXX`).
    - Validates key status (`active`), logs timestamp, and establishes a secure staff session.
    - Routes strictly to the standalone `/crm` dashboard without granting access to `/admin`.
- **Direct Redirection & Guards**:
  - Staff attempting to open `/admin` will be denied and redirected to `/crm`.
  - Unauthenticated visitors on `/crm` are redirected to `/staff` with staff mode pre-selected.

---

## 2. Key Generation Inside Admin Settings (`/admin/settings`)

- **Placement**: Under the **Staff & CRM Access** tab within `/admin/settings`.
- **Features**:
  - **Generate Staff Key**: Form with Name, Corporate Email, and Territory Role. Generates a secure `RAF-SALES-XXXX-XXXX` key.
  - **Key Management**: One-click Copy Key, Revoke/Re-activate, and Remove Key actions.
  - **Audit Details**: Shows key creation date, last active login timestamp, and outreach call count.
  - Clean up the main admin sidebar navigation so operations remain streamlined.

---

## 3. Standalone Sales CRM Workspace (`/crm`)

- **Full Real-Data Integration**:
  - **Leads & Contacts**: Real registered users queried from Firestore (`users` collection).
  - **Call Logging**: Log call type (_Outbound Pitch, WhatsApp Outreach, Inbound Ticket Inquiry, General Outreach, Winner Support_), outcome (_Interested, Converted, Follow-up Scheduled, No Answer, Not Interested_), call notes, and follow-up reminders.
  - **Direct Outreach**: Click-to-call (`tel:`) and instant WhatsApp (`wa.me`) links for each real contact.
  - **Zero Wallet References**: Fully aligned with Raffila's direct ticket checkout model.
- **Header & Session Control**:
  - Displays logged-in sales staff name, role, and key badge.
  - Quick "Sign Out" button returning to the Unified Portal.

---

## 4. Verification & Testing

- Validate both login flows on `/staff` (Admin routing to `/admin`, Staff routing to `/crm`).
- Verify key creation, revoking, and activation inside `/admin/settings`.
- Ensure `/crm` functions with real Firestore users and records calls accurately.
- Run `compile_applet` and `lint_applet` to confirm 0 build errors.
