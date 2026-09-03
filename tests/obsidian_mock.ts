import { mock } from 'bun:test';

class MockTAbstractFile {
  path: string = '';
  name: string = '';
  parent: MockTFolder | null = null;
  vault: any = {};
  constructor(path = '', name = '') {
    this.path = path;
    this.name = name;
  }
}

class MockTFile extends MockTAbstractFile {
  basename: string = '';
  extension: string = '';
  stat: any = { mtime: Date.now(), ctime: Date.now(), size: 100 };
  constructor(path = '', name = '', extension = 'md') {
    super(path, name);
    this.extension = extension;
    this.basename = name.replace(new RegExp(`\\.${extension}$`), '');
  }
}

class MockTFolder extends MockTAbstractFile {
  children: MockTAbstractFile[] = [];
  isRoot(): boolean {
    return this.path === '/' || this.path === '';
  }
}

class MockPlugin {
  app: any;
  manifest: any;
  constructor(app: any = {}, manifest: any = {}) {
    this.app = app;
    this.manifest = manifest;
  }
  loadData = async () => ({});
  saveData = async (data: any) => {};
  addSettingTab = (tab: any) => {};
  addCommand = (cmd: any) => {};
  registerEvent = (evt: any) => {};
  registerView = (type: string, cb: any) => {};
}

class MockAbstractInputSuggest {
  constructor(public app: any, public textInputEl: any) {}
  getSuggestions(query: string): any[] { return []; }
  renderSuggestion(value: any, el: HTMLElement): void {}
  selectSuggestion(value: any, evt: MouseEvent | KeyboardEvent): void {}
  close(): void {}
  open(): void {}
}

class MockView {
  containerEl: any = {
    querySelector: () => null,
    querySelectorAll: () => [],
    createEl: () => ({ addClass: () => {}, appendChild: () => {} }),
  };
  leaf: any = {};
  app: any = {};
  onOpen = async () => {};
  onClose = async () => {};
}

class MockEditableFileView extends MockView {
  file: any = null;
}

mock.module('obsidian', () => ({
  requestUrl: async (opts: any) => ({ status: 200, json: {}, text: '' }),
  normalizePath: (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, ''),
  Notice: class { constructor(public msg: string) {} },
  TAbstractFile: MockTAbstractFile,
  TFile: MockTFile,
  TFolder: MockTFolder,
  Vault: class {},
  Plugin: MockPlugin,
  PluginSettingTab: class { constructor(public app: any, public plugin: any) {} display() {} hide() {} },
  AbstractInputSuggest: MockAbstractInputSuggest,
  Component: class { load() {} unload() {} registerEvent() {} },
  Events: class { on() {} off() {} trigger() {} },
  Scope: class { register() {} unregister() {} },
  View: MockView,
  ItemView: class extends MockView {
    getViewType() { return ''; }
    getDisplayText() { return ''; }
  },
  EditableFileView: MockEditableFileView,
  TextFileView: MockEditableFileView,
  WorkspaceLeaf: class {
    openFile = async (f: any) => {};
    containerEl = {
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  },
  MarkdownView: class extends MockView {},
  MarkdownRenderChild: class { constructor(public containerEl: any) {} },
  MarkdownRenderer: {
    render: async () => {}
  },
  Modal: class {
    app: any;
    containerEl: any = { createEl: () => ({ addClass: () => {}, appendChild: () => {} }) };
    contentEl: any = { empty: () => {}, createEl: () => ({ addClass: () => {}, appendChild: () => {} }) };
    titleEl: any = { setText: () => {} };
    constructor(app: any) { this.app = app; }
    open() {}
    close() {}
  },
  FuzzySuggestModal: class {
    constructor(public app: any) {}
    setPlaceholder() {}
    open() {}
    close() {}
  },
  SuggestModal: class {
    constructor(public app: any) {}
    setPlaceholder() {}
    open() {}
    close() {}
  },
  Setting: class {
    settingEl: any = { addClass: () => {} };
    infoEl: any = { appendText: () => {}, style: {} };
    controlEl: any = { createEl: () => ({}) };
    constructor(public containerEl: any) {}
    setName(n: string) { return this; }
    setDesc(d: string) { return this; }
    setHeading() { return this; }
    addText(cb: any) { cb({ setPlaceholder: () => this, setValue: () => this, onChange: () => this, inputEl: {} }); return this; }
    addTextArea(cb: any) { cb({ setPlaceholder: () => this, setValue: () => this, onChange: () => this, inputEl: {} }); return this; }
    addToggle(cb: any) { cb({ setValue: () => this, onChange: () => this, toggleEl: {} }); return this; }
    addDropdown(cb: any) { cb({ addOption: () => this, setValue: () => this, onChange: () => this, selectEl: {} }); return this; }
    addButton(cb: any) { cb({ setButtonText: () => this, setCta: () => this, setWarning: () => this, onClick: () => this, buttonEl: {} }); return this; }
    addSlider(cb: any) { cb({ setLimits: () => this, setValue: () => this, setDynamicTooltip: () => this, onChange: () => this }); return this; }
  },
  ButtonComponent: class {
    setButtonText() { return this; }
    setCta() { return this; }
    setWarning() { return this; }
    onClick() { return this; }
  },
  ToggleComponent: class {
    setValue() { return this; }
    onChange() { return this; }
  },
  DropdownComponent: class {
    addOption() { return this; }
    setValue() { return this; }
    onChange() { return this; }
  },
  TextComponent: class {
    setPlaceholder() { return this; }
    setValue() { return this; }
    onChange() { return this; }
  },
  TextAreaComponent: class {
    setPlaceholder() { return this; }
    setValue() { return this; }
    onChange() { return this; }
  },
  Menu: class {
    addItem() { return this; }
    showAtMouseEvent() {}
    showAtPosition() {}
  },
  MenuItem: class {
    setTitle() { return this; }
    setIcon() { return this; }
    onClick() { return this; }
  },
  Keymap: {
    isModifier: () => false,
  },
  Platform: {
    isDesktop: true,
    isMobile: false,
    isMacOS: false,
    isWin: true,
    isLinux: false,
    isIosApp: false,
    isAndroidApp: false,
    isPhone: false,
    isTablet: false,
  },
  debounce: (fn: any, ms: number) => fn,
  requireApiVersion: () => true,
  setIcon: (el: any, iconId: string) => {},
  parseYaml: (s: string) => ({}),
  stringifyYaml: (o: any) => '',
  getAllTags: () => [],
  getFrontMatterInfo: () => ({ exists: false, frontmatter: '' }),
  getLinkpath: (p: string) => p,
  iterateCacheRefs: () => {},
  prepareSimpleSearch: () => () => null,
  renderMatches: () => {},
  finishRenderMath: () => {},
  loadMathJax: async () => {},
  renderMath: () => document.createElement('span'),
}));

