# Module 4: Credits, Readiness Checklist & Placement

**Owner:** Member 4  
**Status:** ✅ Complete  
**Database Migrations:** 016-024

---

## 📋 Overview

Module 4 implements the **credit economy**, **placement readiness checklist**, **mentor verification system**, and **placement eligibility determination** for the Communication Readiness Platform.

### Core Responsibilities

1. **Credit System** - Student credit accounts with immutable ledger
2. **Checklist Management** - Program-scoped placement criteria
3. **Mentor Verification** - Faculty sign-off workflow with scope guards
4. **Placement Eligibility** - Automated eligibility calculation with scoring model

---

## 🗄️ Database Tables (7 tables)

### Credits Schema (3 tables)
- `credit_accounts` - One account per student with current balance
- `credit_transactions` - Immutable append-only transaction ledger
- `credit_policies` - Scope-based credit rules (institution/program/subdivision)

### Placement Schema (4 tables)
- `checklist_items` - Required placement criteria per program
- `checklist_progress` - Student completion status (PENDING/IN_PROGRESS/COMPLETED/FAILED)
- `mentor_verifications` - Mentor sign-off records (PROFILE/CHECKLIST types)
- `placement_eligibility` - Calculated eligibility with scoring model

---

## 🔑 Key Features

### 1. Credit Economy

**CreditService** (`credits.service.ts`)
- `consume()` - Deduct credits with SELECT FOR UPDATE locking
- `earn()` - Award credits after assessment completion
- `getBalance()` - Query current balance
- Idempotency via unique `idempotency_key` column
- Balance validation: `balance >= 0` enforced at DB level

**Event Handlers** (`credits.handlers.ts`)
- `USER_REGISTERED` → Create account with initial balance from policy
- `ATTEMPT_COMPLETED` → Award credits + trigger eligibility recalculation

**API Endpoints**
```
GET  /api/credits/balance/:studentId       - View credit balance
GET  /api/credits/transactions/:studentId  - Transaction history
```

### 2. Checklist Management

**ChecklistService** (`checklist/checklist.service.ts`)
- CRUD operations for checklist items
- CSV bulk import with validation
- Duplicate name detection within program scope
- Program/subdivision scoping

**ProgressService** (`checklist/progress.service.ts`)
- Status-based tracking (PENDING → IN_PROGRESS → COMPLETED)
- Toggle item completion
- Emits `CHECKLIST_ITEM_TOGGLED` event
- Automatic eligibility recalculation

**API Endpoints**
```
GET    /api/checklist                      - List all items
GET    /api/checklist/:id                  - Get specific item
POST   /api/checklist                      - Create item (ADMIN)
PUT    /api/checklist/:id                  - Update item (ADMIN)
DELETE /api/checklist/:id                  - Soft delete (ADMIN)
POST   /api/checklist/import-csv           - Bulk import (ADMIN)
GET    /api/checklist/my-progress          - Student progress
POST   /api/checklist/:itemId/toggle       - Toggle completion (STUDENT)
GET    /api/checklist/mentee/:studentId    - Mentor view mentee (MENTOR)
```

### 3. Mentor Verification

**VerificationService** (`verifications/verification.service.ts`)
- Approve/reject verification requests
- **Scope guard:** Verifies mentor is assigned to student via `student_mentor_assignments`
- Updates linked `checklist_progress` on approval
- Emits `MENTOR_VERIFIED` event
- Transaction-based updates

**Verification Types**
- `PROFILE` - General profile verification
- `CHECKLIST` - Specific checklist item sign-off

**API Endpoints**
```
GET  /api/verifications/pending            - Mentor's pending queue
POST /api/verifications/request            - Student requests sign-off
POST /api/verifications/:id/approve        - Approve (MENTOR)
POST /api/verifications/:id/reject         - Reject with notes (MENTOR)
```

### 4. Placement Eligibility

**EligibilityService** (`placement/eligibility.service.ts`)
- Weighted scoring model: `total_score = (checklist * 0.4) + (performance * 0.6)`
- Reads from `performance_profiles` (M3's table)
- Reads from `checklist_progress` (M4's table)
- Configurable weights and thresholds

**Eligibility Rules**
1. All required checklist items must be COMPLETED (100%)
2. `total_score >= threshold_score` (default: 60.0)

**Default Configuration** (from `eligibility.types.ts`)
```typescript
{
  checklistWeight: 0.4,      // 40% weight
  performanceWeight: 0.6,    // 60% weight
  thresholdScore: 60.0,      // Minimum score
  requireAllChecklist: true  // Must complete all required items
}
```

**API Endpoints**
```
GET  /api/placement-eligibility/:studentId             - Get eligibility
POST /api/placement-eligibility/:studentId/recalculate - Force recalc (ADMIN)
GET  /api/placement-eligibility/eligible-students      - List all eligible (ADMIN)
```

---

## 🎯 Event Flow

### Credit Account Creation
```
USER_REGISTERED event
  → CreditService creates credit_accounts row
  → Initial balance from credit_policies (scope hierarchy)
  → Records EARN transaction with idempotency_key = 'initial-{studentId}'
```

### Assessment Completion → Credits + Eligibility
```
ATTEMPT_COMPLETED event
  → CreditService.earn() awards credits
  → Idempotency key: 'earn-attempt-{attemptId}'
  → EligibilityService.recalculate(studentId)
```

### Checklist Toggle → Eligibility
```
Student toggles checklist item
  → ProgressService.toggleItem()
  → If SKILLS category → status = IN_PROGRESS (requires mentor)
  → Else → status = COMPLETED
  → Emits CHECKLIST_ITEM_TOGGLED
  → EligibilityService.recalculate(studentId)
```

### Mentor Verification → Eligibility
```
Mentor approves verification
  → VerificationService.approve()
  → Scope guard checks student_mentor_assignments
  → Updates mentor_verifications.status = VERIFIED
  → Updates checklist_progress.status = COMPLETED (if checklist type)
  → Emits MENTOR_VERIFIED
  → EligibilityService.recalculate(studentId)
```

---

## 🔒 Authorization & Scope Guards

### Credit Balance
- **STUDENT**: Own balance only (validated via `org.students.user_id`)
- **Staff roles**: Any student

### Checklist Progress
- **STUDENT**: Own progress only (`/my-progress`)
- **FACULTY_MENTOR**: Assigned mentees only (via `student_mentor_assignments`)
- **ADMIN**: All students

### Mentor Verification
- **Approve/Reject**: Mentor must be assigned to student (scope guard in service)
- Uses `student_mentor_assignments.is_active = true` for validation

### Placement Eligibility
- **STUDENT**: Own eligibility only
- **FACULTY_MENTOR**: Assigned mentees only
- **ADMIN**: All students

---

## 📊 Database Schema Relationships

```
org.students (M1)
    ├── (1:1) credit_accounts
    │       └── (1:N) credit_transactions [immutable]
    │
    ├── (1:N) checklist_progress
    │       └── (1:1) mentor_verifications [optional]
    │
    └── (1:1) placement_eligibility

checklist_items (program-scoped)
    └── (1:N) checklist_progress

student_mentor_assignments (M1)
    └── Used by VerificationService for scope guard
```

---

## 🧪 Configuration & Defaults

### NEEDS-CONFIRMATION Items

These defaults are documented but should be configurable:

1. **Initial Credit Balance**: 50 credits (from `credit_policies.initial_credit_amount`)
2. **Reward per Assessment**: 10 credits (from `credit_policies.reward_ceiling`)
3. **Eligibility Threshold**: 60.0 total score
4. **Eligibility Weights**: 40% checklist, 60% performance
5. **Verification Required Categories**: `SKILLS` category items require mentor sign-off

### Checklist Categories
```typescript
'RESUME' | 'SKILLS' | 'ASSESSMENTS' | 'BEHAVIOR' | 'OTHER'
```

**SKILLS** category requires mentor verification by default.

---

## 🚀 API Response Format

### Success
```json
{
  "data": { ... }
}
```

### Error
```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Insufficient credits",
    "details": {}
  }
}
```

### HTTP Status Codes
- `200` - Success (GET, PUT)
- `201` - Created (POST)
- `204` - Deleted (DELETE)
- `400` - Validation error
- `401` - Unauthenticated
- `402` - **Insufficient credits** (special code)
- `403` - Forbidden (scope violation)
- `404` - Not found
- `409` - Conflict (duplicate)

---

## 📝 CSV Import Format

Endpoint: `POST /api/checklist/import-csv`

**Request Body:**
```json
{
  "programId": "uuid",
  "subdivisionId": "uuid or null",
  "csvData": "name,description,category,max_score,weight,is_required\n..."
}
```

**CSV Format:**
```csv
name,description,category,max_score,weight,is_required
Upload resume,Upload latest resume to profile,RESUME,100,1.0,true
Complete mock interview,Score ≥ 60 in MOCK_INTERVIEW,ASSESSMENTS,100,1.5,true
Get mentor sign-off,Mentor reviews communication score,SKILLS,100,2.0,true
```

**Response:**
```json
{
  "data": {
    "imported": 3,
    "skipped": 0,
    "errors": []
  }
}
```

---

## 🔧 Idempotency Patterns

All credit operations use deterministic idempotency keys:

```typescript
// Initial credit grant
idempotencyKey = `initial-${studentId}`

// Earning credits after attempt
idempotencyKey = `earn-attempt-${attemptId}`

// Consuming credits before attempt (M2's responsibility)
idempotencyKey = `consume-attempt-${attemptId}`
```

The `credit_transactions.idempotency_key` column has a **UNIQUE** constraint, preventing duplicate transactions even if the operation is retried.

---

## 📦 File Structure

```
backend/src/modules/
├── credits/
│   ├── credits.service.ts        - Real implementation
│   ├── credits.service.stub.ts   - Stub for M2
│   ├── credits.handlers.ts       - Event handlers
│   ├── credits.controller.ts     - HTTP controllers
│   └── credits.routes.ts         - Route definitions
│
├── checklist/
│   ├── checklist.types.ts        - Types & Zod schemas
│   ├── checklist.repository.ts   - SQL queries
│   ├── checklist.service.ts      - Business logic
│   ├── checklist.controller.ts   - HTTP controllers
│   ├── checklist.routes.ts       - Route definitions
│   ├── progress.types.ts         - Progress types
│   ├── progress.repository.ts    - Progress queries
│   └── progress.service.ts       - Progress logic
│
├── verifications/
│   ├── verification.types.ts     - Verification types
│   ├── verification.repository.ts- SQL queries
│   ├── verification.service.ts   - Business logic + scope guards
│   ├── verification.controller.ts- HTTP controllers
│   └── verification.routes.ts    - Route definitions
│
└── placement/
    ├── eligibility.types.ts      - Eligibility types + config
    ├── eligibility.repository.ts - SQL queries
    ├── eligibility.service.ts    - Scoring model
    ├── eligibility.controller.ts - HTTP controllers
    └── eligibility.routes.ts     - Route definitions
```

---

## 🔗 Dependencies

### Module 4 Depends On:
- **M1 (Auth)**: `authenticate`, `requireRole`, `student_mentor_assignments`
- **M2 (Assessment)**: `ATTEMPT_COMPLETED` event
- **M3 (Performance)**: `performance_profiles.overall_score` (read-only)

### Other Modules Depend On M4:
- **M2** uses `CreditService.consume()` before starting assessment attempts

---

## ✅ Implementation Checklist

- [x] Database migrations (016-024)
- [x] CreditService with idempotency
- [x] USER_REGISTERED event handler
- [x] ATTEMPT_COMPLETED event handler
- [x] ChecklistService with CSV import
- [x] ChecklistProgressService with status tracking
- [x] MentorVerificationService with scope guards
- [x] PlacementEligibilityService with scoring model
- [x] Credits API routes
- [x] Checklist API routes
- [x] Verification API routes
- [x] Placement eligibility API routes
- [x] Event handler registration in index.ts
- [x] Routes registered in routes/index.ts

---

## 🎯 Testing Recommendations

### Unit Tests
1. CreditService.consume() with concurrent calls (double-spend prevention)
2. CreditService idempotency (same key twice returns same result)
3. EligibilityService scoring formula
4. CSV import validation

### Integration Tests
1. Full credit flow: register → account created → consume → earn
2. Checklist toggle → eligibility recalculation
3. Mentor verification scope guard (non-assigned mentor rejected)
4. Eligibility calculation with missing performance_profiles

---

## 📌 Notes for Deployment

1. **Run migrations in order**: 016 → 024
2. **Seed initial credit policy**: Insert at least one `GLOBAL` scope policy with `initial_credit_amount`
3. **Event handlers**: Ensure `registerCreditEventHandlers()` is called in `index.ts` (already done)
4. **Performance profiles**: Module 4 reads from M3's `performance_profiles` table - ensure M3 is deployed first
5. **Mentor assignments**: Module 4 relies on M1's `student_mentor_assignments` for scope guards

---

**End of Module 4 Documentation**
