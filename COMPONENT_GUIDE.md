# DB Explorer - Component Guide

## Component Inventory

### 1. Layout Components

#### Header
**Purpose**: Top navigation bar with app title and connection status  
**Location**: `app/components/Header.tsx`  
**Props**:
- `isConnected: boolean` - Database connection status
- `databaseName?: string` - Current database name

**Visual**:
- Height: 64px
- Background: white
- Border bottom: gray-200
- Contains: Logo/title (left), connection status badge (right)

---

#### Sidebar
**Purpose**: Navigation and table list  
**Location**: `app/components/Sidebar.tsx`  
**Props**:
- `tables: string[]` - List of database tables
- `selectedTable?: string` - Currently selected table
- `onTableSelect: (table: string) => void` - Table selection handler

**Visual**:
- Width: 240px
- Background: gray-50
- Border right: gray-200
- Sticky positioning
- Scrollable content area

---

#### MainContent
**Purpose**: Primary content area wrapper  
**Location**: `app/components/MainContent.tsx`  
**Props**:
- `children: ReactNode`

**Visual**:
- Flex: 1 (takes remaining space)
- Padding: 24px
- Background: white

---

### 2. Connection Components

#### ConnectionForm
**Purpose**: Database connection input form  
**Location**: `app/components/ConnectionForm.tsx`  
**Props**:
- `onConnect: (config: DBConfig) => void` - Submit handler
- `isConnecting: boolean` - Loading state

**Fields**:
- Host (text input)
- Port (number input)
- Database (text input)
- Username (text input)
- Password (password input)
- Connect button

**Visual**:
- Card layout
- Centered on page
- Max width: 480px
- Form validation states

---

#### ConnectionStatus
**Purpose**: Display current connection state  
**Location**: `app/components/ConnectionStatus.tsx`  
**Props**:
- `status: 'connected' | 'disconnected' | 'connecting'`
- `databaseName?: string`

**Visual**:
- Badge component
- Green for connected
- Gray for disconnected
- Yellow for connecting (with spinner)

---

### 3. Data Display Components

#### TableList
**Purpose**: Sidebar list of all database tables  
**Location**: `app/components/TableList.tsx`  
**Props**:
- `tables: string[]`
- `selectedTable?: string`
- `onSelect: (table: string) => void`

**Visual**:
- List items with hover states
- Active state for selected table
- Search/filter input at top
- Grouped by schema (optional)

---

#### DataTable
**Purpose**: Display table data in grid format  
**Location**: `app/components/DataTable.tsx`  
**Props**:
- `columns: Column[]` - Column definitions
- `data: any[]` - Row data
- `isLoading: boolean`
- `onSort?: (column: string) => void`

**Visual**:
- Fixed header row
- Striped rows (alternating bg)
- Hover highlight on rows
- Column headers clickable for sorting
- Scrollable horizontal/vertical

**Features**:
- Pagination controls
- Column sorting indicators
- Loading skeleton state
- Empty state message

---

#### TableSchema
**Purpose**: Show table structure/metadata  
**Location**: `app/components/TableSchema.tsx`  
**Props**:
- `columns: ColumnInfo[]` - Column metadata
- `indexes?: Index[]` - Table indexes
- `constraints?: Constraint[]` - Table constraints

**Visual**:
- Collapsible panel
- Table format showing:
  - Column name
  - Data type
  - Nullable
  - Default value
  - Primary key indicator

---

#### QueryEditor
**Purpose**: SQL query input and execution  
**Location**: `app/components/QueryEditor.tsx`  
**Props**:
- `onExecute: (query: string) => void`
- `isExecuting: boolean`

**Visual**:
- Textarea with monospace font
- Syntax highlighting (optional)
- Execute button
- Query history dropdown (optional)

---

### 4. UI Primitives

#### Button
**Purpose**: Reusable button component  
**Location**: `app/components/ui/Button.tsx`  
**Variants**:
- `primary` - Blue background
- `secondary` - Gray background
- `danger` - Red background
- `ghost` - Transparent background

**Sizes**:
- `sm` - Small padding, text-sm
- `md` - Medium padding (default)
- `lg` - Large padding

**Props**:
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'`
- `size?: 'sm' | 'md' | 'lg'`
- `disabled?: boolean`
- `isLoading?: boolean`
- `onClick?: () => void`

---

#### Input
**Purpose**: Form input field  
**Location**: `app/components/ui/Input.tsx`  
**Types**:
- text
- number
- password
- search

**Props**:
- `type?: string`
- `label?: string`
- `placeholder?: string`
- `error?: string`
- `value: string`
- `onChange: (value: string) => void`

**Visual**:
- Label above input
- Border on all sides
- Focus ring (blue)
- Error state (red border + message)

---

#### Card
**Purpose**: Container with elevation  
**Location**: `app/components/ui/Card.tsx`  
**Props**:
- `children: ReactNode`
- `title?: string`
- `className?: string`

**Visual**:
- White background
- Rounded corners (lg)
- Shadow (md)
- Padding (lg)
- Optional header section

---

#### Badge
**Purpose**: Small status indicator  
**Location**: `app/components/ui/Badge.tsx`  
**Variants**:
- `success` - Green
- `warning` - Yellow
- `danger` - Red
- `info` - Gray

**Props**:
- `variant?: 'success' | 'warning' | 'danger' | 'info'`
- `children: ReactNode`

**Visual**:
- Small, rounded pill
- Uppercase text
- Semi-bold font

---

#### Spinner
**Purpose**: Loading indicator  
**Location**: `app/components/ui/Spinner.tsx`  
**Sizes**:
- `sm` - 16px
- `md` - 24px
- `lg` - 32px

**Visual**:
- Circular spinner
- Blue color (primary)
- Smooth animation

---

#### Modal
**Purpose**: Overlay dialog  
**Location**: `app/components/ui/Modal.tsx`  
**Props**:
- `isOpen: boolean`
- `onClose: () => void`
- `title?: string`
- `children: ReactNode`

**Visual**:
- Centered on screen
- Dark backdrop overlay
- White card with shadow
- Close button (X) in top right

---

### 5. Utility Components

#### EmptyState
**Purpose**: Display when no data available  
**Location**: `app/components/EmptyState.tsx`  
**Props**:
- `icon?: ReactNode`
- `title: string`
- `description?: string`
- `action?: ReactNode` - Optional CTA button

**Visual**:
- Centered vertically/horizontally
- Gray icon
- Large title
- Muted description

---

#### ErrorMessage
**Purpose**: Display error states  
**Location**: `app/components/ErrorMessage.tsx`  
**Props**:
- `message: string`
- `onRetry?: () => void`

**Visual**:
- Red border card
- Red icon
- Error message text
- Optional retry button

---

#### Pagination
**Purpose**: Navigate through pages of data  
**Location**: `app/components/Pagination.tsx`  
**Props**:
- `currentPage: number`
- `totalPages: number`
- `onPageChange: (page: number) => void`

**Visual**:
- Previous/Next buttons
- Page numbers (with ellipsis for many pages)
- Current page highlighted

---

## Component Composition Examples

### Main App Layout
```
<div className="flex h-screen">
  <Sidebar tables={tables} onTableSelect={setSelectedTable} />
  <div className="flex-1 flex flex-col">
    <Header isConnected={true} databaseName="mydb" />
    <MainContent>
      {/* Page content */}
    </MainContent>
  </div>
</div>
```

### Connection Page
```
<div className="min-h-screen bg-gray-50 flex items-center justify-center">
  <ConnectionForm onConnect={handleConnect} />
</div>
```

### Table View
```
<MainContent>
  <div className="flex justify-between items-center mb-6">
    <h1 className="text-2xl font-bold">users</h1>
    <Button variant="secondary">Export</Button>
  </div>
  
  <TableSchema columns={schemaInfo} />
  
  <DataTable 
    columns={columns} 
    data={rows} 
    isLoading={loading}
  />
  
  <Pagination 
    currentPage={page} 
    totalPages={totalPages}
    onPageChange={setPage}
  />
</MainContent>
```

### Query Editor View
```
<MainContent>
  <Card title="SQL Query">
    <QueryEditor onExecute={runQuery} />
  </Card>
  
  {results && (
    <Card title="Results" className="mt-4">
      <DataTable columns={resultColumns} data={results} />
    </Card>
  )}
</MainContent>
```

## File Structure
```
app/components/
├── ui/                    # Primitive components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Spinner.tsx
│   └── Modal.tsx
├── Header.tsx
├── Sidebar.tsx
├── MainContent.tsx
├── TableList.tsx
├── ConnectionForm.tsx
├── ConnectionStatus.tsx
├── DataTable.tsx
├── TableSchema.tsx
├── QueryEditor.tsx
├── EmptyState.tsx
├── ErrorMessage.tsx
└── Pagination.tsx
```

## Implementation Priority

### Phase 1 (Core UI)
1. Button, Input, Card (primitives)
2. Header, Sidebar, MainContent (layout)
3. ConnectionForm
4. EmptyState

### Phase 2 (Data Display)
5. TableList
6. DataTable
7. Pagination
8. Spinner, Badge

### Phase 3 (Advanced)
9. TableSchema
10. QueryEditor
11. Modal
12. ErrorMessage

## Design Tokens (Optional Enhancement)

Consider creating a `app/styles/tokens.ts` file:
```typescript
export const colors = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#ca8a04',
  danger: '#dc2626',
  // ... etc
}

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  // ... etc
}
```
