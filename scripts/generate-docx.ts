import * as fs from "fs";
import * as path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from "docx";

function createHeading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  color = "0A261B",
) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        color,
        font: "Calibri",
      }),
    ],
  });
}

function createParagraph(
  text: string,
  options: { bold?: boolean; italic?: boolean; color?: string; spacingAfter?: number } = {},
) {
  return new Paragraph({
    spacing: { before: 60, after: options.spacingAfter ?? 100, line: 276 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italic,
        color: options.color || "222222",
        font: "Calibri",
        size: 22, // 11pt
      }),
    ],
  });
}

function createBullet(text: string, boldPrefix?: string) {
  const children: TextRun[] = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix,
        bold: true,
        font: "Calibri",
        size: 22,
        color: "0A261B",
      }),
    );
  }
  children.push(
    new TextRun({
      text,
      font: "Calibri",
      size: 22,
      color: "333333",
    }),
  );

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 60, line: 260 },
    children,
  });
}

function createCallout(title: string, text: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 24, color: "0A261B" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: "F3F4F1" },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    color: "0A261B",
                    font: "Calibri",
                    size: 22,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text,
                    italics: true,
                    color: "444444",
                    font: "Calibri",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createStyledTable(headers: string[], rows: string[][]) {
  const tableRows: TableRow[] = [];

  // Header Row
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: headers.map(
        (h) =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: "0A261B" },
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: h,
                    bold: true,
                    color: "FFFFFF",
                    font: "Calibri",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
      ),
    }),
  );

  // Data Rows
  rows.forEach((r, idx) => {
    const isEven = idx % 2 === 0;
    tableRows.push(
      new TableRow({
        children: r.map(
          (c) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: isEven ? "FAFAF8" : "FFFFFF" },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              borders: {
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                top: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: c,
                      color: "222222",
                      font: "Calibri",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

async function generateDocx() {
  console.log("Generating Raffila Master Operations Manual (.docx)...");

  const doc = new Document({
    creator: "Raffila Technical & Operations Team",
    title: "Raffila Platform — Master Operations & Technical Manual",
    description:
      "Complete guide to all features, user/admin workflows, draw architecture, and third-party credentials",
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "RAFILLA — Confidential Operations & Master Manual",
                    italics: true,
                    size: 18,
                    color: "888888",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 18, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" }),
                  new TextRun({ text: " of ", size: 18, color: "888888" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children: [
          // TITLE BLOCK
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 80 },
            children: [
              new TextRun({
                text: "RAFILLA PLATFORM",
                bold: true,
                size: 48, // 24pt
                color: "0A261B",
                font: "Calibri",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Master Operations & Technical Manual",
                bold: true,
                size: 32,
                color: "D4AF37",
                font: "Calibri",
              }),
            ],
          }),
          createParagraph(
            "Document Version: 2.0.0 — Production Edition | Organization: Raffila Ltd (Lagos, Nigeria)",
            { italic: true, color: "666666", spacingAfter: 200 },
          ),

          createCallout(
            "RESTRICTED OPERATIONAL ASSET",
            "This manual contains master operational credentials, production architecture designs, administrative protocols, and cryptographic specifications for the Raffila platform. Access is restricted strictly to authorized operations, engineering, and executive personnel.",
          ),

          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // SECTION 1
          createHeading("1. EXECUTIVE SUMMARY & SYSTEM ARCHITECTURE", HeadingLevel.HEADING_1),
          createParagraph(
            "Raffila is an African luxury and prize marketplace engineered around transparent entry mechanics, verifiable cryptographic draws, and consumer trust. Unlike opaque lottery systems, Raffila provides:",
          ),
          createBullet(
            " Every purchased ticket receives an immutable ticket number logged in Firestore and viewable immediately in the user dashboard.",
            "Transparent Sequential Tickets:",
          ),
          createBullet(
            " Winner selection is governed by cryptographically secure pseudo-random number generation (CSPRNG), backed by SHA-256 ticket pool snapshots.",
            "Fair Cryptographic Selection:",
          ),
          createBullet(
            " Administrators, viewers, and participants share a synchronized real-time live reveal featuring the iconic stationary Rafilla brand hub.",
            "Synchronized Live Reveal:",
          ),
          createBullet(
            " Direct Paystack integration for sovereign card and bank rails, backed by a spend-only internal wallet model.",
            "Financial Security:",
          ),

          new Paragraph({ spacing: { before: 120, after: 80 } }),
          createHeading("1.1 Technology Stack Matrix", HeadingLevel.HEADING_2),
          createStyledTable(
            ["Layer", "Technology", "Operational Purpose"],
            [
              [
                "Frontend Framework",
                "React 18 SPA (Vite + TypeScript)",
                "High performance, type-safe responsive single-page web client",
              ],
              [
                "Routing Architecture",
                "TanStack Router (File-based)",
                "Declarative type-safe URL routing and deep links",
              ],
              [
                "Design System & Theme",
                "Tailwind CSS + Lucide Icons",
                "Rafilla luxury palette: Forest Green (#0A261B), Cream (#F7F4EB), Gold (#D4AF37)",
              ],
              [
                "Backend & Persistence",
                "Google Cloud Firebase (Firestore)",
                "Real-time collections, atomic transactions, and snapshot listeners",
              ],
              [
                "Authentication Provider",
                "Firebase Authentication",
                "Email/password, Google OAuth 2.0 SSO, session persistence",
              ],
              [
                "Payment Processing",
                "Paystack Gateway API",
                "Sovereign card processing, instant bank transfers, and USSD payments",
              ],
              [
                "Media & Asset CDN",
                "Cloudinary & Firebase Storage",
                "High-resolution prize imagery with optimized delivery",
              ],
              [
                "Transactional Email",
                "Resend / Firebase Trigger Mail",
                "Order receipts, winner notifications, and claim communications",
              ],
            ],
          ),

          // SECTION 2
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          createHeading(
            "2. THIRD-PARTY SERVICES & PRODUCTION CREDENTIALS REGISTRY",
            HeadingLevel.HEADING_1,
          ),
          createParagraph(
            "The following credentials represent the master operational accounts for the Rafilla digital infrastructure:",
          ),

          createHeading(
            "2.1 Master Single Sign-On (SSO) & Developer Account",
            HeadingLevel.HEADING_2,
          ),
          createBullet("raffila.dev@gmail.com", "Email ID: "),
          createBullet("Raffila@26", "Password: "),
          createBullet(
            "Central Google Identity used to sign in to Firebase, Cloudinary, Resend, and developer tooling.",
            "Purpose: ",
          ),

          createHeading("2.2 Domain & DNS Registrar (Namecheap)", HeadingLevel.HEADING_2),
          createBullet("namecheap.com", "Platform URL: "),
          createBullet("Raffila", "Username: "),
          createBullet("Raffila@26", "Password: "),
          createBullet(
            "Domain name management (raffila.com), DNS zone records, SSL provisioning, and MX records.",
            "Operational Scope: ",
          ),

          createHeading("2.3 Database & Cloud Backend (Firebase Console)", HeadingLevel.HEADING_2),
          createBullet("console.firebase.google.com", "Platform URL: "),
          createBullet(
            "Login with Google -> raffila.dev@gmail.com / Raffila@26",
            "Authentication: ",
          ),
          createBullet(
            "Firestore NoSQL database, security rules, user authentication accounts, and storage buckets.",
            "Components: ",
          ),

          createHeading("2.4 Administrative Portal Access", HeadingLevel.HEADING_2),
          createBullet("Raffilamarketplace@gmail.com", "Admin Email: "),
          createBullet("Admin@26", "Admin Password: "),
          createBullet(
            "https://[domain]/admin or via the User Avatar dropdown -> Admin Dashboard.",
            "Portal URL: ",
          ),
          createBullet(
            "Creating/editing competitions, triggering cryptographic draws, manual wallet adjustments, and reviewing audit logs.",
            "Authorized Capabilities: ",
          ),

          createHeading("2.5 Media & Asset Management (Cloudinary)", HeadingLevel.HEADING_2),
          createBullet("cloudinary.com", "Platform URL: "),
          createBullet(
            "Login with Google -> raffila.dev@gmail.com / Raffila@26",
            "Authentication: ",
          ),
          createBullet(
            "Prize photography uploads, responsive transformations, and CDN asset delivery.",
            "Usage: ",
          ),

          createHeading("2.6 Payment Gateway (Paystack)", HeadingLevel.HEADING_2),
          createBullet("dashboard.paystack.com", "Platform URL: "),
          createBullet("raffila.dev@gmail.com", "Account Email: "),
          createBullet("Raffila@26", "Password: "),
          createBullet(
            "Real-time payment verification, wallet top-up processing, webhook transaction logging, and settlement reconciliation.",
            "Operational Scope: ",
          ),

          createHeading("2.7 Transactional Email & Notifications (Resend)", HeadingLevel.HEADING_2),
          createBullet("resend.com", "Platform URL: "),
          createBullet(
            "Sign in with Google -> raffila.dev@gmail.com / Raffila@26",
            "Authentication: ",
          ),
          createBullet(
            "Transactional order receipts, ticket number issuance, and winner claim notifications.",
            "Usage: ",
          ),

          createHeading("2.8 Corporate Email Inboxes", HeadingLevel.HEADING_2),
          createStyledTable(
            ["Email Address", "Password", "Department / Responsibility"],
            [
              [
                "support@raffila.com",
                "Support@raffila@26",
                "Primary customer support, ticket inquiries, and order queries",
              ],
              [
                "Helpdesk@raffila.com",
                "Help@raffila.com@26",
                "Technical support, account access issues, and wallet questions",
              ],
              [
                "notification@raffila.com",
                "Raffila-26",
                "System-automated outbound notifications and draw reminders",
              ],
              [
                "HR@raffila.com",
                "HR_raffila@26",
                "Human resources, staff administration, and internal staffing",
              ],
              [
                "tg@raffila.com",
                "Tg@raffila@26",
                "Executive leadership & strategic partner communications",
              ],
              [
                "eo@raffila.com",
                "Eo@raffila.com@26",
                "Executive leadership & operational oversight",
              ],
            ],
          ),

          // SECTION 3
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          createHeading("3. USER ACCOUNT & WALLET OPERATIONS", HeadingLevel.HEADING_1),
          createHeading("3.1 Creating a User Account", HeadingLevel.HEADING_2),
          createBullet(
            "Navigate to the top navigation header on any page and click the 'Sign In' button.",
            "Step 1: ",
          ),
          createBullet(
            "In the modal dialog, select 'Sign Up' or select 'Sign in with Google' for 1-click Google OAuth authentication.",
            "Step 2: ",
          ),
          createBullet(
            "Enter full name, valid email address, phone number, and a strong password (minimum 8 characters).",
            "Step 3: ",
          ),
          createBullet(
            "Upon submission, Firebase Auth creates the credentials and auto-initializes a Firestore user profile document with default balance 0 and wallet address.",
            "Step 4: ",
          ),

          createHeading("3.2 User Dashboard Features", HeadingLevel.HEADING_2),
          createBullet(
            "Overview tab with total entries count, won competitions count, active draws, and current spend-only wallet balance.",
            "Dashboard Overview: ",
          ),
          createBullet(
            "Displays all tickets grouped by competition with exact sequential ticket numbers (e.g. #326031), order date, and live status badge ('Active', 'Won', 'Completed').",
            "My Tickets & Entries: ",
          ),
          createBullet(
            "Direct links to watch live draw replays, view certificates of fairness, and claim won prizes.",
            "Draw Replay & Verification: ",
          ),

          createHeading("3.3 Wallet Mechanics & Paystack Top-Up", HeadingLevel.HEADING_2),
          createBullet(
            "Raffila operates a spend-only internal wallet model. Wallet funds cannot be arbitrarily withdrawn, completely preventing unauthorized cash-out schemes.",
            "Spend-Only Model: ",
          ),
          createBullet(
            "Users can fund their wallet via Paystack pop-up supporting Naira Mastercard, Visa, Verve, Bank Transfer, or USSD.",
            "Funding Channels: ",
          ),
          createBullet(
            "Cart checkout allows 1-click payment using available wallet balance, falling back to direct Paystack payment if balance is insufficient.",
            "Frictionless Checkout: ",
          ),

          // SECTION 4
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          createHeading("4. ADMINISTRATIVE PORTAL & COMPETITION SETUP", HeadingLevel.HEADING_1),
          createHeading("4.1 Setting Up a New Competition", HeadingLevel.HEADING_2),
          createBullet(
            "Sign in using Raffilamarketplace@gmail.com / Admin@26 and navigate to Admin Portal -> Competitions Tab.",
            "Step 1: ",
          ),
          createBullet(
            "Click 'Create Competition' to open the standardized competition configuration modal.",
            "Step 2: ",
          ),
          createBullet(
            "Enter Title (e.g., '2024 Mercedes-Benz C300 AMG Line'), Subtitle, Category (Vehicles, Luxury, Tech, Cash, Real Estate), and Slug.",
            "Step 3: ",
          ),
          createBullet(
            "Set Total Tickets (e.g., 2,500), Ticket Price (in NGN, e.g., 5,000), and max tickets allowed per single user.",
            "Step 4: ",
          ),
          createBullet(
            "Set Draw Date and Time. Toggle 'Guaranteed Draw' to assure participants the draw occurs regardless of sell-out percentage.",
            "Step 5: ",
          ),
          createBullet(
            "Provide Prize Details, specifications, delivery terms, and high-resolution Cloudinary image URLs.",
            "Step 6: ",
          ),
          createBullet(
            "Click 'Publish Competition'. The competition immediately enters the active database feed and displays on the public website.",
            "Step 7: ",
          ),

          // SECTION 5
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          createHeading(
            "5. THE CRYPTOGRAPHIC DRAW ENGINE & WHEEL OF FORTUNE",
            HeadingLevel.HEADING_1,
          ),
          createParagraph(
            "The Raffila draw engine adheres to a rigorous 9-stage cryptographic lifecycle:",
          ),

          createStyledTable(
            ["Stage", "Name", "Cryptographic / Operational Action"],
            [
              [
                "Stage 1",
                "Eligibility Verification",
                "Validates that the scheduled draw time has arrived or 100% of tickets have been sold.",
              ],
              [
                "Stage 2",
                "Snapshot Generation",
                "Compiles all valid purchased ticket numbers and hashes them into an immutable SHA-256 fingerprint.",
              ],
              [
                "Stage 3",
                "CSPRNG Entropy Ingestion",
                "Ingests crypto.getRandomValues() entropy and current server epoch microsecond seed.",
              ],
              [
                "Stage 4",
                "Index Calculation",
                "Derives winning ticket index = entropy % total_eligible_tickets.",
              ],
              [
                "Stage 5",
                "Audited State Lock",
                "Firestore write locks the competition status to IN_PROGRESS so no new tickets can be added.",
              ],
              [
                "Stage 6",
                "Wheel Synchronization",
                "Wheel of Fortune spins with stationary Rafilla brand center hub for exactly 8 seconds.",
              ],
              [
                "Stage 7",
                "Deceleration & Alignment",
                "Wheel decelerates with organic physics, landing precisely on the winning ticket slice.",
              ],
              [
                "Stage 8",
                "Winner Reveal & Confetti",
                "Winner name, masked phone number, location, and winning ticket are revealed with audio fanfare.",
              ],
              [
                "Stage 9",
                "Automated Archiving",
                "Firestore writes winner details, sets status: COMPLETED, and clears featured flags.",
              ],
            ],
          ),

          // SECTION 6
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          createHeading(
            "6. POST-DRAW COMPETITION ARCHIVING & VISIBILITY RULES",
            HeadingLevel.HEADING_1,
          ),
          createParagraph(
            "To maintain absolute platform integrity, concluded competitions are automatically subject to strict visibility routing:",
          ),
          createBullet(
            "Once status is COMPLETED or a winning ticket is declared, the competition is strictly stripped from Homepage Hero, Active Competitions, Popular Under 1000, and Live Competitions grids.",
            "Automatic Removal from Active Listings: ",
          ),
          createBullet(
            "The concluded competition is immediately listed in the public Winners section (/winners) complete with winner name, ticket number, draw timestamp, and replay button.",
            "Promoted to Winners Section: ",
          ),
          createBullet(
            "Users who purchased tickets see the competition marked with a celebratory gold 'Won' badge or 'Completed' status with a direct link to the Live Draw replay and verification hash.",
            "User Dashboard Visibility: ",
          ),
          createBullet(
            "If a user accesses the competition URL directly, ticket purchasing is locked, and a prominent 'DRAW CONCLUDED' banner displays the official winner with actions to watch the replay.",
            "Detail Page Locking: ",
          ),

          // SECTION 7
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          createHeading("7. SUPPORT, CONCIERGE & INCIDENT MANAGEMENT", HeadingLevel.HEADING_1),
          createParagraph("Standard operating procedures for customer care and prize fulfillment:"),
          createBullet(
            "support@raffila.com handles ticket verification, billing discrepancies, and general inquiries within 2 hours SLA.",
            "Customer Support (support@raffila.com): ",
          ),
          createBullet(
            "Helpdesk@raffila.com resolves 2FA issues, session lockouts, and browser compatibility questions.",
            "Technical Helpdesk (Helpdesk@raffila.com): ",
          ),
          createBullet(
            "Within 4 hours of a draw, the Concierge team contacts the winner via verified phone and email to coordinate physical prize handover or bank wire transfer for cash alternatives.",
            "Winner Concierge Protocol: ",
          ),
          createBullet(
            "Physical luxury assets (vehicles, electronics) are formally handed over at our verified operations center in Lagos, Nigeria, with official handover photography published to the Winners Circle.",
            "Prize Handover Logistics: ",
          ),

          // CLOSING
          new Paragraph({ spacing: { before: 240, after: 80 } }),
          createCallout(
            "RAFILLA OPERATIONS COMPLIANCE SIGN-OFF",
            "This document is maintained by Raffila Ltd. Any credential rotation or architecture modification must be approved by Executive Operations (eo@raffila.com) and Strategic Leadership (tg@raffila.com).",
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  // Ensure directories exist
  const publicDocsDir = path.resolve(process.cwd(), "public/docs");
  const docsDir = path.resolve(process.cwd(), "docs");
  if (!fs.existsSync(publicDocsDir)) fs.mkdirSync(publicDocsDir, { recursive: true });
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const publicFilePath = path.join(publicDocsDir, "RAFILLA_MASTER_OPERATIONS_MANUAL.docx");
  const docsFilePath = path.join(docsDir, "RAFILLA_MASTER_OPERATIONS_MANUAL.docx");

  fs.writeFileSync(publicFilePath, buffer);
  fs.writeFileSync(docsFilePath, buffer);

  console.log(`Successfully generated DOCX manual at:`);
  console.log(`- ${publicFilePath}`);
  console.log(`- ${docsFilePath}`);
}

generateDocx().catch((err) => {
  console.error("Error generating docx:", err);
  process.exit(1);
});
