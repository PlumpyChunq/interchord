# Graph Refactor Plan (Web App)

> **Scope:** Next.js web app only. For native app graph, see `NATIVE_APP_CONVERSION_PLAN.md`.
> **Status:** Phase 1 In Progress | **Last Updated:** 2025-12-10

## Goal

Upgrade the Cytoscape.js graph from static layout to live physics-based interaction.

---

## Phase 1: Live Physics with Cola Layout

### Task 1.1: Enable Cola Layout

**File:** `src/components/graph/artist-graph.tsx`

- [ ] Import and register `cytoscape-cola` (already installed)
- [ ] Replace current layout config with cola layout
- [ ] Set `infinite: true` for continuous simulation
- [ ] Set `animate: true` for smooth transitions

**Code changes:**
```typescript
// Add to imports
import cola from 'cytoscape-cola';
cytoscape.use(cola);

// Replace layout config
const layout = cy.layout({
  name: 'cola',
  animate: true,
  infinite: true,
  fit: true,
  padding: 30,
  nodeSpacing: () => 20,
  edgeLength: () => 150,
});
```

### Task 1.2: Implement Drag Interaction

**File:** `src/components/graph/artist-graph.tsx`

- [ ] Add `drag` event handler to lock node position
- [ ] Add `free` event handler to unlock node
- [ ] Test: dragging a node causes others to reflow

**Code changes:**
```typescript
cy.on('drag', 'node', (evt) => evt.target.lock());
cy.on('free', 'node', (evt) => evt.target.unlock());
```

### Task 1.3: Performance Safeguards

**File:** `src/components/graph/artist-graph.tsx`

- [ ] Add inactivity timeout to pause simulation after 5s
- [ ] Resume simulation on user interaction
- [ ] Add node count warning at 200+ nodes

---

## Phase 2: Visual Enhancements

### Task 2.1: Node Images

**Files:** `src/components/graph/artist-graph.tsx`, `src/lib/graph/types.ts`

- [ ] Add `imageUrl` field to node data
- [ ] Use Cytoscape `background-image` style
- [ ] Add fallback: initials on colored circle

### Task 2.2: Edge Styling by Type

**File:** `src/components/graph/artist-graph.tsx`

- [ ] `member_of`: solid, 3px, blue
- [ ] `collaboration`: dashed, 2px, green
- [ ] `producer`: dotted, 2px, purple

### Task 2.3: Selection States

**File:** `src/components/graph/artist-graph.tsx`

- [ ] Hover: add glow effect (box-shadow via overlay-opacity)
- [ ] Selected: thick colored border
- [ ] Expanded: checkmark badge or distinct border style

### Task 2.4: Dark Background

**File:** `src/components/graph/artist-graph.tsx`, `src/app/globals.css`

- [ ] Change canvas background to dark navy (#0a1628)
- [ ] Ensure node/edge colors have sufficient contrast

---

## Codebase Impact

| File | Changes |
|------|---------|
| `src/components/graph/artist-graph.tsx` | Layout config, event handlers, styles |
| `src/lib/graph/types.ts` | Add `imageUrl` to node type |
| `src/lib/graph/builder.ts` | Populate `imageUrl` from API response |
| `src/app/globals.css` | Dark background styles |
| `package.json` | No changes (cola already installed) |

### API/Data Model Changes

- **Node data** gains optional `imageUrl: string`
- No breaking changes to existing interfaces

### Test Impact

- [ ] Update `src/lib/graph/builder.test.ts` if it exists
- [ ] Manual testing required for physics behavior

---

## Progress Checklist

### Phase 1: Live Physics
- [ ] 1.1 Cola layout enabled
- [ ] 1.2 Drag interaction working
- [ ] 1.3 Performance safeguards added
- [ ] **Phase 1 Complete**

### Phase 2: Visual Enhancements
- [ ] 2.1 Node images rendering
- [ ] 2.2 Edge styling by type
- [ ] 2.3 Selection states working
- [ ] 2.4 Dark background applied
- [ ] **Phase 2 Complete**

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-10 | Phase 1 first (cola layout) | Lower risk than full rewrite |
| TBD | Phase 2 start | After Phase 1 validated |
| TBD | React-force-graph evaluation | Only if cola doesn't meet needs |

---

## Contingency: Phase 3 (react-force-graph)

If Phase 1 doesn't achieve the desired feel:

- Replace `artist-graph.tsx` entirely
- Use `react-force-graph-2d` or `react-force-graph-3d`
- Benefits: WebGL rendering, built-in physics, particle effects
- Cost: Full component rewrite

---

## Related Documents

- `NATIVE_APP_CONVERSION_PLAN.md` – Native app graph (SpriteKit)
- `APPLE_DEV_PERSONA.md` – Coding standards (for native work)
