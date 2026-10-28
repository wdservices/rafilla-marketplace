# RAFILLA PLATFORM — MASTER OPERATIONS & TECHNICAL MANUAL

**Comprehensive Operational Guide, Feature Documentation, and Credentials Registry**  
_Document Version: 2.0.0 — Production Edition_  
_Organization: Raffila Ltd (Lagos, Nigeria)_

---

## TABLE OF CONTENTS

1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Third-Party Services & Production Credentials Registry](#2-third-party-services--production-credentials-registry)
3. [User Account & Wallet Operations](#3-user-account--wallet-operations)
4. [Administrative Portal & Management Workflows](#4-administrative-portal--management-workflows)
5. [Setting Up & Managing Competitions (Step-by-Step)](#5-setting-up--managing-competitions-step-by-step)
6. [The Cryptographic Draw Engine & Wheel of Fortune](#6-the-cryptographic-draw-engine--wheel-of-fortune)
7. [Public Draw Experience, Verification & Winners Protocol](#7-public-draw-experience-verification--winners-protocol)
8. [Post-Draw Competition Archiving & Visibility Rules](#8-post-draw-competition-archiving--visibility-rules)
9. [Support, Customer Service & Incident Management](#9-support-customer-service--incident-management)

---

## 1. EXECUTIVE SUMMARY & SYSTEM ARCHITECTURE

### 1.1 Mission and Operating Model

Raffila is an African prize marketplace designed around curated luxury and lifestyle assets, transparent entry economics, and verifiable prize draws. Unlike traditional opaque lotteries, Raffila provides:

- **Transparent Entries**: Every purchased ticket is assigned an immutable, sequentially generated ticket number visible in the user's dashboard immediately after payment.
- **Fair Cryptographic Selection**: Winners are chosen through cryptographically secure pseudo-random number generators (CSPRNG), backed by SHA-256 ticket pool snapshots that can be independently audited by any viewer.
- **Synchronized Live Reveal**: All viewers—administrators and public participants alike—experience the same synchronized Wheel of Fortune reveal centered around the iconic stationary Rafilla brand hub.
- **Strict Financial Discipline**: The platform integrates directly with Paystack for sovereign card and bank rails, operating a spend-only internal wallet model that strictly prevents unauthorized cash extractions.

### 1.2 Technology Stack

| Layer                       | Technology                              | Purpose                                                                                                           |
| :-------------------------- | :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Frontend Framework**      | React 18 SPA (Vite + TypeScript)        | High-performance responsive single-page client                                                                    |
| **Routing**                 | TanStack Router (File-based)            | Type-safe declarative URL routing                                                                                 |
| **Styling & Design System** | Tailwind CSS + Lucide Icons             | Rafilla luxury palette (Forest Green `#0A261B`, Cream `#F7F4EB`, Gold `#D4AF37`, Mint `#22C55E`, Coral `#E11D48`) |
| **Backend & Persistence**   | Google Cloud Firebase (Firestore)       | Real-time database collections, snapshot listeners, and atomic transactions                                       |
| **Authentication**          | Firebase Authentication                 | Email/password, Google OAuth 2.0 SSO, session persistence                                                         |
| **Payment Gateway**         | Paystack Gateway (Card, Transfer, USSD) | Payment capture, webhook fulfillment, settlement                                                                  |
| **Media & Assets**          | Cloudinary CDN & Firebase Storage       | High-resolution prize photography and brand assets                                                                |
| **Transactional Email**     | Resend / Firebase Trigger Mail          | Draw receipts, winner alerts, concierge claim communications                                                      |

---

## 2. THIRD-PARTY SERVICES & PRODUCTION CREDENTIALS REGISTRY

> **SECURITY NOTICE**: The following credentials represent the master operational accounts for the Rafilla digital infrastructure. Access should be restricted strictly to authorized executive and operations personnel.

### 2.1 Master SSO & Development Account

- **Service**: Google Workspace / Master Single Sign-On (SSO)
- **Email ID**: `raffila.dev@gmail.com`
- **Password**: `Raffila@26`
- **Usage**: Serves as the central Google Identity used to sign in to Firebase, Cloudinary, Resend, and developer tooling.

### 2.2 Domain & DNS Registrar (Namecheap)

- **Platform**: Namecheap (`namecheap.com`)
- **Username**: `Raffila`
- **Password**: `Raffila@26`
- **Usage**: Domain name registration (`raffila.com`), DNS zone records, SSL certificate provisioning, and email MX routing.

### 2.3 Database & Cloud Backend (Firebase Console)

- **Platform**: Google Firebase Console (`console.firebase.google.com`)
- **Project Name**: `raffila-44282`
- **Authentication Method**: Sign in with Google using Master Email (`raffila.dev@gmail.com`)
- **Key Resources**:
  - Cloud Firestore: `competitions`, `draws`, `winners`, `users`, `tickets`, `mail`
  - Authentication: User and Admin credential store
  - Security Rules: Document-level read/write permissions

### 2.4 Rafilla Administrator Portal

- **Login URL**: `/admin` (or `/admin/login`)
- **Admin Email ID**: `Raffilamarketplace@gmail.com`
- **Admin Password**: `Admin@26`
- **Access Level**: Super Administrator (Competition management, live draw execution, partner oversight, transaction audit).

### 2.5 Media & Prize CDN (Cloudinary)

- **Platform**: Cloudinary (`cloudinary.com`)
- **Authentication Method**: Sign in with Google using Master Email (`raffila.dev@gmail.com`)
- **Usage**: Asset library for vehicle, electronic, and real-estate prize images, auto-optimized WebP/AVIF delivery.

### 2.6 Payment Gateway (Paystack)

- **Platform**: Paystack Dashboard (`dashboard.paystack.com`)
- **Login Email ID**: `raffila.dev@gmail.com`
- **Password**: `Raffila@26`
- **Usage**: Live and test payment gateway keys, bank settlement accounts, Paystack Standard checkout modals, and webhook configurations.

### 2.7 Transactional Notifications (Resend)

- **Platform**: Resend (`resend.com`)
- **Authentication Method**: Sign in with Google using Master Email (`raffila.dev@gmail.com`)
- **Usage**: Automated transactional emails (ticket purchase receipts, draw day reminders, winner claim notices).

### 2.8 Corporate Email Inboxes

All corporate emails are provisioned on the `@raffila.com` domain with dedicated webmail and SMTP/IMAP credentials:

| Corporate Email Address    | Password              | Operational Purpose                                      |
| :------------------------- | :-------------------- | :------------------------------------------------------- |
| `support@raffila.com`      | `Support@raffila@26`  | General customer support, ticket inquiries, entrant care |
| `Helpdesk@raffila.com`     | `Help@raffila.com@26` | Technical assistance, account recovery, bug reporting    |
| `notification@raffila.com` | `Raffila-26`          | System notifications, automated broadcasts, alerts       |
| `HR@raffila.com`           | `HR_raffila@26`       | Human resources, corporate communications, hiring        |
| `tg@raffila.com`           | `Tg@raffila@26`       | Executive office / Technology Leadership                 |
| `eo@raffila.com`           | `Eo@raffila.com@26`   | Executive office / Operations Leadership                 |

---

## 3. USER ACCOUNT & WALLET OPERATIONS

### 3.1 Creating a Standard User Account

1. **Initiate Sign-Up**:
   - Navigate to `https://raffila.com` and click the **Sign In / Register** button in the header.
   - Users can choose either **Sign in with Google** (one-click OAuth) or **Register with Email & Password**.
2. **Account Details**:
   - Full Name (First Name, Last Name)
   - Email Address
   - Phone Number (Nigerian mobile format e.g., `+234...`)
   - Password (minimum 8 characters with numbers and symbols)
3. **Account Activation**:
   - A verification token is generated. Upon completion, the user is redirected to their personalized dashboard at `/dashboard`.

### 3.2 The Raffila Wallet Model

- **Nature of Funds**: The Raffila Wallet is a **spend-only** store of credit designed specifically to purchase tickets rapidly without having to re-enter payment credentials on every draw.
- **No Direct Cash Withdrawals**: In compliance with regulatory standards, wallet balances cannot be cashed out. They can only be utilized for competition entries or referral reinvestment.
- **Funding Procedure**:
  1. Open Dashboard -> Click **Top Up Wallet**.
  2. Select preset amount (₦1,000, ₦2,500, ₦5,000, ₦10,000, or Custom Kobo value).
  3. The Paystack secure overlay opens.
  4. Entrant completes transaction via Debit Card, Bank Transfer, or USSD.
  5. Upon confirmation, wallet balance updates in real time.

### 3.3 Referral Program & Community Rewards

- Every user receives a unique referral code and sharable link (e.g., `https://raffila.com?ref=USER123`).
- When a referee registers and buys competition tickets, the referrer automatically earns referral credits.
- Referral earnings appear in the dashboard and can be toggled at checkout to purchase competition tickets without debiting personal cards.

---

## 4. ADMINISTRATIVE PORTAL & MANAGEMENT WORKFLOWS

### 4.1 Accessing the Admin Console

1. Navigate to `/admin` or `/admin/login`.
2. Enter the authorized Super Admin credentials:
   - **Email**: `Raffilamarketplace@gmail.com`
   - **Password**: `Admin@26`
3. Click **Sign In**. The system checks the Firebase `admins` collection and validates session claims before admitting the operator.

### 4.2 Administrative Navigation Overview

- **Competitions (`/admin/competitions`)**: View all competition cards, manage draft/live states, adjust entries, and initiate live draws.
- **Draw Control Room**: Dedicated cockpit for executing the 9-stage verified raffle sequence with public wheel preview.
- **Entries & Audit (`/admin/entries`)**: Search and export ticket rosters, verify Paystack transaction IDs, and inspect buyer allocations.
- **Partners (`/admin/partners`)**: Manage verified suppliers, asset certifications, and revenue-sharing percentages.
- **Settings & Config (`/admin/settings`)**: Feature kill-switches (wallet, referrals, maintenance mode), announcement banners, and email dispatch status.

---

## 5. SETTING UP & MANAGING COMPETITIONS (STEP-BY-STEP)

### 5.1 Creating a New Competition

To list a new luxury vehicle, tech bundle, or real estate opportunity:

1. **Open Competition Builder**:
   - From `/admin/competitions`, click the **+ Create Competition** button.
2. **Asset Details & Title**:
   - **Title**: Enter the public asset title (e.g., `Mercedes-Benz C-Class 2025` or `Wireless Hair Clipper`).
   - **Category**: Select taxonomy (`Vehicles`, `Electronics`, `Homes & Property`, `Lifestyle`, etc.).
   - **Condition**: Specify `Brand New`, `Certified Pre-Owned`, or `Mint Condition`.
   - **Partner**: Select the certified asset partner providing the prize (e.g., `Lekki Luxury Autos`).
3. **Commercial Rules & Ticket Economics**:
   - **Entry Price (₦)**: Enter ticket price in Naira (e.g., `₦100` = 10,000 Kobo).
   - **Total Entry Cap**: Enter total number of tickets available for the entire draw (e.g., `500` or `15,000`).
   - **Max Tickets Per User**: Safety ceiling per user (e.g., `50` or `200`) to prevent whale manipulation.
   - **Market Value (₦)**: True retail value of the prize.
4. **Media & Photography**:
   - Provide high-resolution Cloudinary or Firebase Storage image URLs.
   - The primary image will be displayed across marketplace cards, detail pages, hero banners, and the Wheel of Fortune.
5. **Chronological Dates (Strict Guardrails)**:
   - **Closing Date & Time**: When ticket sales permanently lock.
   - **Draw Date & Time**: When the live draw begins.
   - _CRITICAL SYSTEM RULE_: The draw date **must be strictly equal to or after** the closing date. The system prevents scheduling draws before sales close.
6. **Save as Draft or Publish**:
   - Click **Save as Draft** to review with partners.
   - Click **Publish Live** to make the competition immediately available in the public catalog.

---

## 6. THE CRYPTOGRAPHIC DRAW ENGINE & WHEEL OF FORTUNE

### 6.1 Transition to `DRAW_READY`

When the scheduled closing date arrives OR 100% of tickets sell out:

- The competition state updates to `DRAW_READY`.
- On `/admin/competitions`, the card displays a prominent gold **DRAW READY** badge and a green **Start Draw** button.

### 6.2 Admin Draw Control Room

Clicking **Start Draw** triggers the administrative control room:

1. **Confirmation Modal**: Displays competition summary, verified eligible ticket count, unique participant count, and safety checklist.
2. **Dual-Pane Control Room**:
   - **Left Pane (Draw Engine)**: Live step-by-step cryptographic audit logs, SHA-256 hashes, and execution status.
   - **Right Pane (Wheel Preview)**: Live interactive Wheel of Fortune rendering the exact ticket pool and stationary Rafilla logo.

### 6.3 The 9-Stage Verified Sequence

When the operator clicks **Initiate Draw & Spin Wheel**, the backend executes:

```
[1. VERIFYING_TICKETS] -> [2. CONFIRMING_PAYMENTS] -> [3. LOCKING_POOL]
          |                         |                        |
[4. VERIFYING_COUNT]   <- [5. PREPARING_RECORD]    <- [6. WINNER_SELECTED]
          |                         |                        |
[7. SPINNING (7.5s)]   -> [8. REVEALED]            -> [9. COMPLETED]
```

1. **`VERIFYING_TICKETS`**: Queries the competition's `tickets` subcollection to retrieve all entries.
2. **`CONFIRMING_PAYMENTS`**: Validates that all tickets correspond to settled, non-refunded transactions.
3. **`LOCKING_POOL`**: Freezes the ticket list. Generates a SHA-256 snapshot hash over the serialized ticket sequence: `SHA256(competitionId + ticketCount + ticketRoster)`.
4. **`VERIFYING_COUNT`**: Commits the verified eligible ticket count and participant count to Firestore.
5. **`PREPARING_RECORD`**: Prepares the immutable `draws/{competitionId}` ledger document.
6. **`WINNER_SELECTED`**: The winning ticket is selected using cryptographic CSPRNG (`crypto.getRandomValues`). The winner's ticket number, user ID, and display name are committed **before** animation begins.
7. **`SPINNING`**: Broadcasts `stage: "SPINNING"` with `spinStartTime` and `spinDurationMs = 7500` to all connected clients. The Wheel of Fortune spins synchronously for 7.5 seconds.
8. **`REVEALED`**: The wheel decelerates smoothly via ease-out cubic physics and stops **precisely** at the winning ticket segment under the fixed top pointer.
9. **`COMPLETED`**: Confetti explodes, the celebration modal opens, and status changes to `COMPLETED`.

### 6.4 The Wheel of Fortune Hub Design

- **Center Hub**: An intentional, stationary circular hub displaying the official transparent Rafilla logo (`/Rafilla-logo.png`).
- **Stationary Stability**: The outer segments and ticket numbers rotate continuously, while the center Rafilla logo remains upright and stationary.
- **Accurate Angle Math**: Segment stop angle is calculated via `targetAngle = 360 * spins - (winnerIndex * segmentAngle + segmentAngle / 2)`.

---

## 7. PUBLIC DRAW EXPERIENCE, VERIFICATION & WINNERS PROTOCOL

### 7.1 Public Draw Page Routes

Public viewers can watch live draws and view historical replays at:

- `/competitions/$slug/draw`
- `/draw/$slug`

The page features:

- Two-thirds desktop layout dedicated to the large Wheel of Fortune.
- Compact **Draw Verification Panel** tracking real-time backend verification states.
- Live participant counts and eligible ticket totals.

### 7.2 Draw Day Notification Banner

On the scheduled draw date:

- A responsive, unobtrusive notification bar appears across the main website.
- Highlights: Prize title, scheduled time (WAT / Lagos), and a direct **Watch Live Draw** button.

### 7.3 Public Cryptographic Verification (`/draw-verification/$slug`)

Every completed draw publishes an immutable verification record:

- **Draw ID**: `RF-DRAW-2026-XXXXXX`
- **Verification Reference**: `RF-VRF-XXXXXXXX-XXXX`
- **SHA-256 Pool Hash**: Public hexadecimal hash validating that no tickets were added, altered, or deleted after the pool locked.
- **Winner Confirmation**: Approved display name, masked handle, and winning ticket number.

### 7.4 Winner Handover Protocol

1. **Automated Notification**: An email is dispatched via Resend to the winner's account email address.
2. **Dashboard Trophy Alert**: When the winner logs into `/dashboard`, a prominent **Winner Verified** banner appears with prize handover instructions.
3. **Identity Verification**: The Concierge team verifies Government-issued ID matching the registered account name.
4. **Prize Handover**: Physical delivery or partner collection is arranged within 14 business days.

---

## 8. POST-DRAW COMPETITION ARCHIVING & VISIBILITY RULES

To maintain a clean marketplace and prevent entrant confusion:

### 8.1 Removal from Open Competition Listings

As soon as a competition's draw concludes (`status === "COMPLETED"`):

1. **Excluded from Catalog**: It is automatically removed from the active competitions catalog at `/competitions`.
2. **Excluded from Homepage**: It is removed from the Homepage Hero Carousel, `Live Competitions`, `Popular Under ₦1,000`, and `Browse by Need`.
3. **Excluded from User Competitions**: It is removed from `/dashboard/competitions` ("Active Competitions").
4. **Direct URL Protection**: If an entrant visits `/competitions/wireless-hair-clipper` directly, the ticket purchasing form is hidden and replaced by a **Draw Concluded** notification with links to **Watch Draw Replay** and **View in Winners Circle**.

### 8.2 Permitted Visibility Surfaces

A concluded competition is visible **only** in:

- **The Winners Showcase (`/winners`)**: Rendered as a permanent winner card with prize value, draw date, and verification link.
- **The Winner's Personal Dashboard (`/dashboard`)**: Displayed under **My Entries** with status **Won** and celebratory gold badges.
- **The Public Verification & Replay Pages (`/draw-verification/$slug` & `/competitions/$slug/draw`)**.

---

## 9. SUPPORT, CUSTOMER SERVICE & INCIDENT MANAGEMENT

### 9.1 Support Channels

- **Entrant Support**: `support@raffila.com`
- **Technical Helpdesk**: `Helpdesk@raffila.com`
- **Emergency Operations**: `eo@raffila.com`

### 9.2 Troubleshooting Common Operational Scenarios

| Scenario                              | Root Cause                                      | Administrative Remedy                                                                                     |
| :------------------------------------ | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Competition stuck in `DRAW_READY`** | Draw time passed but admin has not started draw | Log in to `/admin/competitions`, click **Start Draw**, and execute the control room sequence.             |
| **Zero eligible tickets found**       | No entries were sold or tickets were not seeded | Under competition actions, use the **Generate Demo Entrants** utility in testing, or extend closing date. |
| **User cannot fund wallet**           | Paystack connectivity or card decline           | Direct user to alternative rails (Bank Transfer / USSD) or check Paystack dashboard for decline codes.    |
| **Winner hasn't responded**           | Unreachable email or phone                      | The 14-day claim window applies. Concierge re-contacts via telephone and corporate SMS.                   |

---

## 10. SALES CRM & OUTREACH STAFF ACCESS MANAGEMENT

### 10.1 Sales Staff Architecture & Role Separation

To protect platform integrity and financial operations:

- **Isolated CRM Dashboard**: Sales representatives **do not** have access to the Super Admin Dashboard (`/admin`), financial payout queues, fraud triggers, or master platform settings.
- **Dedicated Staff Portal**: Sales staff log in directly at **`/crm`** using their individual **Sales Access Key** (format: `RAF-SALES-XXXX-XXXX`).
- **No Password Management Friction**: Admins generate and revoke keys on demand without creating full Firebase admin accounts.

### 10.2 How the Admin Creates a Sales Staff Login

1. Log into the Super Admin Dashboard at **`/admin`** using the admin credentials (`Raffilamarketplace@gmail.com` | `Admin@26`).
2. In the sidebar under **OPERATIONS**, click **CRM & Sales** (`/admin/crm`).
3. Click the **Generate Staff Key** button in the top right.
4. Fill in the staff member's details:
   - **Full Name**: e.g. `Samuel Adekunle`
   - **Email Address**: e.g. `samuel@raffila.com`
   - **Role / Territory**: e.g. `Senior Outreach Executive — Lagos`
5. Click **Create Key**. The system automatically generates a unique, cryptographically secure key (e.g. `RAF-SALES-4921-8840`).
6. Click **Copy Key** and dispatch it securely to the sales representative along with the portal URL (`https://raffila.com/crm`).

### 10.3 How Sales Personnel Sign In and Log Calls

1. The sales representative navigates to **`/crm`**.
2. They input their unique **Staff Access Key** and click **Sign In to Sales CRM**.
3. Upon authentication, their personalized Sales Dashboard opens, displaying:
   - **My Logged Calls**, **Conversions**, and **Pending Follow-ups**.
   - **Call Activity History**: Complete audit trail of client interactions.
   - **Client Leads & VIPs**: Directory with direct Click-to-Call (`tel:`) and WhatsApp (`wa.me`) shortcuts.
   - **Sales Script & Talking Points**: Reference notes on active high-value prizes (Apartments, SUVs, Tech Bundles) and answers to common trust objections.
4. **Logging an Outreach Call**:
   - Click **Log Outreach Call** or the **Log Call** action next to any lead.
   - Fill in: Client Name, Phone Number, Call Type (Outbound Pitch, WhatsApp, Ticket Inquiry, VIP Concierge, Winner Support), and Outcome (Converted, Interested, Follow-up, No Answer, Not Interested).
   - Add concise notes and select a follow-up callback date if required.
   - Click **Save Call Record**.

### 10.4 Revoking or Re-activating Staff Access

If a sales representative departs or changes roles:

1. Navigate to `/admin/crm` under the **Sales Staff Keys** tab.
2. Locate the representative in the table.
3. Click **Revoke** to immediately invalidate their key. Any active session on `/crm` is terminated automatically.
4. Click **Activate** to restore access, or the **Trash** icon to permanently delete the key.

---

_© 2026 Raffila Ltd. All rights reserved. Registered in the Federal Republic of Nigeria._  
_This document contains proprietary operational procedures for Raffila digital assets._
