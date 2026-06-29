const mockAddIcon = jest.fn();

jest.mock("obsidian", () => {
    class MockPlugin {
        constructor(app, manifest) {
            this.app = app;
            this.manifest = manifest;
        }
        async loadData() { return null; }
        async saveData(data) {}
        addSettingTab(tab) {}
        addCommand(command) {}
        addRibbonIcon(icon, title, callback) {}
    }

    class MockPluginSettingTab {
        constructor(app, plugin) {
            this.app = app;
            this.plugin = plugin;
        }
    }

    class MockSetting {
        constructor(containerEl) {}
        setName(name) { return this; }
        setDesc(desc) { return this; }
        addText(cb) { return this; }
    }

    class MockNotice {
        constructor(message) {}
    }

    return {
        Plugin: MockPlugin,
        PluginSettingTab: MockPluginSettingTab,
        Setting: MockSetting,
        Notice: MockNotice,
        addIcon: mockAddIcon,
        parseFrontMatterEntry: jest.fn()
    };
}, { virtual: true });

const ObsidianFlashcard = require("../main");

describe("ObsidianFlashcard onload config fallback", () => {
    let plugin;
    let app;
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        app = {
            vault: {
                configDir: "/mock/config",
                adapter: {
                    exists: jest.fn(),
                    read: jest.fn()
                }
            },
            workspace: {
                getActiveFile: jest.fn()
            }
        };

        plugin = new ObsidianFlashcard(app, {});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should call console.error when app.vault.adapter.read throws an error", async () => {
        app.vault.adapter.exists.mockResolvedValue(true);
        app.vault.adapter.read.mockRejectedValue(new Error("Mock read error"));

        await plugin.onload();

        expect(console.error).toHaveBeenCalledWith("Could not load desktop settings", expect.any(Error));
    });

    it("should call console.error when app.vault.adapter.exists throws an error", async () => {
        app.vault.adapter.exists.mockRejectedValue(new Error("Mock exists error"));

        await plugin.onload();

        expect(console.error).toHaveBeenCalledWith("Could not load desktop settings", expect.any(Error));
    });

    it("should call console.error when JSON.parse throws an error", async () => {
        app.vault.adapter.exists.mockResolvedValue(true);
        app.vault.adapter.read.mockResolvedValue("invalid json");

        await plugin.onload();

        expect(console.error).toHaveBeenCalledWith("Could not load desktop settings", expect.any(Error));
    });

    it("should load desktop settings successfully", async () => {
        const mockDesktopSettings = { deck: "Desktop Deck" };
        app.vault.adapter.exists.mockResolvedValue(true);
        app.vault.adapter.read.mockResolvedValue(JSON.stringify(mockDesktopSettings));

        await plugin.onload();

        expect(console.log).toHaveBeenCalledWith("Forced desktop settings for parity:", mockDesktopSettings);
        expect(plugin.settings.deck).toBe("Desktop Deck");
        expect(console.error).not.toHaveBeenCalled();
    });
});
