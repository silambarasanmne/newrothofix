/**
 * Patient Records Page Controller - Search, Date Filter, Sorting, Pagination, MediCard Download
 */

document.addEventListener('DOMContentLoaded', () => {
  Auth.initPageGuard();
  const patientsTableBody = document.getElementById('patientsTableBody');
  if (!patientsTableBody) return;

  const searchInput = document.getElementById('searchInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  const clearDateBtn = document.getElementById('clearDateBtn');
  const sortSelect = document.getElementById('sortSelect');
  const limitSelect = document.getElementById('limitSelect');
  const paginationControls = document.getElementById('paginationControls');
  const recordCountInfo = document.getElementById('recordCountInfo');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const emptyState = document.getElementById('emptyState');

  // Modal elements
  const detailsModal = document.getElementById('detailsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalToken = document.getElementById('modalToken');
  const modalName = document.getElementById('modalName');
  const modalAge = document.getElementById('modalAge');
  const modalMobile = document.getElementById('modalMobile');
  const modalSymptoms = document.getElementById('modalSymptoms');
  const modalDate = document.getElementById('modalDate');
  const btnDownloadMedicard = document.getElementById('btn-download-medicard');
  const btnExportCsv = document.getElementById('btn-export-csv');

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      try {
        await PatientAPI.exportCSV({
          search: state.search,
          fromDate: state.fromDate,
          toDate: state.toDate
        });
        Toast.success('Registered Patient Records CSV downloaded successfully.');
      } catch (error) {
        console.error('Error exporting CSV:', error);
        Toast.error('Failed to export CSV records.');
      }
    });
  }

  let activeModalPatient = null;

  let state = {
    search: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 10,
    sortBy: 'created_at',
    order: 'DESC'
  };

  let searchTimeout = null;

  /**
   * Fetch and render patients
   */
  async function loadPatients() {
    // Show loading spinner
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (patientsTableBody) patientsTableBody.classList.add('opacity-40');
    if (emptyState) emptyState.classList.add('hidden');

    const response = await PatientAPI.getPatients(state);

    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    if (patientsTableBody) patientsTableBody.classList.remove('opacity-40');

    if (response && response.success) {
      renderTable(response.data || []);
      renderPagination(response.page || 1, response.totalPages || 1, response.total || 0);
      
      let infoStr = `Showing ${(response.data || []).length} of ${response.total || 0} patient records`;
      if (state.fromDate || state.toDate) {
        if (state.fromDate && state.toDate) {
          infoStr += ` (From ${state.fromDate} to ${state.toDate})`;
        } else if (state.fromDate) {
          infoStr += ` (From ${state.fromDate})`;
        } else {
          infoStr += ` (Up to ${state.toDate})`;
        }
      }
      if (recordCountInfo) recordCountInfo.textContent = infoStr;
      
      if (!response.data || response.data.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
      }
    } else {
      Toast.error(response?.message || 'Error loading patient records');
    }
  }

  /**
   * Render Table Rows
   */
  function renderTable(patients) {
    patientsTableBody.innerHTML = '';
    const currentUser = API.getUser();
    const isAdmin = currentUser && (currentUser.role === 'Admin / Billing Manager' || currentUser.role === 'Admin');

    (patients || []).forEach(patient => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors';

      const dateObj = new Date(patient.created_at);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const formattedTime = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center justify-center px-3 py-1 text-sm font-bold text-teal-300 bg-teal-950/80 border border-teal-500/30 rounded-full font-mono-token shadow-sm">
            #${patient.token}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
              ${patient.patient_name ? patient.patient_name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-100">${escapeHtml(patient.patient_name)}</p>
              <p class="text-xs text-slate-400">ID: OP-${patient.id}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
          ${patient.age} yrs
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
          <span class="font-mono text-xs text-cyan-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
            ${escapeHtml(patient.mobile)}
          </span>
        </td>
        <td class="px-6 py-4 text-sm text-slate-300 max-w-xs truncate" title="${escapeHtml(patient.symptoms)}">
          ${escapeHtml(patient.symptoms)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
          <div class="font-medium text-slate-200">${formattedDate}</div>
          <div class="text-slate-500">${formattedTime}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
          <div class="flex items-center justify-end gap-1.5">
            <button data-id="${patient.id}" class="edit-btn px-2.5 py-1 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Edit
            </button>
            ${isAdmin ? `
            <button data-id="${patient.id}" data-name="${escapeHtml(patient.patient_name)}" class="delete-btn px-2.5 py-1 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Delete
            </button>
            ` : ''}
          </div>
        </td>
      `;

      patientsTableBody.appendChild(tr);
    });

    // Attach click handlers
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pId = e.currentTarget.getAttribute('data-id');
        window.location.href = `register.html?editId=${pId}`;
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const pId = e.currentTarget.getAttribute('data-id');
        const pName = e.currentTarget.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete patient record "${pName}" (ID #${pId})? This action is restricted to Admin.`)) {
          const res = await PatientAPI.deletePatient(pId);
          if (res.success) {
            Toast.success(`Patient record #${pId} deleted successfully.`);
            loadPatients();
          } else {
            Toast.error(res.message || 'Failed to delete patient record.');
          }
        }
      });
    });
  }

  /**
   * Render Pagination Buttons
   */
  function renderPagination(currentPage, totalPages, totalItems) {
    paginationControls.innerHTML = '';
    if (totalPages <= 1) return;

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = `px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
      currentPage === 1 
        ? 'border-slate-800 text-slate-600 cursor-not-allowed' 
        : 'border-slate-700 text-slate-300 hover:bg-slate-800'
    }`;
    prevBtn.innerHTML = '← Prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        loadPatients();
      }
    });
    paginationControls.appendChild(prevBtn);

    // Page Number Buttons
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          i === currentPage
            ? 'bg-teal-600 text-white font-bold shadow-md'
            : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
        }`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
          state.page = i;
          loadPatients();
        });
        paginationControls.appendChild(pageBtn);
      } else if (
        (i === 2 && currentPage > 3) ||
        (i === totalPages - 1 && currentPage < totalPages - 2)
      ) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'px-1 text-slate-500 text-xs self-center';
        ellipsis.textContent = '...';
        paginationControls.appendChild(ellipsis);
      }
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = `px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
      currentPage === totalPages 
        ? 'border-slate-800 text-slate-600 cursor-not-allowed' 
        : 'border-slate-700 text-slate-300 hover:bg-slate-800'
    }`;
    nextBtn.innerHTML = 'Next →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (state.page < totalPages) {
        state.page++;
        loadPatients();
      }
    });
    paginationControls.appendChild(nextBtn);
  }

  /**
   * Open Patient Details Modal & Check Admin Role for MediCard Download
   */
  async function openDetailsModal(token) {
    const response = await PatientAPI.getPatientByToken(token);
    if (response.success) {
      const patient = response.data;
      activeModalPatient = patient;

      if (modalToken) modalToken.textContent = `#${patient.token}`;
      if (modalName) modalName.textContent = patient.patient_name;
      if (modalAge) modalAge.textContent = `${patient.age} Years Old`;
      if (modalMobile) modalMobile.textContent = patient.mobile;
      if (modalSymptoms) modalSymptoms.textContent = patient.symptoms;
      if (modalDate) {
        const dateObj = new Date(patient.created_at);
        modalDate.textContent = dateObj.toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'medium'
        });
      }

      // Check role permissions for MediCard download: ONLY ADMIN USERS CAN VIEW & DOWNLOAD MEDICARD
      const currentUser = API.getUser();
      if (currentUser && currentUser.role === 'Admin') {
        btnDownloadMedicard?.classList.remove('hidden');
      } else {
        btnDownloadMedicard?.classList.add('hidden');
      }

      if (detailsModal) detailsModal.classList.remove('hidden');
    } else {
      Toast.error(response.message || 'Could not fetch patient details');
    }
  }

  // Handle Download MediCard Click (Admin Only)
  if (btnDownloadMedicard) {
    btnDownloadMedicard.addEventListener('click', () => {
      const currentUser = API.getUser();
      if (!currentUser || currentUser.role !== 'Admin') {
        Toast.error('Access Denied: MediCard Download is restricted to Admin users only.');
        return;
      }
      if (activeModalPatient) {
        generateAndDownloadMedicard(activeModalPatient);
      }
    });
  }

  /**
   * Generate & Download MediCard as a Printable Official Hospital Pass Window
   */
  function generateAndDownloadMedicard(patient) {
    const dateObj = new Date(patient.created_at);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
      Toast.error('Please allow popups to download/print the MediCard.');
      return;
    }

    const cardHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MediCard #${patient.token} - ${patient.patient_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: #f8fafc;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .card-container {
            width: 480px;
            background: #ffffff;
            border-radius: 20px;
            border: 2px solid #0d9488;
            box-shadow: 0 15px 35px rgba(13, 148, 136, 0.15);
            overflow: hidden;
            position: relative;
          }
          .card-header {
            background: linear-gradient(135deg, #0f172a 0%, #0f766e 100%);
            color: #ffffff;
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .logo-box {
            width: 52px;
            height: 52px;
            background: #ffffff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          }
          .logo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 8px;
          }
          .hospital-title {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.3px;
          }
          .hospital-sub {
            font-size: 11px;
            color: #5eead4;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .card-body {
            padding: 24px;
          }
          .token-badge-banner {
            background: #f0fdf4;
            border: 1.5px dashed #0d9488;
            border-radius: 14px;
            padding: 14px;
            text-align: center;
            margin-bottom: 20px;
          }
          .token-label {
            font-size: 11px;
            font-weight: 700;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .token-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 36px;
            font-weight: 700;
            color: #0d9488;
            line-height: 1.1;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
          }
          .info-group {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .info-val {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
          }
          .symptoms-box {
            background: #f8fafc;
            border-radius: 10px;
            padding: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 20px;
          }
          .card-footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }
          .official-stamp {
            border: 1.5px solid #0d9488;
            color: #0d9488;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 1px;
            transform: rotate(-3deg);
          }
          @media print {
            body { background: white; padding: 0; }
            .card-container { box-shadow: none; border-color: #000; }
          }
        </style>
      </head>
      <body>
        <div class="card-container">
          <div class="card-header">
            <div class="logo-box">
              <img src="assets/hospital-logo.png" alt="Logo">
            </div>
            <div>
              <div class="hospital-title">ORTHOFIX SPECIALITY CLINIC</div>
              <div class="hospital-sub">Outpatient Digital MediCard</div>
            </div>
          </div>
          <div class="card-body">
            <div class="token-badge-banner">
              <div class="token-label">OP Sequential Token Number</div>
              <div class="token-number">#${patient.token}</div>
            </div>
            <div class="info-grid">
              <div class="info-group">
                <span class="info-label">Patient Name</span>
                <span class="info-val">${escapeHtml(patient.patient_name)}</span>
              </div>
              <div class="info-group">
                <span class="info-label">Patient ID</span>
                <span class="info-val">OP-${patient.id}</span>
              </div>
              <div class="info-group">
                <span class="info-label">Age</span>
                <span class="info-val">${patient.age} Years</span>
              </div>
              <div class="info-group">
                <span class="info-label">Mobile Number</span>
                <span class="info-val">${escapeHtml(patient.mobile)}</span>
              </div>
            </div>
            <div class="symptoms-box">
              <span class="info-label">Reported Symptoms / Issues</span>
              <div class="info-val" style="font-size: 12px; font-weight: 500; margin-top: 4px;">
                ${escapeHtml(patient.symptoms)}
              </div>
            </div>
            <div class="card-footer">
              <div>
                <div><strong>Issue Date:</strong> ${formattedDate}</div>
                <div><strong>Time:</strong> ${formattedTime}</div>
              </div>
              <div class="official-stamp">
                Verified Admin MediCard
              </div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(cardHtml);
    printWin.document.close();
    Toast.success(`Generated MediCard for Token #${patient.token}`);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (detailsModal) detailsModal.classList.add('hidden');
    });
  }

  if (detailsModal) {
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) {
        detailsModal.classList.add('hidden');
      }
    });
  }

  /**
   * Search Input Event Listener (Debounced)
   */
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = e.target.value;
        state.page = 1;
        loadPatients();
      }, 300);
    });
  }

  /**
   * From Date & To Date Range Listener
   */
  function handleDateRangeChange() {
    state.fromDate = fromDateInput ? fromDateInput.value : '';
    state.toDate = toDateInput ? toDateInput.value : '';
    state.page = 1;

    if (state.fromDate || state.toDate) {
      clearDateBtn?.classList.remove('hidden');
    } else {
      clearDateBtn?.classList.add('hidden');
    }

    loadPatients();
  }

  if (fromDateInput) fromDateInput.addEventListener('change', handleDateRangeChange);
  if (toDateInput) toDateInput.addEventListener('change', handleDateRangeChange);

  if (clearDateBtn) {
    clearDateBtn.addEventListener('click', () => {
      if (fromDateInput) fromDateInput.value = '';
      if (toDateInput) toDateInput.value = '';
      state.fromDate = '';
      state.toDate = '';
      state.page = 1;
      clearDateBtn.classList.add('hidden');
      loadPatients();
    });
  }

  /**
   * Sort Dropdown Handler
   */
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'newest') {
        state.sortBy = 'created_at';
        state.order = 'DESC';
      } else if (val === 'oldest') {
        state.sortBy = 'created_at';
        state.order = 'ASC';
      } else if (val === 'token_asc') {
        state.sortBy = 'token';
        state.order = 'ASC';
      } else if (val === 'token_desc') {
        state.sortBy = 'token';
        state.order = 'DESC';
      } else if (val === 'name_asc') {
        state.sortBy = 'patient_name';
        state.order = 'ASC';
      }
      state.page = 1;
      loadPatients();
    });
  }

  /**
   * Limit Per Page Handler
   */
  if (limitSelect) {
    limitSelect.addEventListener('change', (e) => {
      state.limit = parseInt(e.target.value, 10);
      state.page = 1;
      loadPatients();
    });
  }

  /**
   * Edit Patient Modal Handler
   */
  async function openEditPatientModal(pId, pName, pAge, pMobile, pSymptoms) {
    const newName = prompt("Edit Patient Name:", pName);
    if (newName === null) return;
    const newAge = prompt("Edit Age:", pAge);
    if (newAge === null) return;
    const newMobile = prompt("Edit Mobile Number (10 digits):", pMobile);
    if (newMobile === null) return;
    const newSymptoms = prompt("Edit Symptoms / Issues:", pSymptoms);
    if (newSymptoms === null) return;

    const res = await PatientAPI.updatePatient(pId, {
      patient_name: newName,
      age: newAge,
      mobile: newMobile,
      symptoms: newSymptoms
    });

    if (res.success) {
      Toast.success(`Patient record ID #${pId} updated successfully.`);
      loadPatients();
    } else {
      Toast.error(res.message || 'Failed to update patient record.');
    }
  }

  /**
   * Utility - Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Navigation Smooth Scroll Handler for "Patient Records"
  const navRecordsBtn = document.getElementById('nav-records');
  if (navRecordsBtn) {
    navRecordsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const section = document.getElementById('patientsTableSection');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (window.location.hash === '#patientsTableSection') {
    setTimeout(() => {
      const section = document.getElementById('patientsTableSection');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  }

  // Initial Load
  loadPatients();
});


