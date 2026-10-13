// Floppy Label Studio JavaScript Client
(function() {
  'use strict';

  // Application State
  let state = {
    project: {
      title: 'My Floppy Music Collection',
      settings: {
        layout_mode: 'back_spine_front',
        invert_back_text: true,
        draw_guides: true,
        bottom_strips_mode: 'spine_match',
        number_prefix: '',
        number_pad: 2,
        number_size: 20.0
      },
      floppies: []
    },
    activeFloppyId: null,
    activeSlotIndex: 1,
    saveTimeout: null
  };

  // DOM Elements
  const el = {
    floppyGrid: document.getElementById('floppy-grid'),
    statDiskCount: document.getElementById('stat-disk-count'),
    statSheetCount: document.getElementById('stat-sheet-count'),
    saveStatus: document.getElementById('save-status'),
    projectTitle: document.getElementById('project-title'),
    
    // Top actions
    btnAddFloppy: document.getElementById('btn-add-floppy'),
    btnBatchAdd: document.getElementById('btn-batch-add'),
    btnRenumber: document.getElementById('btn-renumber'),
    btnSheetPreview: document.getElementById('btn-sheet-preview'),
    btnSettings: document.getElementById('btn-settings'),
    btnRenderPdf: document.getElementById('btn-render-pdf'),
    
    // Editor Modal
    editorModal: document.getElementById('editor-modal'),
    btnCloseEditor: document.getElementById('btn-close-editor'),
    editorDiskBadge: document.getElementById('editor-disk-badge'),
    btnSaveFloppy: document.getElementById('btn-save-floppy'),
    btnDeleteFloppy: document.getElementById('btn-delete-floppy'),
    btnDuplicateFloppy: document.getElementById('btn-duplicate-floppy'),
    btnPrevFloppy: document.getElementById('btn-prev-floppy'),
    btnNextFloppy: document.getElementById('btn-next-floppy'),
    
    // Editor Preview
    previewBackText: document.getElementById('preview-back-text'),
    previewBackTexture: document.getElementById('preview-back-texture'),
    previewSectionSpine: document.getElementById('preview-section-spine'),
    previewSpineText: document.getElementById('preview-spine-text'),
    previewSectionFront: document.getElementById('preview-section-front'),
    previewFrontImage: document.getElementById('preview-front-image'),
    previewNumberBadge: document.getElementById('preview-number-badge'),
    
    // Editor Fields - Front
    fieldCoverLayout: document.getElementById('field-cover-layout'),
    slotsContainer: document.getElementById('slots-container'),
    singleDropzoneGroup: document.getElementById('single-dropzone-group'),
    dropzoneLabel: document.getElementById('dropzone-label'),
    dropzoneHint: document.getElementById('dropzone-hint'),
    imageDropzone: document.getElementById('image-dropzone'),
    imageFileInput: document.getElementById('image-file-input'),
    btnBrowseImage: document.getElementById('btn-browse-image'),
    fieldFitMode: document.getElementById('field-fit-mode'),
    fieldZoom: document.getElementById('field-zoom'),
    valZoom: document.getElementById('val-zoom'),
    fieldPanX: document.getElementById('field-pan-x'),
    valPanX: document.getElementById('val-pan-x'),
    fieldPanY: document.getElementById('field-pan-y'),
    valPanY: document.getElementById('val-pan-y'),
    adjustmentsHeader: document.getElementById('adjustments-header-text'),
    btnResetSlotTransform: document.getElementById('btn-reset-slot-transform'),
    fieldDisplayNumber: document.getElementById('field-display-number'),
    btnResetNumber: document.getElementById('btn-reset-number'),
    
    // Editor Fields - Spine
    btnSpineCandycane: document.getElementById('btn-spine-candycane'),
    btnSpineSolid: document.getElementById('btn-spine-solid'),
    btnExtractColors: document.getElementById('btn-extract-colors'),
    fieldSpineColor1: document.getElementById('field-spine-color1'),
    fieldSpineHex1: document.getElementById('field-spine-hex1'),
    fieldSpineColor2: document.getElementById('field-spine-color2'),
    fieldSpineHex2: document.getElementById('field-spine-hex2'),
    wrapColor2: document.getElementById('wrap-color2'),
    wrapStripeSliders: document.getElementById('wrap-stripe-sliders'),
    fieldStripeWidth: document.getElementById('field-stripe-width'),
    valStripeW: document.getElementById('val-stripe-w'),
    fieldStripeAngle: document.getElementById('field-stripe-angle'),
    valStripeAngle: document.getElementById('val-stripe-angle'),
    fieldAutoSpineText: document.getElementById('field-auto-spine-text'),
    wrapSpineTextInputs: document.getElementById('wrap-spine-text-inputs'),
    fieldSpineText: document.getElementById('field-spine-text'),
    fieldSpineTextColor: document.getElementById('field-spine-text-color'),
    btnAutoSpineText: document.getElementById('btn-auto-spine-text'),
    
    // Editor Fields - Back
    fieldMusicTemplate: document.getElementById('field-music-template'),
    templateFieldsContainer: document.getElementById('template-fields-container'),
    fieldAutoSyncBack: document.getElementById('field-auto-sync-back'),
    fieldBackText: document.getElementById('field-back-text'),
    fieldTwoColumns: document.getElementById('field-two-columns'),
    fieldBackTextColor: document.getElementById('field-back-text-color'),
    
    // Sheet Modal (Direct PDF)
    sheetModal: document.getElementById('sheet-modal'),
    btnCloseSheet: document.getElementById('btn-close-sheet'),
    sheetPdfIframe: document.getElementById('sheet-pdf-iframe'),
    sheetPdfLoading: document.getElementById('sheet-pdf-loading'),
    btnSheetOpenTab: document.getElementById('btn-sheet-open-tab'),
    btnSheetDownload: document.getElementById('btn-sheet-download'),
    
    // Settings Modal
    settingsModal: document.getElementById('settings-modal'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingInvertBack: document.getElementById('setting-invert-back'),
    settingDrawGuides: document.getElementById('setting-draw-guides'),
    settingBottomStrips: document.getElementById('setting-bottom-strips'),
    settingNumberSize: document.getElementById('setting-number-size'),
    settingNumberPad: document.getElementById('setting-number-pad'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnImportJson: document.getElementById('btn-import-json'),
    fileImportJson: document.getElementById('file-import-json'),
    btnResetDemo: document.getElementById('btn-reset-demo'),
    
    // PDF Modal
    pdfModal: document.getElementById('pdf-modal'),
    btnClosePdf: document.getElementById('btn-close-pdf'),
    pdfModalFilename: document.getElementById('pdf-modal-filename'),
    pdfModalDetails: document.getElementById('pdf-modal-details'),
    btnPdfDownload: document.getElementById('btn-pdf-download'),
    btnPdfOpen: document.getElementById('btn-pdf-open')
  };

  // Initialize
  async function init() {
    setupEventListeners();
    await loadProjectFromServer();
    renderGrid();
    updateStats();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit')) {
      openEditor(urlParams.get('edit'));
      const tab = urlParams.get('tab');
      if (tab) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
        if (tabBtn) tabBtn.click();
      }
    } else if (urlParams.get('preview') === 'sheet') {
      openSheetPreview();
    }
  }

  // Load Project
  async function loadProjectFromServer() {
    setSaveStatus('Loading...');
    try {
      const res = await fetch('/api/project');
      if (res.ok) {
        state.project = await res.json();
        if (!state.project.floppies) state.project.floppies = [];
        if (!state.project.settings) state.project.settings = {};
        el.projectTitle.value = state.project.title || 'My Floppy Music Collection';
        setSaveStatus('Ready');
      }
    } catch (e) {
      console.error('Failed to load project:', e);
      setSaveStatus('Offline');
    }
  }

  // Auto-Save Project (Debounced)
  function triggerAutoSave() {
    setSaveStatus('Saving...');
    clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(async () => {
      try {
        state.project.title = el.projectTitle.value;
        const res = await fetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.project)
        });
        if (res.ok) {
          const now = new Date();
          const timeStr = now.toTimeString().split(' ')[0];
          setSaveStatus(`Saved ${timeStr}`);
        } else {
          setSaveStatus('Save Error');
        }
      } catch (e) {
        console.error('Auto-save error:', e);
        setSaveStatus('Save Error');
      }
    }, 400);
  }

  function setSaveStatus(text) {
    const textEl = el.saveStatus.querySelector('.status-text');
    if (textEl) textEl.textContent = text;
    if (text === 'Saving...') {
      el.saveStatus.classList.add('saving');
    } else {
      el.saveStatus.classList.remove('saving');
    }
  }

  // Update Stats Counters
  function updateStats() {
    const count = state.project.floppies.length;
    el.statDiskCount.textContent = count;
    el.statSheetCount.textContent = Math.ceil(count / 9) || 0;
  }

  // Render Floppy Grid
  function renderGrid() {
    el.floppyGrid.innerHTML = '';
    state.project.floppies.forEach((disk, index) => {
      const card = createFloppyCard(disk, index);
      el.floppyGrid.appendChild(card);
    });
    updateStats();
  }

  // Slot Property Helpers (Supports Independent Zoom, Pan, and Fit per Slot 1-4)
  function getSlotZoom(disk, slot) {
    if (!disk) return 1.0;
    if (slot === 1) {
      return disk.zoom1 !== undefined ? parseFloat(disk.zoom1) : (disk.zoom !== undefined ? parseFloat(disk.zoom) : 1.0);
    }
    return disk['zoom' + slot] !== undefined ? parseFloat(disk['zoom' + slot]) : 1.0;
  }

  function setSlotZoom(disk, slot, val) {
    if (!disk) return;
    const numVal = parseFloat(val);
    if (slot === 1) {
      disk.zoom = numVal;
      disk.zoom1 = numVal;
    } else {
      disk['zoom' + slot] = numVal;
    }
  }

  function getSlotPanX(disk, slot) {
    if (!disk) return 0;
    if (slot === 1) {
      return disk.pan_x1 !== undefined ? parseFloat(disk.pan_x1) : (disk.pan_x !== undefined ? parseFloat(disk.pan_x) : 0);
    }
    return disk['pan_x' + slot] !== undefined ? parseFloat(disk['pan_x' + slot]) : 0;
  }

  function setSlotPanX(disk, slot, val) {
    if (!disk) return;
    const numVal = parseFloat(val);
    if (slot === 1) {
      disk.pan_x = numVal;
      disk.pan_x1 = numVal;
    } else {
      disk['pan_x' + slot] = numVal;
    }
  }

  function getSlotPanY(disk, slot) {
    if (!disk) return 0;
    if (slot === 1) {
      return disk.pan_y1 !== undefined ? parseFloat(disk.pan_y1) : (disk.pan_y !== undefined ? parseFloat(disk.pan_y) : 0);
    }
    return disk['pan_y' + slot] !== undefined ? parseFloat(disk['pan_y' + slot]) : 0;
  }

  function setSlotPanY(disk, slot, val) {
    if (!disk) return;
    const numVal = parseFloat(val);
    if (slot === 1) {
      disk.pan_y = numVal;
      disk.pan_y1 = numVal;
    } else {
      disk['pan_y' + slot] = numVal;
    }
  }

  function getSlotFitMode(disk, slot) {
    if (!disk) return 'cover';
    if (slot === 1) {
      return disk.fit_mode1 || disk.fit_mode || 'cover';
    }
    return disk['fit_mode' + slot] || 'cover';
  }

  function setSlotFitMode(disk, slot, val) {
    if (!disk) return;
    if (slot === 1) {
      disk.fit_mode = val;
      disk.fit_mode1 = val;
    } else {
      disk['fit_mode' + slot] = val;
    }
  }

  function getSlotTransform(disk, slot) {
    const zoom = getSlotZoom(disk, slot);
    const px = getSlotPanX(disk, slot);
    const py = getSlotPanY(disk, slot);
    if (zoom !== 1.0 || px !== 0 || py !== 0) {
      return `transform: translate(${px * 0.5}%, ${py * 0.5}%) scale(${zoom});`;
    }
    return '';
  }

  // Generate Front Section Cover HTML (Fixed Slice Windows with Movable Inner Images)
  function getFrontCoverHtml(disk) {
    const layout = disk.cover_layout || 'single';
    const numDisplay = escapeHtml(disk.display_number || disk.number || '');
    const numBadge = `<div class="sequential-number-badge">${numDisplay}</div>`;

    if (layout === 'split_2_diagonal') {
      const img1 = disk.image ? `background-image: url('/user_data/images/${disk.image}');` : 'background: #1e222e;';
      const img2 = disk.image2 ? `background-image: url('/user_data/images/${disk.image2}');` : (disk.image ? `background-image: url('/user_data/images/${disk.image}'); filter: brightness(0.8);` : 'background: #2a2f3d;');
      const fit1 = getSlotFitMode(disk, 1);
      const fit2 = getSlotFitMode(disk, 2);
      const tr1 = getSlotTransform(disk, 1);
      const tr2 = getSlotTransform(disk, 2);
      return `
        <div class="front-split-container">
          <div class="front-split-slice split-2-a">
            <div class="slice-inner-image" style="${img1} background-size: ${fit1}; ${tr1}"></div>
          </div>
          <div class="front-split-slice split-2-b">
            <div class="slice-inner-image" style="${img2} background-size: ${fit2}; ${tr2}"></div>
          </div>
          <svg class="split-divider-svg" viewBox="0 0 198 153" preserveAspectRatio="none">
            <line x1="22.5" y1="0" x2="175.5" y2="153" stroke="#0b0e14" stroke-width="2.8"/>
            <line x1="22.5" y1="0" x2="175.5" y2="153" stroke="#ffffff" stroke-width="1.2"/>
          </svg>
        </div>
        ${numBadge}
      `;
    } else if (layout === 'split_3_skewed') {
      const img1 = disk.image ? `background-image: url('/user_data/images/${disk.image}');` : 'background: #1e222e;';
      const img2 = disk.image2 ? `background-image: url('/user_data/images/${disk.image2}');` : (disk.image ? `background-image: url('/user_data/images/${disk.image}'); filter: brightness(0.85);` : 'background: #252a36;');
      const img3 = disk.image3 ? `background-image: url('/user_data/images/${disk.image3}');` : (disk.image2 ? `background-image: url('/user_data/images/${disk.image2}');` : (disk.image ? `background-image: url('/user_data/images/${disk.image}'); filter: brightness(0.7);` : 'background: #2d3342;'));
      const fit1 = getSlotFitMode(disk, 1);
      const fit2 = getSlotFitMode(disk, 2);
      const fit3 = getSlotFitMode(disk, 3);
      const tr1 = getSlotTransform(disk, 1);
      const tr2 = getSlotTransform(disk, 2);
      const tr3 = getSlotTransform(disk, 3);
      return `
        <div class="front-split-container">
          <div class="front-split-slice split-3-a">
            <div class="slice-inner-image" style="${img1} background-size: ${fit1}; ${tr1}"></div>
          </div>
          <div class="front-split-slice split-3-b">
            <div class="slice-inner-image" style="${img2} background-size: ${fit2}; ${tr2}"></div>
          </div>
          <div class="front-split-slice split-3-c">
            <div class="slice-inner-image" style="${img3} background-size: ${fit3}; ${tr3}"></div>
          </div>
          <svg class="split-divider-svg" viewBox="0 0 198 153" preserveAspectRatio="none">
            <line x1="48" y1="0" x2="84" y2="153" stroke="#0b0e14" stroke-width="2.6"/>
            <line x1="48" y1="0" x2="84" y2="153" stroke="#ffffff" stroke-width="1.1"/>
            <line x1="114" y1="0" x2="150" y2="153" stroke="#0b0e14" stroke-width="2.6"/>
            <line x1="114" y1="0" x2="150" y2="153" stroke="#ffffff" stroke-width="1.1"/>
          </svg>
        </div>
        ${numBadge}
      `;
    } else if (layout === 'split_4_quadrant') {
      const img1 = disk.image ? `background-image: url('/user_data/images/${disk.image}');` : 'background: #1e222e;';
      const img2 = disk.image2 ? `background-image: url('/user_data/images/${disk.image2}');` : (disk.image ? `background-image: url('/user_data/images/${disk.image}'); filter: brightness(0.85);` : 'background: #252a36;');
      const img3 = disk.image3 ? `background-image: url('/user_data/images/${disk.image3}');` : (disk.image ? `background-image: url('/user_data/images/${disk.image}'); filter: brightness(0.7);` : 'background: #2a2f3d;');
      const img4 = disk.image4 ? `background-image: url('/user_data/images/${disk.image4}');` : (disk.image2 ? `background-image: url('/user_data/images/${disk.image2}'); filter: brightness(0.8);` : 'background: #313747;');
      const fit1 = getSlotFitMode(disk, 1);
      const fit2 = getSlotFitMode(disk, 2);
      const fit3 = getSlotFitMode(disk, 3);
      const fit4 = getSlotFitMode(disk, 4);
      const tr1 = getSlotTransform(disk, 1);
      const tr2 = getSlotTransform(disk, 2);
      const tr3 = getSlotTransform(disk, 3);
      const tr4 = getSlotTransform(disk, 4);
      return `
        <div class="front-split-container">
          <div class="front-split-slice split-4-1">
            <div class="slice-inner-image" style="${img1} background-size: ${fit1}; ${tr1}"></div>
          </div>
          <div class="front-split-slice split-4-2">
            <div class="slice-inner-image" style="${img2} background-size: ${fit2}; ${tr2}"></div>
          </div>
          <div class="front-split-slice split-4-3">
            <div class="slice-inner-image" style="${img3} background-size: ${fit3}; ${tr3}"></div>
          </div>
          <div class="front-split-slice split-4-4">
            <div class="slice-inner-image" style="${img4} background-size: ${fit4}; ${tr4}"></div>
          </div>
          <svg class="split-divider-svg" viewBox="0 0 198 153" preserveAspectRatio="none">
            <line x1="99" y1="0" x2="99" y2="153" stroke="#0b0e14" stroke-width="2.6"/>
            <line x1="99" y1="0" x2="99" y2="153" stroke="#ffffff" stroke-width="1.1"/>
            <line x1="0" y1="76.5" x2="198" y2="76.5" stroke="#0b0e14" stroke-width="2.6"/>
            <line x1="0" y1="76.5" x2="198" y2="76.5" stroke="#ffffff" stroke-width="1.1"/>
          </svg>
        </div>
        ${numBadge}
      `;
    } else {
      // Single
      const fit1 = getSlotFitMode(disk, 1);
      const tr1 = getSlotTransform(disk, 1);
      const imgStyle = disk.image 
        ? `background-image: url('/user_data/images/${disk.image}'); background-size: ${fit1}; ${tr1}`
        : '';
      return `
        <div class="front-split-slice split-single">
          <div class="slice-inner-image" style="${imgStyle}"></div>
        </div>
        ${!disk.image ? `<div class="front-placeholder-text"><span>🎵</span><span>${escapeHtml(disk.album || 'No Image')}</span></div>` : ''}
        ${numBadge}
      `;
    }
  }

  // Generate Floppy Card Element
  function createFloppyCard(disk, index) {
    const card = document.createElement('div');
    card.className = 'floppy-card';
    card.dataset.id = disk.id;

    // Number formatting
    const numDisplay = disk.display_number || String(disk.number || index + 1).padStart(state.project.settings.number_pad || 2, '0');

    // Spine style CSS
    let spineBg = '';
    if (disk.spine_style === 'solid') {
      spineBg = disk.spine_color1 || '#D90429';
    } else {
      const c1 = disk.spine_color1 || '#D90429';
      const c2 = disk.spine_color2 || '#FFFFFF';
      const w = (disk.spine_stripe_width || 4.5) + 'px';
      const angle = (disk.spine_stripe_angle || 45) + 'deg';
      spineBg = `repeating-linear-gradient(${angle}, ${c1}, ${c1} ${w}, ${c2} ${w}, ${c2} calc(${w} * 2))`;
    }

    // Default spine text derived from Artist - Album if not overridden
    let spineDisplayText = (disk.spine_text || '').trim();
    if (!spineDisplayText) {
      const artist = (disk.artist || '').trim();
      const album = (disk.album || '').trim();
      if (artist && album) spineDisplayText = `${artist} - ${album}`;
      else spineDisplayText = album || artist || '';
    }

    // Rear strip text
    const backDisplayText = (disk.back_text || '').trim() || (disk.artist && disk.album ? `${disk.artist} - ${disk.album}` : (disk.album || disk.artist || ''));

    card.innerHTML = `
      <div class="floppy-card-header">
        <div class="card-title-group">
          <span class="card-number-badge">#${numDisplay}</span>
          <h3 class="card-album-name" title="${escapeHtml(disk.album || 'Untitled Floppy')}">${escapeHtml(disk.album || 'Untitled Floppy')}</h3>
          <div class="card-artist-name" title="${escapeHtml(disk.artist || 'Unknown Artist')}">${escapeHtml(disk.artist || 'Unknown Artist')}</div>
        </div>
        <div class="card-actions-quick">
          <button type="button" class="btn-icon-sm btn-up" title="Move Up">▲</button>
          <button type="button" class="btn-icon-sm btn-down" title="Move Down">▼</button>
          <button type="button" class="btn-icon-sm danger btn-del" title="Delete">✕</button>
        </div>
      </div>

      <!-- Proportional 3-Section Preview (Rear 0.500", Spine 0.125", Front 2.125") -->
      <div class="floppy-label-box">
        <!-- Rear Strip (18.18% - 0.500") with heavily blurred & lightened cover texture -->
        <div class="label-section section-back" style="color: ${disk.back_text_color || '#111827'};">
          <div class="back-bg-texture"${(disk.image || disk.image2) ? ` style="background-image: url('/user_data/images/${disk.image || disk.image2}');"` : ''}></div>
          <div class="back-text-content">${escapeHtml(backDisplayText)}</div>
        </div>

        <!-- Spine (4.55% - 0.125") -->
        <div class="label-section section-spine" style="background: ${spineBg};">
          <div class="spine-text-content" style="color: ${disk.spine_text_color || '#FFFFFF'};">
            ${escapeHtml(spineDisplayText)}
          </div>
        </div>

        <!-- Front Section (77.27% - 2.125") -->
        <div class="label-section section-front">
          ${getFrontCoverHtml(disk)}
        </div>
      </div>
    `;

    // Click Card to Edit
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions-quick')) return;
      openEditor(disk.id);
    });

    // Quick Actions
    card.querySelector('.btn-up').addEventListener('click', (e) => {
      e.stopPropagation();
      moveFloppy(disk.id, -1);
    });
    card.querySelector('.btn-down').addEventListener('click', (e) => {
      e.stopPropagation();
      moveFloppy(disk.id, 1);
    });
    card.querySelector('.btn-del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFloppy(disk.id);
    });

    // Drag-and-drop Image on Card
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('active-drop');
    });
    card.addEventListener('dragleave', () => card.classList.remove('active-drop'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('active-drop');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await uploadFileForFloppy(disk.id, e.dataTransfer.files[0]);
      }
    });

    return card;
  }

  // Move Floppy Up/Down
  function moveFloppy(id, delta) {
    const idx = state.project.floppies.findIndex(f => f.id === id);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= state.project.floppies.length) return;

    const item = state.project.floppies.splice(idx, 1)[0];
    state.project.floppies.splice(newIdx, 0, item);
    renderGrid();
    triggerAutoSave();
  }

  // Delete Floppy
  function deleteFloppy(id) {
    const idx = state.project.floppies.findIndex(f => f.id === id);
    if (idx < 0) return;
    state.project.floppies.splice(idx, 1);
    renderGrid();
    triggerAutoSave();
    if (state.activeFloppyId === id) closeEditor();
  }

  // Add New Floppy
  function addNewFloppy() {
    const num = state.project.floppies.length + 1;
    const pad = state.project.settings.number_pad || 2;
    const numStr = String(num).padStart(pad, '0');

    const newDisk = {
      id: 'disk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      number: num,
      display_number: numStr,
      album: 'New Album ' + num,
      artist: 'Artist',
      year: '',
      template: 'single_album',
      cover_layout: 'single',
      spine_style: 'solid',
      spine_color1: '#00F0FF',
      spine_color2: '#FF007F',
      spine_stripe_width: 4.5,
      spine_stripe_angle: 45.0,
      spine_text: '',
      auto_spine_text: true,
      spine_text_color: '#FFFFFF',
      back_bg_color: '#F8F9FA',
      back_text_color: '#111827',
      two_columns: false,
      back_text: 'Artist - New Album ' + num,
      image: '',
      fit_mode: 'cover',
      zoom: 1.0,
      pan_x: 0.0,
      pan_y: 0.0
    };

    state.project.floppies.push(newDisk);
    renderGrid();
    triggerAutoSave();
    openEditor(newDisk.id);
  }

  // Batch Add Floppies
  function batchAddFloppies() {
    const input = prompt('How many blank floppies would you like to add? (e.g. 9 for 1 full sheet):', '9');
    const count = parseInt(input, 10);
    if (isNaN(count) || count <= 0) return;

    const pad = state.project.settings.number_pad || 2;
    for (let i = 0; i < count; i++) {
      const num = state.project.floppies.length + 1;
      const numStr = String(num).padStart(pad, '0');
      state.project.floppies.push({
        id: 'disk-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 5),
        number: num,
        display_number: numStr,
        album: 'Album ' + num,
        artist: 'Artist',
        year: '',
        template: 'single_album',
        spine_style: 'solid',
        spine_color1: getRandomColor(),
        spine_color2: '#FFFFFF',
        spine_stripe_width: 4.5,
        spine_stripe_angle: 45.0,
        spine_text: '',
        auto_spine_text: true,
        spine_text_color: '#FFFFFF',
        back_bg_color: '#F8F9FA',
        back_text_color: '#111827',
        two_columns: false,
        back_text: 'Artist - Album ' + num,
        image: '',
        fit_mode: 'cover',
        zoom: 1.0,
        pan_x: 0.0,
        pan_y: 0.0
      });
    }
    renderGrid();
    triggerAutoSave();
  }

  function getRandomColor() {
    const colors = ['#D90429', '#00F0FF', '#FF007F', '#FFB703', '#2A9D8F', '#7209B7', '#38B000', '#0077B6', '#E76F51'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Renumber All Floppies
  function renumberAll() {
    const pad = state.project.settings.number_pad || 2;
    state.project.floppies.forEach((disk, idx) => {
      const num = idx + 1;
      disk.number = num;
      disk.display_number = String(num).padStart(pad, '0');
    });
    renderGrid();
    triggerAutoSave();
    if (state.activeFloppyId) syncEditorFromDisk();
  }

  // Open Editor for Disk
  function openEditor(id) {
    state.activeFloppyId = id;
    state.activeSlotIndex = 1;
    const disk = state.project.floppies.find(f => f.id === id);
    if (!disk) return;

    el.editorDiskBadge.textContent = '#' + (disk.display_number || disk.number);
    syncEditorFromDisk();
    el.editorModal.classList.add('open');
  }

  function closeEditor() {
    el.editorModal.classList.remove('open');
    renderGrid();
    triggerAutoSave();
  }

  // Sync Form Fields from Currently Active Disk
  function syncEditorFromDisk() {
    const disk = state.project.floppies.find(f => f.id === state.activeFloppyId);
    if (!disk) return;

    // Front tab
    if (el.fieldCoverLayout) {
      el.fieldCoverLayout.value = disk.cover_layout || 'single';
    }
    renderSlotCards(disk);
    syncSlotAdjustmentsUI(disk);
    el.fieldDisplayNumber.value = disk.display_number || disk.number || '';

    // Spine tab
    setSpineStyleToggle(disk.spine_style || 'solid');
    el.fieldSpineColor1.value = disk.spine_color1 || '#D90429';
    el.fieldSpineHex1.value = disk.spine_color1 || '#D90429';
    el.fieldSpineColor2.value = disk.spine_color2 || '#FFFFFF';
    el.fieldSpineHex2.value = disk.spine_color2 || '#FFFFFF';
    el.fieldStripeWidth.value = disk.spine_stripe_width || 4.5;
    el.valStripeW.textContent = (disk.spine_stripe_width || 4.5) + 'px';
    el.fieldStripeAngle.value = disk.spine_stripe_angle || 45;
    el.valStripeAngle.textContent = (disk.spine_stripe_angle || 45) + '°';

    // Auto-spine text checkbox and value
    const isAutoSpine = disk.auto_spine_text !== false && (!disk.spine_text || disk.spine_text === (disk.artist && disk.album ? `${disk.artist} - ${disk.album}` : (disk.album || disk.artist || '')));
    if (el.fieldAutoSpineText) el.fieldAutoSpineText.checked = isAutoSpine;

    let currentSpineText = disk.spine_text;
    if ((!currentSpineText || !currentSpineText.trim()) && isAutoSpine) {
      const artist = (disk.artist || '').trim();
      const album = (disk.album || '').trim();
      currentSpineText = (artist && album) ? `${artist} - ${album}` : (album || artist || '');
    }
    el.fieldSpineText.value = currentSpineText || '';
    el.fieldSpineTextColor.value = disk.spine_text_color || '#FFFFFF';

    // Back tab
    el.fieldMusicTemplate.value = disk.template || 'single_album';
    renderTemplateFields(disk);
    el.fieldBackText.value = disk.back_text || '';
    el.fieldTwoColumns.checked = !!disk.two_columns;
    el.fieldBackTextColor.value = disk.back_text_color || '#111827';

    updateLivePreview(disk);
  }

  // Sync Controls for Active Slot (Zoom, Pan X, Pan Y, Fit Mode)
  function syncSlotAdjustmentsUI(disk) {
    if (!disk) return;
    const slot = state.activeSlotIndex || 1;
    const layout = disk.cover_layout || 'single';
    let slotLabel = `Slot ${slot}`;
    if (layout === 'split_2_diagonal') {
      slotLabel = slot === 1 ? 'Slot 1: Top-Left' : 'Slot 2: Bottom-Right';
    } else if (layout === 'split_3_skewed') {
      slotLabel = slot === 1 ? 'Slot 1: Left Bar' : (slot === 2 ? 'Slot 2: Center Bar' : 'Slot 3: Right Bar');
    } else if (layout === 'split_4_quadrant') {
      const labels = ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
      slotLabel = `Slot ${slot}: ${labels[slot - 1] || ''}`;
    } else {
      slotLabel = 'Cover Art (Full Front)';
    }

    if (el.adjustmentsHeader) {
      el.adjustmentsHeader.textContent = `Image Adjustments: ${slotLabel}`;
    }

    const fit = getSlotFitMode(disk, slot);
    const zoom = getSlotZoom(disk, slot);
    const px = getSlotPanX(disk, slot);
    const py = getSlotPanY(disk, slot);

    el.fieldFitMode.value = fit;
    el.fieldZoom.value = zoom;
    el.valZoom.textContent = zoom.toFixed(2) + 'x';
    el.fieldPanX.value = px;
    el.fieldPanY.value = py;
    if (el.valPanX) el.valPanX.textContent = px + '%';
    if (el.valPanY) el.valPanY.textContent = py + '%';
  }

  // Render Dynamic Slot Cards in Tab 1
  function renderSlotCards(disk) {
    if (!el.slotsContainer) return;
    const layout = disk.cover_layout || 'single';
    let slotDefs = [];

    if (layout === 'split_2_diagonal') {
      slotDefs = [
        { slot: 1, label: 'Artist 1 (Top-Left)', key: 'image' },
        { slot: 2, label: 'Artist 2 (Bottom-Right)', key: 'image2' }
      ];
    } else if (layout === 'split_3_skewed') {
      slotDefs = [
        { slot: 1, label: 'Artist 1 (Left Bar)', key: 'image' },
        { slot: 2, label: 'Artist 2 (Center Bar)', key: 'image2' },
        { slot: 3, label: 'Artist 3 (Right Bar)', key: 'image3' }
      ];
    } else if (layout === 'split_4_quadrant') {
      slotDefs = [
        { slot: 1, label: 'Artist 1 (Top-Left)', key: 'image' },
        { slot: 2, label: 'Artist 2 (Top-Right)', key: 'image2' },
        { slot: 3, label: 'Artist 3 (Bottom-Left)', key: 'image3' },
        { slot: 4, label: 'Artist 4 (Bottom-Right)', key: 'image4' }
      ];
    } else {
      slotDefs = [
        { slot: 1, label: 'Cover Art (Full Front)', key: 'image' }
      ];
    }

    // Ensure activeSlotIndex is within valid range
    if (!state.activeSlotIndex || state.activeSlotIndex > slotDefs.length) {
      state.activeSlotIndex = 1;
    }

    // Update dropzone label
    if (el.dropzoneLabel) {
      const activeDef = slotDefs.find(s => s.slot === state.activeSlotIndex) || slotDefs[0];
      el.dropzoneLabel.textContent = `Upload / Paste Image for: ${activeDef.label}`;
    }

    el.slotsContainer.innerHTML = '';
    slotDefs.forEach(def => {
      const card = document.createElement('div');
      card.className = `slot-card${state.activeSlotIndex === def.slot ? ' active-slot' : ''}`;
      card.dataset.slot = def.slot;

      const imgVal = disk[def.key];
      const thumbContent = imgVal 
        ? `<img src="/user_data/images/${imgVal}" class="slot-thumb-img" alt="Slot ${def.slot}">`
        : `<div class="slot-thumb-empty"><span>📷</span><span>Empty</span></div>`;

      const currentZoom = getSlotZoom(disk, def.slot);

      card.innerHTML = `
        <div class="slot-header">
          <div class="slot-header-left">
            <span class="slot-badge">Slot ${def.slot}</span>
            <span class="slot-title">${escapeHtml(def.label)}</span>
          </div>
          <span class="slot-zoom-tag">${currentZoom.toFixed(2)}x</span>
        </div>
        <div class="slot-thumb-box">
          ${thumbContent}
        </div>
        <div class="slot-actions">
          <button type="button" class="btn-slot-act btn-slot-choose" title="Browse image file">Browse</button>
          ${imgVal && def.slot > 1 ? `<button type="button" class="btn-slot-act btn-slot-clear" title="Remove image">Clear</button>` : ''}
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-slot-clear') || e.target.closest('.btn-slot-choose')) return;
        state.activeSlotIndex = def.slot;
        renderSlotCards(disk);
        syncSlotAdjustmentsUI(disk);
      });

      const btnChoose = card.querySelector('.btn-slot-choose');
      if (btnChoose) {
        btnChoose.addEventListener('click', (e) => {
          e.stopPropagation();
          state.activeSlotIndex = def.slot;
          renderSlotCards(disk);
          syncSlotAdjustmentsUI(disk);
          el.imageFileInput.click();
        });
      }

      const btnClear = card.querySelector('.btn-slot-clear');
      if (btnClear) {
        btnClear.addEventListener('click', (e) => {
          e.stopPropagation();
          delete disk[def.key];
          renderSlotCards(disk);
          syncSlotAdjustmentsUI(disk);
          updateLivePreview(disk);
          renderGrid();
          triggerAutoSave();
        });
      }

      el.slotsContainer.appendChild(card);
    });
  }

  function setSpineStyleToggle(style) {
    if (style === 'candy_cane') {
      el.btnSpineCandycane.classList.add('active');
      el.btnSpineSolid.classList.remove('active');
      el.wrapColor2.style.display = 'block';
      el.wrapStripeSliders.style.display = 'flex';
    } else {
      el.btnSpineSolid.classList.add('active');
      el.btnSpineCandycane.classList.remove('active');
      el.wrapColor2.style.display = 'none';
      el.wrapStripeSliders.style.display = 'none';
    }
  }

  // Update Live Preview Box inside Modal
  function updateLivePreview(disk) {
    if (!disk) return;

    // Number
    const numDisplay = disk.display_number || disk.number || '';
    if (el.previewNumberBadge) el.previewNumberBadge.textContent = numDisplay;

    // Front Section (supports single, 2-diagonal, 3-skewed, 4-quadrant)
    if (el.previewSectionFront) {
      el.previewSectionFront.innerHTML = getFrontCoverHtml(disk) + '<span class="section-indicator">Front Cover (2.125")</span>';
    } else if (el.previewFrontImage) {
      if (disk.image) {
        el.previewFrontImage.style.backgroundImage = `url('/user_data/images/${disk.image}')`;
        el.previewFrontImage.style.backgroundSize = disk.fit_mode || 'cover';
        el.previewFrontImage.style.transform = `scale(${disk.zoom || 1}) translate(${disk.pan_x || 0}%, ${disk.pan_y || 0}%)`;
      } else {
        el.previewFrontImage.style.backgroundImage = 'none';
      }
    }

    // Spine
    if (disk.spine_style === 'solid') {
      el.previewSectionSpine.style.background = disk.spine_color1 || '#D90429';
    } else {
      const c1 = disk.spine_color1 || '#D90429';
      const c2 = disk.spine_color2 || '#FFFFFF';
      const w = (disk.spine_stripe_width || 4.5) + 'px';
      const angle = (disk.spine_stripe_angle || 45) + 'deg';
      el.previewSectionSpine.style.background = `repeating-linear-gradient(${angle}, ${c1}, ${c1} ${w}, ${c2} ${w}, ${c2} calc(${w} * 2))`;
    }

    // Spine text (defaults to Artist - Album if empty)
    let spineDisplayText = (disk.spine_text || '').trim();
    if (!spineDisplayText) {
      const artist = (disk.artist || '').trim();
      const album = (disk.album || '').trim();
      if (artist && album) spineDisplayText = `${artist} - ${album}`;
      else spineDisplayText = album || artist || '';
    }
    el.previewSpineText.textContent = spineDisplayText;
    el.previewSpineText.style.color = disk.spine_text_color || '#FFFFFF';

    // Back Texture (blurred & lightened album cover)
    if (el.previewBackTexture) {
      const primaryImg = disk.image || disk.image2 || '';
      if (primaryImg) {
        el.previewBackTexture.style.backgroundImage = `url('/user_data/images/${primaryImg}')`;
      } else {
        el.previewBackTexture.style.backgroundImage = 'none';
      }
    }

    // Back text
    const backDisplayText = (disk.back_text || '').trim() || (disk.artist && disk.album ? `${disk.artist} - ${disk.album}` : (disk.album || disk.artist || ''));
    el.previewBackText.textContent = backDisplayText;
    el.previewBackText.style.color = disk.back_text_color || '#111827';
  }

  // Render Template Input Fields (Additional Artists / Albums)
  function renderTemplateFields(disk) {
    const tmpl = el.fieldMusicTemplate.value;
    let html = '';

    if (tmpl === 'single_album') {
      html = `
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">Primary Artist</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-artist" value="${escapeHtml(disk.artist || '')}" placeholder="e.g. Daft Punk">
          </div>
          <div class="form-group half">
            <label class="form-label">Album Title</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-album" value="${escapeHtml(disk.album || '')}" placeholder="e.g. Discovery">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">Year / Label (Optional)</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-year" value="${escapeHtml(disk.year || '')}" placeholder="e.g. 2001 • Virgin Records">
          </div>
          <div class="form-group half">
            <label class="form-label">Additional Artists / Features / Subtitle</label>
            <textarea class="form-textarea tmpl-input" id="tmpl-additional" rows="2" placeholder="e.g. Feat. Romanthony & Todd Edwards&#10;Bonus: Daft Club Remixes">${escapeHtml(disk.additional || '')}</textarea>
          </div>
        </div>
      `;
    } else if (tmpl === 'split_album') {
      html = `
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">Release 1 (Artist - Album)</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-split-1" value="${escapeHtml(disk.split_1 || '')}" placeholder="e.g. Tycho - Past is Prologue">
          </div>
          <div class="form-group half">
            <label class="form-label">Release 2 (Artist - Album)</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-split-2" value="${escapeHtml(disk.split_2 || '')}" placeholder="e.g. Boards of Canada - Music Has the Right">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Release 3 / Additional Edge Case Info (Optional)</label>
          <input type="text" class="form-input tmpl-input" id="tmpl-split-3" value="${escapeHtml(disk.split_3 || '')}" placeholder="e.g. Split 2-in-1 Cassette Remaster">
        </div>
      `;
    } else if (tmpl === 'compilation') {
      html = `
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">Compilation / Mix Title</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-comp-title" value="${escapeHtml(disk.album || '')}" placeholder="e.g. 90s French Touch Classics">
          </div>
          <div class="form-group half">
            <label class="form-label">Curator / Primary Artist / DJ</label>
            <input type="text" class="form-input tmpl-input" id="tmpl-comp-curator" value="${escapeHtml(disk.artist || '')}" placeholder="e.g. Various Artists / DJ Falcon">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Featured Additional Artists / Contributors (One per line)</label>
          <textarea class="form-textarea tmpl-input" id="tmpl-comp-artists" rows="3" placeholder="Cassius&#10;Stardust&#10;Etienne de Crecy&#10;Modjo">${escapeHtml(disk.comp_artists || '')}</textarea>
        </div>
      `;
    } else {
      html = `<p class="field-hint">Freeform mode: Enter any custom multi-artist or combined album details directly into the text area below.</p>`;
    }

    el.templateFieldsContainer.innerHTML = html;

    // Attach listeners to template inputs
    el.templateFieldsContainer.querySelectorAll('.tmpl-input').forEach(input => {
      input.addEventListener('input', () => {
        if (el.fieldAutoSyncBack.checked) {
          compileTemplateToBackText();
        }
      });
    });
  }

  // Compile Template Fields into Final Back Text
  function compileTemplateToBackText() {
    const disk = state.project.floppies.find(f => f.id === state.activeFloppyId);
    if (!disk) return;

    const tmpl = el.fieldMusicTemplate.value;
    let compiled = '';

    if (tmpl === 'single_album') {
      const album = document.getElementById('tmpl-album')?.value.trim() || '';
      const artist = document.getElementById('tmpl-artist')?.value.trim() || '';
      const year = document.getElementById('tmpl-year')?.value.trim() || '';
      const addl = document.getElementById('tmpl-additional')?.value.trim() || '';

      disk.album = album;
      disk.artist = artist;
      disk.year = year;
      disk.additional = addl;

      const header = artist && album ? `${artist} - ${album}` : (album || artist);
      const yearStr = year ? ` (${year})` : '';
      const parts = [];
      if (header) parts.push(`${header}${yearStr}`);
      if (addl) parts.push(addl);
      compiled = parts.join('\n');

      // Auto-update spine text if auto-spine is active
      if (disk.auto_spine_text !== false && el.fieldAutoSpineText && el.fieldAutoSpineText.checked) {
        disk.spine_text = header;
        el.fieldSpineText.value = header;
      }
    } else if (tmpl === 'split_album') {
      const s1 = document.getElementById('tmpl-split-1')?.value.trim() || '';
      const s2 = document.getElementById('tmpl-split-2')?.value.trim() || '';
      const s3 = document.getElementById('tmpl-split-3')?.value.trim() || '';

      disk.split_1 = s1;
      disk.split_2 = s2;
      disk.split_3 = s3;

      const parts = [];
      if (s1) parts.push(`1. ${s1}`);
      if (s2) parts.push(`2. ${s2}`);
      if (s3) parts.push(`3. ${s3}`);
      compiled = parts.join('\n');

      if (s1 && !disk.album) disk.album = s1;

      // Auto-update spine text for split album if auto-spine is active
      if (disk.auto_spine_text !== false && el.fieldAutoSpineText && el.fieldAutoSpineText.checked && (s1 || s2)) {
        const spineDerived = (s1 && s2) ? `${s1} / ${s2}` : (s1 || s2);
        disk.spine_text = spineDerived;
        el.fieldSpineText.value = spineDerived;
      }
    } else if (tmpl === 'compilation') {
      const title = document.getElementById('tmpl-comp-title')?.value.trim() || '';
      const curator = document.getElementById('tmpl-comp-curator')?.value.trim() || '';
      const artists = document.getElementById('tmpl-comp-artists')?.value.trim() || '';

      disk.album = title;
      disk.artist = curator;
      disk.comp_artists = artists;

      const parts = [];
      if (curator && title) parts.push(`${curator}: ${title}`);
      else if (title || curator) parts.push(title || curator);
      if (artists) parts.push(artists);
      compiled = parts.join('\n');

      if (disk.auto_spine_text !== false && el.fieldAutoSpineText && el.fieldAutoSpineText.checked && title) {
        const spineDerived = curator ? `${curator} - ${title}` : title;
        disk.spine_text = spineDerived;
        el.fieldSpineText.value = spineDerived;
      }
    }

    if (compiled || tmpl !== 'freeform') {
      el.fieldBackText.value = compiled;
      disk.back_text = compiled;
    }
    updateLivePreview(disk);
    renderGrid();
    triggerAutoSave();
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Toolbar buttons
    el.btnAddFloppy.addEventListener('click', addNewFloppy);
    el.btnBatchAdd.addEventListener('click', batchAddFloppies);
    el.btnRenumber.addEventListener('click', renumberAll);
    el.projectTitle.addEventListener('input', triggerAutoSave);

    // Modal navigation
    el.btnCloseEditor.addEventListener('click', closeEditor);
    el.btnSaveFloppy.addEventListener('click', closeEditor);
    el.btnPrevFloppy.addEventListener('click', () => navigateEditor(-1));
    el.btnNextFloppy.addEventListener('click', () => navigateEditor(1));
    el.btnDeleteFloppy.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this floppy label?')) {
        deleteFloppy(state.activeFloppyId);
      }
    });
    el.btnDuplicateFloppy.addEventListener('click', duplicateActiveFloppy);

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Cover Layout Selection
    if (el.fieldCoverLayout) {
      el.fieldCoverLayout.addEventListener('change', () => {
        const disk = getActiveDisk();
        if (!disk) return;
        disk.cover_layout = el.fieldCoverLayout.value;
        state.activeSlotIndex = 1;
        renderSlotCards(disk);
        syncSlotAdjustmentsUI(disk);
        updateLivePreview(disk);
        renderGrid();
        triggerAutoSave();
      });
    }

    // Image Upload & Paste
    el.btnBrowseImage.addEventListener('click', () => el.imageFileInput.click());
    el.imageFileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        await uploadFileForFloppy(state.activeFloppyId, e.target.files[0], state.activeSlotIndex);
        el.imageFileInput.value = '';
      }
    });

    // Dropzone
    el.imageDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.imageDropzone.classList.add('dragover');
    });
    el.imageDropzone.addEventListener('dragleave', () => el.imageDropzone.classList.remove('dragover'));
    el.imageDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      el.imageDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await uploadFileForFloppy(state.activeFloppyId, e.dataTransfer.files[0], state.activeSlotIndex);
      }
    });

    // GLOBAL Clipboard Paste Listener (Ctrl+V)
    window.addEventListener('paste', async (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            // Paste to currently active floppy, or the first floppy if none open
            let targetId = state.activeFloppyId;
            if (!targetId && state.project.floppies.length > 0) {
              targetId = state.project.floppies[0].id;
              openEditor(targetId);
            } else if (!targetId) {
              addNewFloppy();
              targetId = state.activeFloppyId;
            }
            await uploadFileForFloppy(targetId, file, state.activeSlotIndex);
            showToast(`Image pasted to Slot ${state.activeSlotIndex || 1}!`);
            break;
          }
        }
      }
    });

    // Image Adjustments (Per-Slot: Zoom, Pan X, Pan Y, Fit Mode)
    el.fieldFitMode.addEventListener('change', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      const slot = state.activeSlotIndex || 1;
      setSlotFitMode(disk, slot, el.fieldFitMode.value);
      updateLivePreview(disk);
      renderGrid();
      triggerAutoSave();
    });
    el.fieldZoom.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      const slot = state.activeSlotIndex || 1;
      const val = parseFloat(el.fieldZoom.value);
      setSlotZoom(disk, slot, val);
      el.valZoom.textContent = val.toFixed(2) + 'x';
      const cardTag = el.slotsContainer?.querySelector(`.slot-card[data-slot="${slot}"] .slot-zoom-tag`);
      if (cardTag) cardTag.textContent = val.toFixed(2) + 'x';
      updateLivePreview(disk);
      renderGrid();
      triggerAutoSave();
    });
    el.fieldPanX.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      const slot = state.activeSlotIndex || 1;
      const val = parseFloat(el.fieldPanX.value);
      setSlotPanX(disk, slot, val);
      if (el.valPanX) el.valPanX.textContent = val + '%';
      updateLivePreview(disk);
      renderGrid();
      triggerAutoSave();
    });
    el.fieldPanY.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      const slot = state.activeSlotIndex || 1;
      const val = parseFloat(el.fieldPanY.value);
      setSlotPanY(disk, slot, val);
      if (el.valPanY) el.valPanY.textContent = val + '%';
      updateLivePreview(disk);
      renderGrid();
      triggerAutoSave();
    });
    if (el.btnResetSlotTransform) {
      el.btnResetSlotTransform.addEventListener('click', () => {
        const disk = getActiveDisk();
        if (!disk) return;
        const slot = state.activeSlotIndex || 1;
        setSlotZoom(disk, slot, 1.0);
        setSlotPanX(disk, slot, 0);
        setSlotPanY(disk, slot, 0);
        setSlotFitMode(disk, slot, 'cover');
        syncSlotAdjustmentsUI(disk);
        renderSlotCards(disk);
        updateLivePreview(disk);
        renderGrid();
        triggerAutoSave();
      });
    }
    el.fieldDisplayNumber.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.display_number = el.fieldDisplayNumber.value;
      updateLivePreview(disk);
      triggerAutoSave();
    });
    el.btnResetNumber.addEventListener('click', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      const pad = state.project.settings.number_pad || 2;
      disk.display_number = String(disk.number).padStart(pad, '0');
      el.fieldDisplayNumber.value = disk.display_number;
      updateLivePreview(disk);
      triggerAutoSave();
    });

    // Spine Controls
    el.btnSpineCandycane.addEventListener('click', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_style = 'candy_cane';
      setSpineStyleToggle('candy_cane');
      updateLivePreview(disk);
      triggerAutoSave();
    });
    el.btnSpineSolid.addEventListener('click', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_style = 'solid';
      setSpineStyleToggle('solid');
      updateLivePreview(disk);
      triggerAutoSave();
    });

    // Color Inputs (Synced with hex)
    syncColorInputs(el.fieldSpineColor1, el.fieldSpineHex1, (val) => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_color1 = val;
      updateLivePreview(disk);
      triggerAutoSave();
    });
    syncColorInputs(el.fieldSpineColor2, el.fieldSpineHex2, (val) => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_color2 = val;
      updateLivePreview(disk);
      triggerAutoSave();
    });

    // Color Presets
    document.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const disk = getActiveDisk();
        if (!disk) return;
        const c1 = btn.dataset.c1;
        const c2 = btn.dataset.c2;
        disk.spine_color1 = c1;
        disk.spine_color2 = c2;
        el.fieldSpineColor1.value = c1;
        el.fieldSpineHex1.value = c1;
        el.fieldSpineColor2.value = c2;
        el.fieldSpineHex2.value = c2;
        updateLivePreview(disk);
        triggerAutoSave();
      });
    });

    el.fieldStripeWidth.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_stripe_width = parseFloat(el.fieldStripeWidth.value);
      el.valStripeW.textContent = disk.spine_stripe_width + 'px';
      updateLivePreview(disk);
      triggerAutoSave();
    });
    el.fieldStripeAngle.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_stripe_angle = parseFloat(el.fieldStripeAngle.value);
      el.valStripeAngle.textContent = disk.spine_stripe_angle + '°';
      updateLivePreview(disk);
      triggerAutoSave();
    });

    // Extract Colors from Cover
    if (el.btnExtractColors) {
      el.btnExtractColors.addEventListener('click', async () => {
        const disk = getActiveDisk();
        if (!disk || !disk.image) {
          showToast('Please upload a cover image first!');
          return;
        }
        try {
          const res = await fetch('/api/extract-colors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: disk.image })
          });
          const data = await res.json();
          if (data.success && data.colors) {
            disk.spine_color1 = data.colors.color1;
            disk.spine_color2 = data.colors.color2;
            el.fieldSpineColor1.value = data.colors.color1;
            el.fieldSpineHex1.value = data.colors.color1;
            el.fieldSpineColor2.value = data.colors.color2;
            el.fieldSpineHex2.value = data.colors.color2;
            updateLivePreview(disk);
            renderGrid();
            triggerAutoSave();
            showToast('Colors extracted from cover art!');
          }
        } catch (err) {
          console.error('Failed to extract colors:', err);
        }
      });
    }

    // Auto-spine text checkbox & input
    if (el.fieldAutoSpineText) {
      el.fieldAutoSpineText.addEventListener('change', () => {
        const disk = getActiveDisk();
        if (!disk) return;
        disk.auto_spine_text = el.fieldAutoSpineText.checked;
        if (el.fieldAutoSpineText.checked) {
          autoFillSpineText();
        }
      });
    }

    el.fieldSpineText.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_text = el.fieldSpineText.value;
      disk.auto_spine_text = false;
      if (el.fieldAutoSpineText) el.fieldAutoSpineText.checked = false;
      updateLivePreview(disk);
      renderGrid();
      triggerAutoSave();
    });

    el.fieldSpineTextColor.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.spine_text_color = el.fieldSpineTextColor.value;
      updateLivePreview(disk);
      renderGrid();
      triggerAutoSave();
    });

    el.btnAutoSpineText.addEventListener('click', autoFillSpineText);

    // Back Tab
    el.fieldMusicTemplate.addEventListener('change', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.template = el.fieldMusicTemplate.value;
      renderTemplateFields(disk);
      if (el.fieldAutoSyncBack.checked) {
        compileTemplateToBackText();
      }
      triggerAutoSave();
    });
    el.fieldBackText.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.back_text = el.fieldBackText.value;
      updateLivePreview(disk);
      triggerAutoSave();
    });
    el.fieldTwoColumns.addEventListener('change', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.two_columns = el.fieldTwoColumns.checked;
      triggerAutoSave();
    });
    el.fieldBackTextColor.addEventListener('input', () => {
      const disk = getActiveDisk();
      if (!disk) return;
      disk.back_text_color = el.fieldBackTextColor.value;
      updateLivePreview(disk);
      triggerAutoSave();
    });

    // Sheet Preview Modal (Direct PDF)
    el.btnSheetPreview.addEventListener('click', openSheetPreview);
    el.btnCloseSheet.addEventListener('click', () => el.sheetModal.classList.remove('open'));

    // Settings Modal
    el.btnSettings.addEventListener('click', openSettingsModal);
    el.btnCloseSettings.addEventListener('click', () => el.settingsModal.classList.remove('open'));
    el.settingInvertBack.addEventListener('change', () => {
      state.project.settings.invert_back_text = el.settingInvertBack.checked;
      triggerAutoSave();
    });
    el.settingDrawGuides.addEventListener('change', () => {
      state.project.settings.draw_guides = el.settingDrawGuides.checked;
      triggerAutoSave();
    });
    el.settingBottomStrips.addEventListener('change', () => {
      state.project.settings.bottom_strips_mode = el.settingBottomStrips.value;
      triggerAutoSave();
    });
    el.settingNumberSize.addEventListener('change', () => {
      state.project.settings.number_size = parseFloat(el.settingNumberSize.value) || 20;
      triggerAutoSave();
    });
    el.settingNumberPad.addEventListener('change', () => {
      state.project.settings.number_pad = parseInt(el.settingNumberPad.value, 10) || 2;
      triggerAutoSave();
    });
    el.btnExportJson.addEventListener('click', exportProjectJson);
    el.btnImportJson.addEventListener('click', () => el.fileImportJson.click());
    el.fileImportJson.addEventListener('change', importProjectJson);
    el.btnResetDemo.addEventListener('click', resetDemoProject);

    // PDF Render
    el.btnRenderPdf.addEventListener('click', renderPdf);
    el.btnClosePdf.addEventListener('click', () => el.pdfModal.classList.remove('open'));
  }

  function getActiveDisk() {
    return state.project.floppies.find(f => f.id === state.activeFloppyId);
  }

  function autoFillSpineText() {
    const disk = getActiveDisk();
    if (!disk) return;
    const artist = (disk.artist || '').trim();
    const album = (disk.album || '').trim();
    let text = (artist && album) ? `${artist} - ${album}` : (album || artist);
    disk.spine_text = text;
    disk.auto_spine_text = true;
    if (el.fieldAutoSpineText) el.fieldAutoSpineText.checked = true;
    el.fieldSpineText.value = text;
    updateLivePreview(disk);
    renderGrid();
    triggerAutoSave();
  }

  function syncColorInputs(colorEl, hexEl, callback) {
    colorEl.addEventListener('input', () => {
      hexEl.value = colorEl.value.toUpperCase();
      callback(colorEl.value);
    });
    hexEl.addEventListener('change', () => {
      let val = hexEl.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        colorEl.value = val;
        callback(val);
      }
    });
  }

  function navigateEditor(delta) {
    const idx = state.project.floppies.findIndex(f => f.id === state.activeFloppyId);
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx >= 0 && nextIdx < state.project.floppies.length) {
      openEditor(state.project.floppies[nextIdx].id);
    }
  }

  function duplicateActiveFloppy() {
    const disk = getActiveDisk();
    if (!disk) return;
    const clone = JSON.parse(JSON.stringify(disk));
    clone.id = 'disk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    clone.number = state.project.floppies.length + 1;
    const pad = state.project.settings.number_pad || 2;
    clone.display_number = String(clone.number).padStart(pad, '0');
    clone.album += ' (Copy)';

    state.project.floppies.push(clone);
    renderGrid();
    triggerAutoSave();
    openEditor(clone.id);
  }

  // Upload File (File object or pasted blob)
  async function uploadFileForFloppy(floppyId, file, slotIndex = null) {
    if (slotIndex === null) {
      slotIndex = state.activeSlotIndex || 1;
    }
    const reader = new FileReader();
    reader.onload = async function() {
      const base64Data = reader.result;
      try {
        setSaveStatus('Uploading image...');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_data: base64Data,
            filename: file.name || 'cover.png'
          })
        });
        const data = await res.json();
        if (data.success) {
          const disk = state.project.floppies.find(f => f.id === floppyId);
          if (disk) {
            const imgKey = slotIndex === 1 ? 'image' : `image${slotIndex}`;
            disk[imgKey] = data.filename;

            // Automatically extract and set default spine colors from image
            if (data.colors && data.colors.color1) {
              if (slotIndex === 1) {
                disk.spine_color1 = data.colors.color1;
                // If single cover or slot 2 isn't set, set secondary color too
                if ((disk.cover_layout || 'single') === 'single' && data.colors.color2) {
                  disk.spine_color2 = data.colors.color2;
                }
              } else if (slotIndex === 2) {
                // For slot 2 on a multi-artist split, extract its color as spine_color2!
                disk.spine_color2 = data.colors.color1;
              }

              if (state.activeFloppyId === floppyId) {
                el.fieldSpineColor1.value = disk.spine_color1 || '#D90429';
                el.fieldSpineHex1.value = disk.spine_color1 || '#D90429';
                el.fieldSpineColor2.value = disk.spine_color2 || '#FFFFFF';
                el.fieldSpineHex2.value = disk.spine_color2 || '#FFFFFF';
              }
            }

            if (state.activeFloppyId === floppyId) {
              renderSlotCards(disk);
              updateLivePreview(disk);
            }
            renderGrid();
            triggerAutoSave();
            showToast(`Slot ${slotIndex} image uploaded!`);
          }
        }
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    };
    reader.readAsDataURL(file);
  }

  // Direct PDF Sheet Preview Modal
  async function openSheetPreview() {
    el.sheetModal.classList.add('open');
    if (el.sheetPdfLoading) el.sheetPdfLoading.style.display = 'flex';
    if (el.sheetPdfIframe) el.sheetPdfIframe.style.opacity = '0.05';

    try {
      const res = await fetch('/api/render-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floppies: state.project.floppies,
          settings: state.project.settings
        })
      });

      const data = await res.json();
      if (data.success && el.sheetPdfIframe) {
        el.sheetPdfIframe.src = data.url + '#view=FitH';
        if (el.btnSheetOpenTab) el.btnSheetOpenTab.href = data.url;
        if (el.btnSheetDownload) {
          el.btnSheetDownload.href = data.url;
          el.btnSheetDownload.setAttribute('download', data.filename);
        }
        el.sheetPdfIframe.onload = () => {
          if (el.sheetPdfLoading) el.sheetPdfLoading.style.display = 'none';
          el.sheetPdfIframe.style.opacity = '1';
        };
        setTimeout(() => {
          if (el.sheetPdfLoading) el.sheetPdfLoading.style.display = 'none';
          el.sheetPdfIframe.style.opacity = '1';
        }, 1200);
      } else {
        alert('Error rendering PDF preview: ' + (data.error || 'Unknown error'));
        if (el.sheetPdfLoading) el.sheetPdfLoading.style.display = 'none';
      }
    } catch (err) {
      console.error('PDF preview error:', err);
      alert('Failed to generate sheet PDF preview.');
      if (el.sheetPdfLoading) el.sheetPdfLoading.style.display = 'none';
    }
  }

  // Print Settings Modal
  function openSettingsModal() {
    el.settingInvertBack.checked = state.project.settings.invert_back_text !== false;
    el.settingDrawGuides.checked = state.project.settings.draw_guides !== false;
    el.settingBottomStrips.value = state.project.settings.bottom_strips_mode || 'spine_match';
    el.settingNumberSize.value = state.project.settings.number_size || 20;
    el.settingNumberPad.value = state.project.settings.number_pad || 2;
    el.settingsModal.classList.add('open');
  }

  function exportProjectJson() {
    const jsonStr = JSON.stringify(state.project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floppy_project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importProjectJson(e) {
    if (!e.target.files || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = function() {
      try {
        const imported = JSON.parse(reader.result);
        if (imported.floppies) {
          state.project = imported;
          renderGrid();
          triggerAutoSave();
          el.settingsModal.classList.remove('open');
          showToast('Project imported successfully!');
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(e.target.files[0]);
  }

  async function resetDemoProject() {
    if (!confirm('Reset project back to default demo floppies? Any unsaved custom floppies will be replaced.')) return;
    const res = await fetch('/api/reset-project', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      state.project = data.project;
      renderGrid();
      el.settingsModal.classList.remove('open');
      showToast('Reset to demo floppies!');
    }
  }

  // Render PDF Action
  async function renderPdf() {
    const btn = el.btnRenderPdf;
    const origHtml = btn.innerHTML;
    btn.innerHTML = 'Rendering PDF...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/render-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floppies: state.project.floppies,
          settings: state.project.settings
        })
      });

      const data = await res.json();
      if (data.success) {
        el.pdfModalFilename.textContent = data.filename;
        el.pdfModalDetails.textContent = `${data.pages} Page(s) • ${data.total_labels} Disk Labels • Avery 5096/5196 Exact Format`;
        el.btnPdfDownload.href = data.url;
        el.btnPdfDownload.setAttribute('download', data.filename);
        el.btnPdfOpen.href = data.url;
        el.pdfModal.classList.add('open');
      } else {
        alert('Error generating PDF: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('PDF render error:', err);
      alert('Failed to generate PDF. Make sure server is running.');
    } finally {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  }

  // Toast notifications
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(0, 240, 255, 0.95);
      color: #030811;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.88rem;
      box-shadow: 0 4px 18px rgba(0, 240, 255, 0.4);
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.3s;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Launch on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
