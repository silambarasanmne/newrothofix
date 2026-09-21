/**
 * Patient API Service Methods
 * Relies on the central API client from api.js
 */
const PatientAPI = {
  registerPatient: (patientData) => API.request('/patients', {
    method: 'POST',
    body: JSON.stringify(patientData)
  }),

  updatePatient: (id, patientData) => API.request(`/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patientData)
  }),

  deletePatient: (id) => API.request(`/patients/${id}`, {
    method: 'DELETE'
  }),

  getPatients: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.request(`/patients?${query}`);
  },

  getPatientByToken: (token) => API.request(`/patients/${encodeURIComponent(String(token).replace('#', '').trim())}`),

  getPatientById: (id) => API.request(`/patients/id/${id}`),

  getStats: () => API.request('/stats'),

  getExportUrl: () => `${API.baseUrl}/patients/export`,

  exportCSV: async (filterParams = {}) => {
    const params = new URLSearchParams();
    if (filterParams.search) params.append('search', filterParams.search);
    if (filterParams.fromDate) params.append('fromDate', filterParams.fromDate);
    if (filterParams.toDate) params.append('toDate', filterParams.toDate);

    const token = API.getToken();
    if (token) {
      params.append('token', token);
    }

    const exportUrl = `${PatientAPI.getExportUrl()}?${params.toString()}`;
    const response = await fetch(exportUrl, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error('Export request failed with status ' + response.status);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'Orthofix_Registered_Patient_Records.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
};

window.PatientAPI = PatientAPI;
const Toast = {
  container: null,
  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(this.container);
  },
  show(message, type = 'success', duration = 4000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = 'flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md transform transition-all duration-300 translate-x-[120%] pointer-events-auto border';
    
    if (type === 'success') {
      toast.classList.add('bg-teal-950/90', 'border-teal-500/30', 'text-teal-400');
    } else {
      toast.classList.add('bg-red-950/90', 'border-red-500/30', 'text-red-400');
    }
    
    toast.innerHTML = `<span>${message}</span>`;
    this.container.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-x-[120%]'); }, 10);
    setTimeout(() => {
      toast.classList.add('translate-x-[120%]', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); }
};
window.Toast = Toast;
