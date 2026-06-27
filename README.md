# 🚀 Flashcards Extended Mobile

**Offline APKG Exporter for Android mobile, fully compatible with Flashcards Extended.**

This Obsidian plugin allows you to export your notes as Anki flashcards directly from your mobile device. Because it functions entirely offline and generates `.apkg` files locally, it bypasses the need for AnkiConnect, which is not available on mobile devices.

## 🛠️ Features: DNA Sync & Anti-Cloning

To prevent Anki from creating duplicate note types (e.g., `Obsidian-basic+`, `Obsidian-basic++`) when importing cards generated on mobile, this plugin implements an advanced **DNA Synchronization** architecture.

### 1. Active Synchronization from Desktop
When you export from the Desktop plugin (`flashcards-extended`), it uses **AnkiConnect** to retrieve the actual *Model IDs* assigned by your Anki database.
- It fetches the `fields` schema for those models and builds a **DNA** object.
- This DNA is saved in the vault's `data.json` settings file.

### 2. Synchronization via APKG (For Mobile)
Since AnkiConnect is unavailable on mobile, we use a calibration file approach:
1. Export a random card from Anki **Desktop** using the **Compatible Mode (Anki 2.1)** format.
2. In the Mobile plugin settings in Obsidian, tap "Choose File" and select that `.apkg` file.
3. The plugin will parse the file in the background (using `JSZip` and `sql.js`) to extract the exact **Obsidian Model IDs**.
4. The plugin saves this "DNA", and future mobile exports will perfectly match your Anki database!

### 3. Adaptive Mobile APKG Exporter
- Cards created on mobile no longer rely on hardcoded IDs or default arrays (`["Front", "Back", "Source"]`).
- Instead, it dynamically uses the IDs from the saved DNA. (If no DNA is found, it falls back to backward-compatibility mode).
- The generated `.apkg` files contain both `collection.anki2` and `collection.anki21` databases, making them instantly compatible with all recent Anki versions without needing Zstandard decompression!

## 🚀 How to use

1. **Setup DNA (One-time calibration):**
   - Export an `.apkg` file from your Anki Desktop in Compatible Mode.
   - Open Obsidian on your mobile device, go to **Settings > Flashcards Extended Mobile**.
   - Upload the `.apkg` file. You should see a success notification: **"Perfetto! Sincronizzati con successo X modelli"**.

2. **Create Flashcards:**
   - Create flashcards in your Obsidian notes using your preferred tags/formatting.
   - Tap the **Smartphone Icon** (or use the command palette) to generate the `.apkg` file.

3. **Import to Anki:**
   - Open the generated `.apkg` file with AnkiDroid.
   - You will see the notes added **without** any duplicated note types being created!
