# spote-editor — Design

Datum: 2026-06-15
Status: Godkänd design, redo för implementationsplan

## Mål

En fristående, publicerbar React-komponent (`spote-editor`) som ger en stark redigeringsupplevelse i **två lägen**:

- **WYSIWYG** (Milkdown)
- **Raw markdown** (CodeMirror 6, synlig syntax)

Användaren ska känna igen sig i båda vyerna: samma meny-ytor och samma interaktioner i båda lägena. Editorn ska kännas stark men "inte vara i vägen".

Komponenten är fristående och appoberoende: all spote-specifik funktionalitet (not-sökning för länkar, ev. bilduppladdning) injiceras via callbacks. Utan callbacks fungerar editorn ändå, med rimliga defaults.

Relaterad bakgrund: spote-noten "Kravspec: delad slash-meny + CodeMirror 6 raw-editor" (cb375507-7988-4226-b97e-d64fc8b42dd6) beskriver motsvarande arkitektur som en *in-app*-uppgradering. Detta dokument lyfter samma princip till en *fristående modul*.

## Beslut (sammanfattning)

- Raw-läget visar markdown med **synlig syntax** (ingen live-preview-hybrid i v1). `**fet**` syns som text.
- Meny-ytor i v1: **slash-meny** + **markerings-bubbla**. Inget fast verktygsfält, ingen högerklicks-meny.
- "Skapa länk" stödjer **både** vanlig URL och länk till en annan spote-not (via injicerad sökning).
- WYSIWYG-motor: **Milkdown** (ProseMirror + remark — bäst markdown-trohet, redan känd i spote).
- Markdown-strängen är **gemensam källa** för båda lägena, så läges-toggle behåller innehållet.
- v1 hålls lätt men lätt utbyggbar. Bilduppladdning skjuts till nästa iteration.

## Publikt API

`SpoteEditor` är en **kontrollerad** komponent. Markdown-strängen ägs av värdappen.

```tsx
<SpoteEditor
  value={md}                 // markdown-sträng (kontrollerad källa)
  onChange={setMd}           // (md: string) => void

  mode={mode}                // 'wysiwyg' | 'raw' — VALFRI. Utelämnad => internt state + inbyggd toggle
  onModeChange={setMode}     // valfri

  onSearchNotes={fn}         // valfri: (query: string) => Promise<NoteHit[]> — för länk-till-not
  onResolveNoteHref={fn}     // valfri: (note: NoteHit) => string — hur en vald not blir en href/wikilink

  commands={...}             // valfri: utöka/override standardkommandolistan

  placeholder
  readOnly
  className
  autoFocus
/>
```

- `onUpload` (bilduppladdning, paste/drop) ingår **inte** i v1 men API:t reserveras konceptuellt för nästa iteration.
- Defaults när callbacks saknas: länk faller tillbaka till bara-URL; mode hanteras internt.
- Komponenten äger **ingen persistens** och sparar inget själv.

### Typer (utkast)

```ts
interface NoteHit { id: string; title: string; /* … */ }

interface SpoteEditorProps {
  value: string
  onChange: (md: string) => void
  mode?: 'wysiwyg' | 'raw'
  onModeChange?: (mode: 'wysiwyg' | 'raw') => void
  onSearchNotes?: (query: string) => Promise<NoteHit[]>
  onResolveNoteHref?: (note: NoteHit) => string
  commands?: CommandList            // härledd nyckeltyp, se nedan
  placeholder?: string
  readOnly?: boolean
  className?: string
  autoFocus?: boolean
}
```

## Arkitektur

Tre lager: ett skal, en delad motor-agnostisk kärna, och två tunna motor-adaptrar. Markdown-strängen binder ihop lägena.

```
<SpoteEditor> (skal)
  ├─ äger value/onChange (markdown), mode-toggle
  ├─ renderar aktiv motor + delade overlays
  │
  ├─ DELAD KÄRNA (vet inget om motorn) ── byggs en gång, används i båda lägena
  │    ├─ commands.ts        ren metadata: { id, label, icon, group, keywords }
  │    ├─ CommandMenu        slash-UI (portal/floating), filter, tangentnav, onSelect(commandId)
  │    ├─ SelectionBubble    bubbla: Fet · Kursiv · Kod · Skapa länk, onAction
  │    └─ LinkPopover        URL-fält + not-sökning (onSearchNotes/onResolveNoteHref)
  │
  ├─ MILKDOWN-ADAPTER (WYSIWYG)
  │    ├─ MilkdownEditor
  │    ├─ milkdownCommands   commandId -> ProseMirror-transaktion
  │    └─ slashPlugin        öppnar CommandMenu
  │
  └─ CODEMIRROR-ADAPTER (raw)
       ├─ CodeMirrorEditor
       ├─ cmCommands         commandId -> CM6-textredigering
       ├─ slashExtension     ViewPlugin: detektera /, mäta caret, öppna CommandMenu
       └─ wrapOnType         inputHandler för wrap-on-type
```

### Principer

- **commands.ts är enda källan** för kommando-metadata. Nyckeltypen härleds därifrån så att `milkdownCommands` och `cmCommands` måste täcka exakt samma nyckeluppsättning — en saknad handler ger **typfel**.
- **Samma React-komponenter** (`CommandMenu`, `SelectionBubble`, `LinkPopover`) renderas i båda lägena. Det är därifrån igenkänningen mellan vyerna kommer — inte från duplicerad kod.
- **Adaptrarna är tunna.** All UI-logik ligger i kärnan; adaptern översätter bara `commandId`/`action` till en motor-specifik redigering.
- Nya kommandon = en rad i `commands.ts` + en handler per adapter. Det är utbyggbarhetsmodellen.

### Föreslagen filstruktur

```
src/components/SpoteEditor/
  SpoteEditor.tsx            skal: value/mode, väljer motor, renderar overlays
  SpoteEditor.types.ts       props + NoteHit
  command-core/
    commands.ts              metadata-lista + härledd nyckeltyp
    CommandMenu.tsx          delad slash-UI
    SelectionBubble.tsx      delad bubbla
    LinkPopover.tsx          URL + not-sökning
    useCommandMenu.ts        öppen/stängd, query, valt index, position
  milkdown/
    MilkdownEditor.tsx
    milkdownCommands.ts
    slashPlugin.ts
  codemirror/
    CodeMirrorEditor.tsx
    cmCommands.ts
    slashExtension.ts
    wrapOnType.ts
```

## Beteenden

### Slash-meny
- Trigger: `/` i radstart eller efter whitespace.
- CM6: `ViewPlugin` mäter caret med `view.coordsAtPos` och öppnar `CommandMenu` som portal-overlay. **Inte** CM6:s inbyggda autocomplete (matchar inte Milkdowns utseende).
- Milkdown: motsvarande via slash-plugin.
- Medan menyn är öppen: text efter `/` blir query och filtrerar. Piltangenter/Enter/Esc/klick-utanför hanteras av `CommandMenu`; editorn ska inte sluka dem.
- Vid val: `/query`-fragmentet tas bort, `commands[commandId]`-handlern körs i aktiv adapter.
- Standardkommandon: rubrik 1–3, fet, kursiv, kod (inline), kodblock, punktlista, numrerad lista, citat, länk, avdelare.

### Markerings-bubbla
- Visas när text är markerad. Dubbelklick på ett ord är bara ett snabbt sätt att markera.
- Innehåll: Fet · Kursiv · Kod · Skapa länk.
- Samma `SelectionBubble`-komponent i båda lägena; varje action mappas via adaptern (Milkdown: PM-mark; CM6: wrap med markörtecken).

### Skapa länk
- Bubblan → `LinkPopover` med ett fält.
- Inmatad/klistrad URL → vanlig länk.
- Annars: `onSearchNotes(query)` anropas, not-träffar listas; vald not blir intern länk via `onResolveNoteHref`.
- Utan `onSearchNotes`: faller tyst tillbaka till enbart URL.

### Wrap-on-type (CM6)
- Markera + skriv ett wrap-tecken → omgärda selektionen istället för att ersätta; behåll markeringen.
- Tabell: `*`→`*sel*`, dubbel-`*`→`**sel**`, `_`→`_sel_`, `` ` ``→`` `sel` ``, `~`→`~sel~`.
- Egen `EditorView.inputHandler` med `state.changeByRange` för multi-selektion. **Inte** `closeBrackets` (täcker inte `*`/`_`).
- WYSIWYG: Milkdown ger motsvarande naturligt.

### Läges-toggle
- Inbyggd knapp i skalet växlar wysiwyg ⇄ raw.
- Vid växling serialiseras/parsas samma markdown-sträng → innehållet följer med.
- Markörposition får en enkel v1 (behöver inte bevaras exakt).

## Paketering & styling

- Vite library-mode + `vite-plugin-dts`, React som peer-dep (befintlig setup).
- Nya beroenden: Milkdown-paket (ProseMirror/remark) + CM6-paket (`@codemirror/state`, `view`, `commands`, `lang-markdown`, `language`).
- Två motorer = märkbar bundle. Exporteras så att lägena går att koda-splitta senare (utbyggbart, inte v1-krav).
- Styling via `spote-editor/styles` med CSS-variabler så värdappen kan tema bubbla, slash-meny och båda lägena enhetligt.

## Test (vitest)

Tyngdpunkt på den delade kärnan (motor-oberoende, lättast att testa):
- `commands.ts`-typhärledning (saknad handler ⇒ typfel).
- `CommandMenu`: filtrering, tangentnavigering, Esc/klick-utanför.
- Wrap-on-type-tabellen (inkl. dubbel-`*`, multi-selektion, behållen markering).
- Markdown round-trip wysiwyg ⇄ raw (samma sträng in/ut).
- Adaptrarna: tunnare integrationstest.

## Avgränsningar (v1)

- Ingen live-preview-hybrid i raw-läget (synlig syntax).
- Ingen bilduppladdning (`onUpload`/paste/drop) — nästa iteration.
- Ingen egen persistens.
- Enkel caret-hantering vid toggle; enkel positionering av meny vid radslut/scroll.

## Acceptanskriterier

- Slash öppnar samma meny (visuellt och innehållsmässigt) i både Milkdown och CM6.
- Filtrering medan man skriver; piltangenter navigerar; Enter väljer; Esc/klick-utanför stänger.
- Markering (inkl. via dubbelklick) visar bubblan i båda lägena med Fet/Kursiv/Kod/Skapa länk.
- "Skapa länk" hanterar både URL och not-sökning (när `onSearchNotes` finns); faller tillbaka till URL annars.
- Wrap-on-type fungerar för `*`, `_`, `` ` ``, `~` med markering; `**` nås via dubbel-`*`; selektionen behålls.
- Raw-läget visar rå markdown (ingen dold/renderad syntax).
- Läges-toggle behåller innehållet.
- `value`/`onChange` styr innehållet; komponenten sparar inget själv.

## Öppna frågor (finputsas under implementation)

- Exakt trigger-regel för `/` (endast radstart eller även efter whitespace).
- Om `~` ska wrappa till `~` eller `~~` som default.
- Exakt form på `NoteHit` och `onResolveNoteHref` (wikilink vs vanlig href).
