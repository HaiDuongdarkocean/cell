---
name: sa
description: Software architecture handbook - visual-first durable concepts (system, element, boundary, hard-to-change decisions, tradeoffs, ISO 25010). Use when discussing, evaluating, or learning software architecture. Not for writing code or project specs.
---

# SA — Software Architecture Handbook

## The big picture

```
┌────────────────────────────────────────────────────────────────┐
│                            PURPOSE                             │
│                    why the system exists                       │
└──────────────────────────────┬─────────────────────────────────┘
                               │ organizes
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                            SYSTEM                              │
│                                                                │
│           ┌─────────┐     boundary     ┌─────────┐             │
│           │ element │ ═══ contract ═══ │ element │             │
│           └─────────┘                  └─────────┘             │
│                                                                │
│      inside element = free       crossing boundary = cost      │
└──────────────────────────────┬─────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │ ARCHITECTURE │ │  QUALITIES   │ │  TRADEOFFS   │
       |──────────────| |──────────────| |──────────────|
       │ decisions    │ │ ISO 25010    │ │ no maximums  │
       │ hard to      │ │ 9 traits     │ │ only         │
       │ change       │ │              │ │ "enough"     │
       └──────────────┘ └──────────────┘ └──────────────┘
```

Three questions run the whole discipline:

```
Q1 SHAPE   → What are the parts, and where are the boundaries?
Q2 PRICE   → Which decision costs most to change later?
Q3 BALANCE → Which quality do we trade for which, for what goal?
```

---

## Chapter 1 — System

```
      PILE (not a system)              SYSTEM

              ☀                         ☀
                                     
         ●    ○    ●                 ╭───●───╮
      rocks near a star             ╱  orbit  ╲ 
          parts only                ╲         ╱ 
                                     ╰───●───╯  
                             parts + relations + purpose(stable orbits)
```

**Definition (ISO/IEC 15288):** system = `elements + interaction + purpose`. Missing one → a pile.

**Etymology:** Greek *sýstēma* = "things made to stand together" — originally the name of a musical scale. Notes alone are not a scale; notes + the gaps between them are.

**Biology check:**
- ✗ BAD: a bag of organs — heart, liver, lungs in a bucket.
- ✓ GOOD: a body — same organs, connected by vessels and nerves, toward the purpose "stay alive".

**Memory rule:** what counts as *element* vs *system* is decided by the observer's purpose. A cell is a system to a biologist, an element to a doctor. First act of any architect: draw the circle — pick the **system of interest**. 

---

## Chapter 2 — Element and boundary

```
            ┌─────────────────────────────┐
            │           element           │
            │       inside = free         │
            └──────────────┬──────────────┘
                           │ boundary = door with a contract
                           │ crossing costs 4 currencies:
                           │                  · serialization — only data crosses
                           ▼                  · contract — shapes must match
            ┌─────────────────────────────┐   · trust — re-check all
            │         next element        │   · ownership — whose side
            └─────────────────────────────┘
```

**Element** = a block you treat as one thing: own job, own owner. You ask *what* it does, never *how*.

**Boundary** = the seam between blocks. Inside is free; crossing always costs.

**Why it matters first:** boundaries set the price of every future decision.
- ✗ BAD: bug in a shared **contract** → fix both sides, in order, versioned. Like an organ transplant — blood type must match or the body rejects it.
- ✓ GOOD: bug inside one element → fix one place. Like a cut on skin — the rest of the body never notices.

---

## Chapter 3 — Architecture

```
          HOUSE                            SOFTWARE

    ┌───────────────┐           ┌──────────────────────────┐
    │     roof      │           │ sync model, data format, │  hard to change
    │  ┌─────────┐  │  bearing  │ boundaries               │  = ARCHITECTURE
    │  │  walls  │  │  walls    ├──────────────────────────┤  
    │  └─────────┘  │  = bones  │ colors, names, helpers   │  cheap to change
    │    paint      │           │                          │  = DESIGN
    └───────────────┘           └──────────────────────────┘  
```

**Definition (Bass):** architecture = the structure(s) of the system — elements + their visible properties + their relationships.

**Working form:** architecture = *the decisions that are hard to change*.

**Biology check:** a lizard can drop its tail (cheap, by design) but cannot swap its skeleton (expensive, locked at birth). Skeleton = architecture. Tail = design detail.

---

## Chapter 4 — The three canonical questions

```
       ┌──────────────────────────────────┐
       │ Q1 SHAPE — parts? boundaries?    │
       └────────────────┬─────────────────┘
        boundaries show │ where cost lives
                        ▼ 
       ┌──────────────────────────────────┐
       │ Q2 PRICE — costliest to change?  │
       └────────────────┬─────────────────┘
                        │ forces choice
                        ▼
       ┌──────────────────────────────────┐
       │ Q3 BALANCE — trade what for what │
       └──────────────────────────────────┘
```

- ✗ BAD answer to Q3: "everything will be good" → no decision, only a wish list.
- ✓ GOOD: "we take slower reads to get zero data loss — users trust us with their dictionary."

---

## Chapter 5 — Core law: tradeoffs, not maximums

```
      ┌──────────┐                    ┌──────────┐
      │ security │════════════════════│  speed   │
      └──────────┘          ▲         └──────────┘
                          pivot
            push one end up — the other drops
```

**Quality attributes** fight each other: security ↔ usability, performance ↔ maintainability, consistency ↔ availability (**CAP theorem**). The real question:

> **"Correct/safe/fast *enough* — for which business goal, at what cost?"**

**Biology check:**
- ✗ BAD: an animal that is fastest AND strongest AND longest-living — does not exist. Nature only ships tradeoffs.
- ✓ GOOD: a camel trades speed for water storage — its environment is the desert. The business goal picks which side of the seesaw to sit on.

Whoever lists qualities without naming the tradeoff is reading a table of contents, not architecting.

---

## Chapter 6 — The four duties (iSAQB)

```
      ┌─────────────┐           ┌─────────────┐
      │ 1 CLARIFY   │──────────►│  2 DECIDE   │
      │ stakeholder │           │ structure   │
      │ needs       │           └──────┬──────┘
      └─────────────┘                  │
            ▲                          ▼
      ┌─────┴───────┐           ┌─────────────┐
      │ 4 EVALUATE  │◄──────────│  3 EXPLAIN  │
      │ ATAM + impl │           │ views + ADR │
      └─────────────┘           └─────────────┘
              a loop — feedback restarts it
```

Not only technical: negotiation with **stakeholders**, documentation (**ADR**), evaluation (**ATAM**), and org shape (**Conway's law**: the system mirrors the team that built it) are inside the job.

---

## Chapter 7 — ISO/IEC 25010: the 9 quality attributes

```
      ┌────────────────┬────────────────┬────────────────┐
      │ functional     │ performance    │ compatibility  │
      │ suitability    │ efficiency     │                │
      ├────────────────┼────────────────┼────────────────┤
      │ interaction    │ reliability    │ security       │
      │ capability     │                │                │
      ├────────────────┼────────────────┼────────────────┤
      │ maintainability│ flexibility    │ safety         │
      │                │                │                │
      └────────────────┴────────────────┴────────────────┘
```

Blind spot when listing from memory: people forget **reliability** (kills products more often than security) and **usability** (decides whether customers come at all).

---

## Keyword glossary

| keyword | one-line meaning |
|---|---|
| element | a block with one job and one owner |
| boundary | the seam between elements; crossing it costs |
| contract | the agreed data shape across a boundary |
| serialization | turning objects into portable data for a boundary |
| trust boundary | where data enters unchecked territory — re-validate |
| ownership | which side/team/version/deploy owns each element |
| system of interest | the circle the observer draws: what counts as "the system" |
| coupling | how strongly two elements depend on each other |
| quality attribute | a measurable "-ility" of the system (ISO 25010) |
| NFR | non-functional requirement — a stated quality target |
| tradeoff | giving up one quality to buy another |
| CAP theorem | consistency ↔ availability under network partition |
| ATAM | Architecture Tradeoff Analysis Method — structured evaluation |
| ADR | Architecture Decision Record — one written decision + why |
| Conway's law | system structure mirrors the org that builds it |
| deployment unit | what ships together as one piece |

## The map (whole field)

```
Software architecture
├── Định nghĩa: structure, elements, decisions "hard to change"
├── Quality attributes: ISO 25010, quality attribute scenarios
├── Tradeoff: CAP, consistency models, ATAM evaluation
├── Views: C4 model, arc42, architectural documentation, ADR
├── Styles/patterns: layered, hexagonal, event-driven, microservices, distributed systems
├── Data: consistency, transactions, messaging, schema evolution
├── Org: Conway's law, team topology, governance, fitness functions
└── Economics: cost of change, TCO, reversible vs irreversible decisions
```

## Sources

- ISO/IEC 15288 + ISO/IEC/IEEE 42010 — system & architecture definitions
- Bass, Clements, Kazman — *Software Architecture in Practice*
- ISO/IEC 25010:2023 — product quality model
- iSAQB CPSA Foundation curriculum — duties of the architect
- Dori, *What Is A System* — etymology
