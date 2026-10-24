# Implementation Plan — Rafilla Master Operations & Feature Manual

## Overview

Create a comprehensive, production-grade Master Operations and Feature Manual for the Rafilla platform. The manual will document every core system feature, step-by-step workflows for user and administrative account management, competition creation and lifecycle management, the cryptographic draw engine and Wheel of Fortune live reveal, and an exhaustive registry of all third-party services and corporate email credentials provided.

The documentation will be delivered both as a structured Markdown manual in the project repository (`docs/RAFILLA_MASTER_OPERATIONS_MANUAL.md`) and as a compiled Microsoft Word document (`.docx`) located in `public/docs/` for direct download, backed by an automated generation script.

---

## Documentation Structure & Content Specifications

### 1. Executive Summary & Architecture Overview

- High-level platform purpose: transparent, verifiable prize competitions tailored for the Nigerian and wider African market.
- Core architecture: React SPA (Vite + TanStack Router), Tailwind CSS, Firebase Firestore/Auth/Storage, Paystack gateway, Cloudinary CDN, and Resend email infrastructure.
- High-level data flow: Ticket purchase -> Secure wallet/gateway settlement -> Subcollection ticket issuance -> Chronological freeze -> CSPRNG Draw -> Live synchronized Wheel of Fortune reveal -> Winners Showcase.

### 2. Complete Credential & Third-Party Service Registry

A dedicated, clearly formatted section cataloging all production login details, endpoints, and credentials:

- **Master Google SSO / Development Account**:
  - Email ID: `raffila.dev@gmail.com`
  - Password: `[Stored as provided]`
- **Domain & DNS Hosting (Namecheap)**:
  - Username: `Raffila`
  - Password: `[Stored as provided]`
- **Database & Authentication (Firebase Console)**:
  - Access via Master Google SSO (`raffila.dev@gmail.com`)
  - Project ID: `raffila-44282`
- **Admin Portal Access**:
  - Login URL: `/admin/login`
  - Admin Email: `Raffilamarketplace@gmail.com`
  - Password: `[Stored as provided]`
- **Media Storage & CDN (Cloudinary)**:
  - Access via Google SSO (`raffila.dev@gmail.com`)
- **Payment Processing (Paystack)**:
  - Account Email: `raffila.dev@gmail.com`
  - Password: `[Stored as provided]`
- **Transactional & Marketing Email (Resend)**:
  - Platform: `resend.com`
  - Access via Master Google SSO
- **Corporate Email Inboxes & Credentials**:
  - `support@raffila.com`
  - `Helpdesk@raffila.com`
  - `notification@raffila.com`
  - `HR@raffila.com`
  - `tg@raffila.com`
  - `eo@raffila.com`

### 3. User Journey & Feature Manual

- **Account Registration & Authentication**:
  - How new users sign up via email/password or Google OAuth.
  - Profile setup, phone verification, and identity tiers.
- **Raffila Wallet & Payments**:
  - Funding wallet balance via Paystack (card, bank transfer, USSD).
  - Spend-only wallet rules, zero-withdrawal compliance, transaction receipts.
- **Entering Competitions**:
  - Browsing the marketplace, budget filters, and live search.
  - Selecting ticket quantities (with per-user maximum limits enforced).
  - Ticket issuance: unique ticket numbers, entry IDs, and storage in user dashboard.
- **User Dashboard Operations**:
  - Overview: Active entries, ticket numbers, prizes won, and referral rewards.
  - My Entries: Ticket verification, draw dates, status indicators (Active, Completed, Won).
  - Claiming a Prize: Winner instructions, ID verification, and concierge handover.

### 4. Admin Portal & Operational Workflows

- **Navigating the Admin Dashboard**:
  - Access levels: Super Admin vs Operations Admin vs Financial Auditor.
  - Overview metrics: Gross volume, total tickets sold, active competitions, pending draws.
- **Creating & Launching a Competition**:
  - Step 1: Asset details (Title, Category, Condition, Specs, Partner).
  - Step 2: Commercial parameters (Entry price in Kobo, Total entry cap, Max tickets per entrant).
  - Step 3: Media upload via Cloudinary/Storage.
  - Step 4: Chronology validation (Closes date vs Draw date enforcement).
  - Step 5: Publishing states (`DRAFT` -> `UPCOMING` -> `LIVE`).
- **Monitoring Active Competitions**:
  - Pausing entries, editing specs, inspecting participant lists, and manual entry reconciliation.

### 5. Draw Engine, Live Wheel & Verification Workflow

- **Draw Eligibility & `DRAW_READY` Transition**:
  - Automatic criteria for closing entries when time expires or tickets sell out.
- **Admin Draw Control Room**:
  - Opening the draw confirmation modal.
  - The 9-stage verified draw sequence:
    1. `VERIFYING_TICKETS`: Validating confirmed, paid tickets.
    2. `CONFIRMING_PAYMENTS`: Ensuring zero unconfirmed payments enter the pool.
    3. `LOCKING_POOL`: Freezing the ticket list and computing the SHA-256 cryptographic snapshot hash.
    4. `VERIFYING_COUNT`: Publishing verified ticket and participant counts.
    5. `PREPARING_RECORD`: Initializing the immutable draw ledger entry.
    6. `WINNER_SELECTED`: Cryptographically uniform CSPRNG selection (`crypto.getRandomValues`).
    7. `SPINNING`: Real-time synchronized animation of the Wheel of Fortune with stationary central Rafilla logo.
    8. `REVEALED`: Stopping precisely at the winning ticket and displaying celebratory announcement.
    9. `COMPLETED`: Updating competition status to `COMPLETED`, removing it from open listings, and publishing to Winners Showcase.
- **Public Draw Verification & Replay**:
  - How anyone can inspect the verification record at `/draw-verification/$slug`.
  - How winners view their won prize on their dashboard.

### 6. Delivery Artifacts

- **Primary Markdown Document**: `docs/RAFILLA_MASTER_OPERATIONS_MANUAL.md`.
- **Word Document (.docx) Export**: Built using `docx` package into `public/docs/RAFILLA_MASTER_OPERATIONS_MANUAL.docx` so it can be opened directly in Microsoft Word, Google Docs, or LibreOffice.
- **Admin Quick-Access Download**: An option on the Admin dashboard settings/header allowing administrators to directly download the `.docx` and view the manual.

---

## Verification & Acceptance Plan

1. Validate that `docs/RAFILLA_MASTER_OPERATIONS_MANUAL.md` contains every feature, workflow, and login credential requested by the user.
2. Run the document compilation script to verify valid `.docx` generation without errors.
3. Verify that the downloadable file is served from `/docs/RAFILLA_MASTER_OPERATIONS_MANUAL.docx`.
4. Run `compile_applet` to ensure full build integrity across the entire application.
