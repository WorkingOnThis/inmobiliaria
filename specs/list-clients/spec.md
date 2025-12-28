# Feature Specification: List Clients

**Created**: 2025-12-27

## User Scenarios & Testing

### User Story 1 - View Paginated Client List (Priority: P1)

As an administrator, I want to see a list of all clients in a table so that I can easily browse them. I want to see only a certain number of clients per page to avoid long loading times.

**Why this priority**: Essential for managing clients once their number grows. It's the primary way to access client information.

**Independent Test**: Navigate to `/clientes`, verify that a table appears with clients, and pagination controls allow switching pages.

**Acceptance Scenarios**:

1. **Scenario**: Initial load of clients
   - **Given** There are 25 clients in the database
   - **When** I navigate to `/clientes`
   - **Then** I see the first 10 clients in a table
   - **And** I see pagination controls indicating 3 pages

2. **Scenario**: Navigating between pages
   - **Given** I am on the first page of the clients list
   - **When** I click "Siguiente" (Next)
   - **Then** I see the next 10 clients
   - **And** the current page indicator shows "2"

3. **Scenario**: Empty state
   - **Given** there are no clients in the database
   - **When** I navigate to `/clientes`
   - **Then** I see an empty table with a message "No se encontraron clientes"

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a `GET /api/clients` endpoint that supports `page` and `pageSize` parameters.
- **FR-002**: API response MUST include the list of clients and the total count of records.
- **FR-003**: Frontend MUST display clients in a responsive table using shadcn components.
- **FR-004**: Frontend MUST implement pagination controls (Previous, Next, Page Numbers).
- **FR-005**: System MUST validate that the user is authenticated and has permissions to view clients.

### Key Entities

- **Client**: Name, surname, type, phone, email, DNI.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The client list loads in under 1 second for 1000+ total records (due to server-side pagination).
- **SC-002**: Users can navigate to any page of results with at most 2 clicks from the current page.

