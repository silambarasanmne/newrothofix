/**
 * Patient Registration Form Handler & Related Views Table Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  Auth.initPageGuard();
  const form = document.getElementById('registrationForm');
  if (!form) return;

  const patientNameInput = document.getElementById('patient_name');
  const ageInput = document.getElementById('age');
  const genderInput = document.getElementById('gender');
  const mobileInput = document.getElementById('mobile');
  const symptomsInput = document.getElementById('symptoms');
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitBtnText = document.getElementById('submitBtnText');

  const tokenDisplayCard = document.getElementById('tokenDisplayCard');
  const generatedTokenElem = document.getElementById('generatedToken');
  const registeredPatientNameElem = document.getElementById('registeredPatientName');
  const registeredGenderElem = document.getElementById('registeredGender');
  const registeredMobileElem = document.getElementById('registeredMobile');
  const registeredDateElem = document.getElementById('registeredDate');
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('editId');

  if (editId) {
    const pageTitleElem = document.getElementById('pageTitleText');
    if (pageTitleElem) pageTitleElem.textContent = `Edit Patient Details (ID #${editId})`;
    if (submitBtnText) submitBtnText.textContent = 'Update Patient Record';

    (async () => {
      try {
        const response = await PatientAPI.getPatientById(editId);
        if (response && response.success && response.data) {
          const p = response.data;
          if (patientNameInput) patientNameInput.value = p.patient_name || '';
          if (ageInput) ageInput.value = p.age || '';
          if (genderInput) genderInput.value = p.gender || 'Male';
          if (mobileInput) mobileInput.value = p.mobile || '';
          if (symptomsInput) symptomsInput.value = p.symptoms || '';
          if (pageTitleElem) pageTitleElem.textContent = `Edit Details: ${p.patient_name} (Token #${p.token})`;
        } else {
          Toast.error('Could not load patient record for editing');
        }
      } catch (err) {
        Toast.error('Failed to load patient details for editing');
      }
    })();
  }

  /**
   * Field Validation Rules
   */
  const validateName = (value) => {
    if (!value || !value.trim()) return 'Patient Name is required';
    if (value.trim().length < 3) return 'Patient Name must be at least 3 characters';
    if (!/^[a-zA-Z\s]+$/.test(value.trim())) return 'Alphabets and spaces only';
    return '';
  };

  const validateAge = (value) => {
    if (value === '' || value === null || value === undefined) return 'Age is required';
    const ageNum = Number(value);
    if (isNaN(ageNum) || !Number.isInteger(ageNum)) return 'Must be a valid number';
    if (ageNum < 0 || ageNum > 120) return 'Age must be between 0 and 120';
    return '';
  };

  const validateGender = (value) => {
    if (!value || !['Male', 'Female', 'Other'].includes(value)) return 'Please select a valid gender';
    return '';
  };

  const validateMobile = (value) => {
    if (!value || !value.trim()) return 'Mobile Number is required';
    if (!/^\d{10}$/.test(value.trim())) return 'Mobile Number must be exactly 10 digits';
    return '';
  };

  const validateSymptoms = (value) => {
    if (!value || !value.trim()) return 'Issues / Symptoms is required';
    if (value.trim().length < 5) return 'Minimum 5 characters required';
    return '';
  };

  /**
   * Display or Clear Field Error
   */
  const setFieldError = (fieldId, errorMessage) => {
    const inputElem = document.getElementById(fieldId);
    const errorElem = document.getElementById(`${fieldId}_error`);

    if (!inputElem || !errorElem) return;

    if (errorMessage) {
      inputElem.classList.add('is-invalid');
      errorElem.innerHTML = `
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>${errorMessage}</span>
      `;
      errorElem.classList.remove('hidden');
    } else {
      inputElem.classList.remove('is-invalid');
      errorElem.innerHTML = '';
      errorElem.classList.add('hidden');
    }
  };

  /**
   * Real-time Validation Listeners
   */
  if (patientNameInput) {
    patientNameInput.addEventListener('input', () => {
      setFieldError('patient_name', validateName(patientNameInput.value));
    });
  }

  if (ageInput) {
    ageInput.addEventListener('input', () => {
      setFieldError('age', validateAge(ageInput.value));
    });
  }

  if (genderInput) {
    genderInput.addEventListener('change', () => {
      setFieldError('gender', validateGender(genderInput.value));
    });
  }

  if (mobileInput) {
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      setFieldError('mobile', validateMobile(mobileInput.value));
    });
  }

  if (symptomsInput) {
    symptomsInput.addEventListener('input', () => {
      setFieldError('symptoms', validateSymptoms(symptomsInput.value));
    });
  }

  /**
   * Form Submit Event Handler
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Perform comprehensive validation
    const nameError = validateName(patientNameInput.value);
    const ageError = validateAge(ageInput.value);
    const genderError = validateGender(genderInput ? genderInput.value : 'Male');
    const mobileError = validateMobile(mobileInput.value);
    const symptomsError = validateSymptoms(symptomsInput.value);

    setFieldError('patient_name', nameError);
    setFieldError('age', ageError);
    setFieldError('gender', genderError);
    setFieldError('mobile', mobileError);
    setFieldError('symptoms', symptomsError);

    if (nameError || ageError || genderError || mobileError || symptomsError) {
      Toast.error('Please fix the errors in the form before submitting.');
      return;
    }

    const payload = {
      patient_name: patientNameInput.value.trim(),
      age: parseInt(ageInput.value.trim(), 10),
      gender: genderInput ? genderInput.value : 'Male',
      mobile: mobileInput.value.trim(),
      symptoms: symptomsInput.value.trim()
    };

    if (editId) {
      submitBtn.disabled = true;
      if (submitSpinner) submitSpinner.classList.remove('hidden');
      if (submitBtnText) submitBtnText.textContent = 'Updating Record...';

      const response = await PatientAPI.updatePatient(editId, payload);

      submitBtn.disabled = false;
      if (submitSpinner) submitSpinner.classList.add('hidden');
      if (submitBtnText) submitBtnText.textContent = 'Update Patient Record';

      if (response && response.success) {
        Toast.success('Patient record updated successfully!');
        loadAllRelatedViews();
        setTimeout(() => {
          window.location.href = 'register.html';
        }, 600);
      } else {
        if (response && response.errors) {
          Object.keys(response.errors).forEach(fieldId => {
            setFieldError(fieldId, response.errors[fieldId]);
          });
        }
        Toast.error(response?.message || 'Failed to update patient record');
      }
      return;
    }

    // Set loading UI state
    submitBtn.disabled = true;
    if (submitSpinner) submitSpinner.classList.remove('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Generating Token...';

    const response = await PatientAPI.registerPatient(payload);

    // Reset button state
    submitBtn.disabled = false;
    if (submitSpinner) submitSpinner.classList.add('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Generate Patient Token';

    if (response && response.success) {
      Toast.success('Patient Registered Successfully! Token Issued.');

      // Display the token result prominently
      if (generatedTokenElem) generatedTokenElem.textContent = `#${response.token}`;
      if (registeredPatientNameElem) registeredPatientNameElem.textContent = response.data ? response.data.patient_name : '--';
      if (registeredGenderElem) registeredGenderElem.textContent = response.data ? (response.data.gender || 'Male') : '--';
      if (registeredMobileElem) registeredMobileElem.textContent = response.data ? response.data.mobile : '--';
      if (registeredDateElem) {
        const date = new Date(response.data.created_at || Date.now());
        registeredDateElem.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + date.toLocaleDateString();
      }

      if (tokenDisplayCard) {
        tokenDisplayCard.classList.remove('hidden');
        tokenDisplayCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Clear form
      form.reset();
      if (genderInput) genderInput.value = 'Male';
      
      // Clear validation styles
      ['patient_name', 'age', 'gender', 'mobile', 'symptoms'].forEach(fieldId => {
        setFieldError(fieldId, '');
      });

      // Refresh related views tables immediately
      loadAllRelatedViews();

    } else {
      if (response && response.errors) {
        Object.keys(response.errors).forEach(fieldId => {
          setFieldError(fieldId, response.errors[fieldId]);
        });
      }
      Toast.error(response?.message || 'Failed to register patient');
    }
  });

  /**
   * RELATED TABLES VIEW CONTROLLER
   */
  const tabBtnPatients = document.getElementById('tab-btn-patients');
  const tabBtnConsultations = document.getElementById('tab-btn-consultations');
  const tabBtnBilling = document.getElementById('tab-btn-billing');

  const tabContentPatients = document.getElementById('tab-content-patients');
  const tabContentConsultations = document.getElementById('tab-content-consultations');
  const tabContentBilling = document.getElementById('tab-content-billing');

  const viewPatientsTableBody = document.getElementById('viewPatientsTableBody');
  const viewConsultationsTableBody = document.getElementById('viewConsultationsTableBody');
  const viewBillingTableBody = document.getElementById('viewBillingTableBody');

  const viewTableSearch = document.getElementById('viewTableSearch');
  const refreshViewsBtn = document.getElementById('refreshViewsBtn');

  let rawPatientsData = [];
  let rawConsultationsData = [];
  let rawBillingData = [];
  let searchDebounce = null;

  function switchTab(activeTab) {
    const tabs = [
      { btn: tabBtnPatients, content: tabContentPatients },
      { btn: tabBtnConsultations, content: tabContentConsultations },
      { btn: tabBtnBilling, content: tabContentBilling }
    ];

    tabs.forEach(t => {
      if (!t.btn || !t.content) return;
      if (t.btn === activeTab) {
        t.btn.className = 'tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 transition-all flex items-center gap-1.5';
        t.content.classList.remove('hidden');
      } else {
        t.btn.className = 'tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
        t.content.classList.add('hidden');
      }
    });
  }

  if (tabBtnPatients) tabBtnPatients.addEventListener('click', () => switchTab(tabBtnPatients));
  if (tabBtnConsultations) tabBtnConsultations.addEventListener('click', () => switchTab(tabBtnConsultations));
  if (tabBtnBilling) tabBtnBilling.addEventListener('click', () => switchTab(tabBtnBilling));

  async function fetchPatientsView() {
    if (!viewPatientsTableBody) return;
    try {
      const res = await PatientAPI.getPatients({ limit: 50, sortBy: 'created_at', order: 'DESC' });
      if (res && res.success) {
        rawPatientsData = res.data || [];
        renderPatientsView(rawPatientsData);
      }
    } catch (err) {
      console.error('Failed to load patients view:', err);
    }
  }

  async function fetchConsultationsView() {
    if (!viewConsultationsTableBody) return;
    try {
      const res = await API.request('/prescriptions/all');
      if (res && res.success) {
        rawConsultationsData = res.prescriptions || [];
        renderConsultationsView(rawConsultationsData);
      }
    } catch (err) {
      console.error('Failed to load consultations view:', err);
    }
  }

  async function fetchBillingView() {
    if (!viewBillingTableBody) return;
    try {
      const res = await API.request('/billing/history');
      if (res && res.success) {
        rawBillingData = res.sales || [];
        renderBillingView(rawBillingData);
      }
    } catch (err) {
      console.error('Failed to load billing view:', err);
    }
  }

  function getGenderBadge(gender) {
    const g = String(gender || 'Male').toLowerCase();
    if (g === 'female') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-rose-300 bg-rose-950/80 border border-rose-500/30 rounded-full">♀ Female</span>`;
    } else if (g === 'other') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-purple-300 bg-purple-950/80 border border-purple-500/30 rounded-full">⚧ Other</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 rounded-full">♂ Male</span>`;
  }

  function renderPatientsView(data) {
    if (!viewPatientsTableBody) return;
    const query = (viewTableSearch?.value || '').toLowerCase().trim();
    const filtered = data.filter(p => {
      if (!query) return true;
      return (
        String(p.token).includes(query) ||
        (p.patient_name && p.patient_name.toLowerCase().includes(query)) ||
        (p.mobile && p.mobile.includes(query)) ||
        (p.symptoms && p.symptoms.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      viewPatientsTableBody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500">No matching outpatient records found</td></tr>`;
      return;
    }

    viewPatientsTableBody.innerHTML = filtered.map(p => {
      const dateObj = new Date(p.created_at);
      const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusBadge = p.consultation_status
        ? (p.consultation_status === 'Billed'
          ? `<span class="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">Billed</span>`
          : `<span class="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">Pending</span>`)
        : `<span class="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 rounded-full">Queued</span>`;

      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
          <td class="px-4 py-3 font-mono font-bold text-teal-400">#${p.token}</td>
          <td class="px-4 py-3 font-semibold text-slate-200">${escapeHtml(p.patient_name)}</td>
          <td class="px-4 py-3 text-slate-300">${p.age} yrs</td>
          <td class="px-4 py-3">${getGenderBadge(p.gender)}</td>
          <td class="px-4 py-3 font-mono text-cyan-300">${escapeHtml(p.mobile)}</td>
          <td class="px-4 py-3 text-slate-400 max-w-xs truncate" title="${escapeHtml(p.symptoms)}">${escapeHtml(p.symptoms)}</td>
          <td class="px-4 py-3">${statusBadge}</td>
          <td class="px-4 py-3 text-slate-400 text-[11px]">${dateStr}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="window.showRegisterDetailsModal('${p.token}')" class="px-2.5 py-1 text-[11px] font-semibold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg transition-colors">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderConsultationsView(data) {
    if (!viewConsultationsTableBody) return;
    const query = (viewTableSearch?.value || '').toLowerCase().trim();
    const filtered = data.filter(c => {
      if (!query) return true;
      return (
        String(c.patient_token).includes(query) ||
        (c.patient_name && c.patient_name.toLowerCase().includes(query)) ||
        (c.doctor_name && c.doctor_name.toLowerCase().includes(query)) ||
        (c.diagnosis && c.diagnosis.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      viewConsultationsTableBody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-500">No matching consultations found</td></tr>`;
      return;
    }

    viewConsultationsTableBody.innerHTML = filtered.map(c => {
      const dateObj = new Date(c.created_at);
      const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusBadge = c.status === 'Billed'
        ? `<span class="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">Billed</span>`
        : `<span class="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">Pending</span>`;

      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
          <td class="px-4 py-3 font-mono font-bold text-teal-400">#${c.patient_token}</td>
          <td class="px-4 py-3 font-semibold text-slate-200">${escapeHtml(c.patient_name || '--')}</td>
          <td class="px-4 py-3">${getGenderBadge(c.gender)}</td>
          <td class="px-4 py-3 text-cyan-300 font-medium">${escapeHtml(c.doctor_name || 'Dr. Specialist')}</td>
          <td class="px-4 py-3 text-slate-300 max-w-xs truncate" title="${escapeHtml(c.diagnosis || c.symptoms)}">${escapeHtml(c.diagnosis || c.symptoms || '--')}</td>
          <td class="px-4 py-3 text-slate-400 max-w-xs truncate" title="${escapeHtml(c.doctor_comment)}">${escapeHtml(c.doctor_comment || '--')}</td>
          <td class="px-4 py-3">${statusBadge}</td>
          <td class="px-4 py-3 text-slate-400 text-[11px]">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }

  function renderBillingView(data) {
    if (!viewBillingTableBody) return;
    const query = (viewTableSearch?.value || '').toLowerCase().trim();
    const filtered = data.filter(b => {
      if (!query) return true;
      return (
        (b.invoice_number && b.invoice_number.toLowerCase().includes(query)) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(query)) ||
        (b.customer_phone && b.customer_phone.includes(query)) ||
        (b.doctor_name && b.doctor_name.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      viewBillingTableBody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-500">No matching billing invoices found</td></tr>`;
      return;
    }

    viewBillingTableBody.innerHTML = filtered.map(b => {
      const dateObj = new Date(b.created_at);
      const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
          <td class="px-4 py-3 font-mono font-bold text-amber-400">${escapeHtml(b.invoice_number)}</td>
          <td class="px-4 py-3 font-semibold text-slate-200">${escapeHtml(b.customer_name)}</td>
          <td class="px-4 py-3 font-mono text-slate-300">${escapeHtml(b.customer_phone || '--')}</td>
          <td class="px-4 py-3 text-cyan-300">${escapeHtml(b.doctor_name || '--')}</td>
          <td class="px-4 py-3 font-bold text-emerald-400">₹${Number(b.grand_total || 0).toFixed(2)}</td>
          <td class="px-4 py-3 text-slate-300">${escapeHtml(b.payment_method)}</td>
          <td class="px-4 py-3 text-slate-400 text-[11px]">${escapeHtml(b.worker_name)}</td>
          <td class="px-4 py-3 text-slate-400 text-[11px]">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }

  function loadAllRelatedViews() {
    fetchPatientsView();
    fetchConsultationsView();
    fetchBillingView();
  }

  if (viewTableSearch) {
    viewTableSearch.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        renderPatientsView(rawPatientsData);
        renderConsultationsView(rawConsultationsData);
        renderBillingView(rawBillingData);
      }, 250);
    });
  }

  if (refreshViewsBtn) {
    refreshViewsBtn.addEventListener('click', () => {
      loadAllRelatedViews();
      Toast.success('Related records updated');
    });
  }

  window.showRegisterDetailsModal = async (token) => {
    const res = await PatientAPI.getPatientByToken(token);
    if (res && res.success && res.data) {
      const p = res.data;
      const modal = document.getElementById('registerDetailsModal');
      document.getElementById('regModalToken').textContent = `#${p.token}`;
      document.getElementById('regModalName').textContent = p.patient_name;
      document.getElementById('regModalAge').textContent = `${p.age} Yrs`;
      document.getElementById('regModalGender').textContent = p.gender || 'Male';
      document.getElementById('regModalMobile').textContent = p.mobile;
      document.getElementById('regModalSymptoms').textContent = p.symptoms;
      document.getElementById('regModalDate').textContent = new Date(p.created_at).toLocaleString();
      if (modal) modal.classList.remove('hidden');
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Load tables initially
  loadAllRelatedViews();
});
