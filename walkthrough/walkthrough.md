# 🚀 Flashcards Extended: DNA Sync & Anti-Clonazione
L'architettura per prevenire la proliferazione dei modelli `Obsidian-basic+` è stata completamente implementata in entrambi i plugin.

## 🛠️ Cosa è stato realizzato

### 1. Sincronizzazione Attiva da Desktop
Durante ogni esportazione dal Desktop (`flashcards-extended`), il plugin usa **AnkiConnect** per farsi restituire i *Model ID* effettivi (i veri ID assegnati dal database Anki).
- Subito dopo recupera lo schema dei `fields` per quel modello e costruisce un oggetto che chiamiamo **DNA**.
- Questo DNA viene scritto nel file di impostazioni del vault `data.json`.

### 2. Sincronizzazione da APKG (per Mobile)
La vera magia avviene nel pannello delle impostazioni del mobile (`flashcards-extended-mobile`).
Siccome da mobile non è possibile usare AnkiConnect, è stata introdotta un'opzione di calibrazione:
- L'utente esporta una carta a caso da Anki **Desktop** usando il formato `Compatible Mode (Anki 2.1)`.
- Nel pannello impostazioni Mobile preme su "Scegli File" e lo seleziona.
- Il plugin usa `JSZip` e `sql.js` in background per estrarre `collection.anki21`, parsare il dizionario JSON e catturare i **veri Model ID di Obsidian**.
- I dati sono salvati, e il plugin si adatterà da ora in avanti a quell'impronta.

### 3. Esportatore APKG Mobile Adattivo
- Quando crei le flashcards da Mobile, il database generato non usa più gli ID "hardcodati" o i classici array di default (`["Front", "Back", "Source"]`).
- Al contrario, sfrutta gli ID letti dal DNA. Se non trova il DNA, passa alla retrocompatibilità (fallback iterativo). 
- In più, i file `.apkg` prodotti dal mobile ora includono contemporaneamente `collection.anki2` e `collection.anki21`, risultando perfetti sotto tutti i formati Anki recenti senza richiedere decompressione Zstandard!

## 🧪 Validazione Consigliata
1. Apri Obsidian Desktop, fai sync per un file. Controlla `data.json` del plugin desktop e verifica che `ankiModelsDna` sia presente.
2. Esporta un file `test.apkg` in Compatible Mode da Anki Desktop.
3. Apri le impostazioni del Plugin Mobile in Obsidian e carica quel file. Riceverai la Notifica: **Perfetto! Sincronizzati con successo X modelli**.
4. Esporta una nuova flashcard da Mobile usando l'icona smartphone. 
5. Importala su Anki e nota che **il counter "Note Aggiunte" sale senza creare alcun nuovo Tipo di Nota con "+"!**
